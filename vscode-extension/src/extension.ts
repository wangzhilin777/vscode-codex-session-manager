import * as vscode from "vscode";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CodexCliService } from "./actions/codexCliService";
import { EXTENSION_NAMESPACE, VIEW_ID } from "./constants";
import { getCurrentSettings, SessionRepository } from "./data/sessionRepository";
import { MetadataStore } from "./storage/metadataStore";
import { SessionNode, SessionTreeProvider } from "./tree/sessionTreeProvider";
import { ExtensionSettings, SessionFilterState, SessionRecord } from "./types";
import {
  buildOfficialCodexConversationUri,
  hasOfficialCodexExtension,
  openOfficialCodexConversation
} from "./utils/officialCodex";
import { configureLanguage, t } from "./utils/i18n";
import { isPathInside, toDisplayPath } from "./utils/pathUtils";
import { SessionDetailsProvider } from "./view/sessionDetailsProvider";

const PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY = "pendingOpenAfterWorkspaceSwitch";
const PENDING_OPEN_MAX_AGE_MS = 2 * 60 * 1000;
const ROLLOUT_FILE_PATTERN = /^rollout-(\d{4})-(\d{2})-(\d{2})T.*-[0-9a-fA-F-]{36}\.jsonl$/;

interface PendingOpenAfterWorkspaceSwitch {
  sessionId: string;
  workspacePath: string;
  createdAt: number;
}

class SessionManagerController {
  private readonly output = vscode.window.createOutputChannel("Codex Session Manager");
  private readonly metadataStore: MetadataStore;
  private settings: ExtensionSettings;
  private state: SessionFilterState;
  private readonly cliService: CodexCliService;
  private readonly repository: SessionRepository;
  private readonly treeProvider = new SessionTreeProvider();
  private readonly detailsProvider: SessionDetailsProvider;
  private readonly treeView: vscode.TreeView<SessionNode | unknown>;
  private refreshTimer: NodeJS.Timeout | null = null;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.metadataStore = new MetadataStore(context);
    this.settings = getCurrentSettings();
    this.state = {
      currentProjectOnly: this.settings.currentProjectOnlyDefault,
      showArchived: this.settings.showArchivedDefault,
      searchTerm: ""
    };
    this.cliService = new CodexCliService(this.settings, this.output);
    this.repository = new SessionRepository(this.settings, this.metadataStore, this.cliService, this.output);
    this.detailsProvider = new SessionDetailsProvider(this.repository, () => this.settings);
    this.treeView = vscode.window.createTreeView(VIEW_ID, {
      treeDataProvider: this.treeProvider,
      showCollapseAll: true
    });
  }

  public async activate(): Promise<void> {
    this.context.subscriptions.push(
      this.output,
      this.treeView,
      this.repository,
      vscode.workspace.registerTextDocumentContentProvider("codex-session", this.detailsProvider),
      vscode.commands.registerCommand("codexSessions.refresh", async () => {
        await this.refresh();
      }),
      vscode.commands.registerCommand("codexSessions.toggleCurrentProjectOnly", async () => {
        this.state.currentProjectOnly = !this.state.currentProjectOnly;
        await this.refresh();
      }),
      vscode.commands.registerCommand("codexSessions.showCurrentWorkspace", async () => {
        this.state.currentProjectOnly = true;
        await this.refresh();
        await vscode.window.showInformationMessage(t("showCurrentWorkspaceMessage"));
      }),
      vscode.commands.registerCommand("codexSessions.showAllWorkspaces", async () => {
        this.state.currentProjectOnly = false;
        await this.refresh();
        await vscode.window.showInformationMessage(t("showAllWorkspacesMessage"));
      }),
      vscode.commands.registerCommand("codexSessions.toggleArchived", async () => {
        this.state.showArchived = !this.state.showArchived;
        await this.refresh();
      }),
      vscode.commands.registerCommand("codexSessions.setSearchFilter", async () => {
        const value = await vscode.window.showInputBox({
          prompt: t("inputSearchFilter"),
          value: this.state.searchTerm
        });
        if (value !== undefined) {
          this.state.searchTerm = value.trim();
          await this.refresh();
        }
      }),
      vscode.commands.registerCommand("codexSessions.clearSearchFilter", async () => {
        this.state.searchTerm = "";
        await this.refresh();
      }),
      vscode.commands.registerCommand("codexSessions.openInOfficialCodex", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await this.openPrimarySessionTarget(session);
      }),
      vscode.commands.registerCommand("codexSessions.openDetails", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await this.detailsProvider.open(session);
      }),
      vscode.commands.registerCommand("codexSessions.setAlias", async (node?: SessionNode) => {
        await this.editMetadata(node, "alias", "Set local alias", "alias");
      }),
      vscode.commands.registerCommand("codexSessions.setProjectTag", async (node?: SessionNode) => {
        await this.editMetadata(node, "projectTag", "Set local project tag", "project tag");
      }),
      vscode.commands.registerCommand("codexSessions.setNote", async (node?: SessionNode) => {
        await this.editMetadata(node, "note", "Set local note", "note");
      }),
      vscode.commands.registerCommand("codexSessions.resumeInTerminal", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await this.runSafe(async () => {
          this.cliService.resumeInTerminal(session);
        });
      }),
      vscode.commands.registerCommand("codexSessions.archiveSession", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await this.runSafe(async () => {
          await this.cliService.archive(session);
          await this.refresh();
        });
      }),
      vscode.commands.registerCommand("codexSessions.unarchiveSession", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await this.runSafe(async () => {
          await this.unarchiveSessionWithFallback(session);
          await this.refresh();
        });
      }),
      vscode.commands.registerCommand("codexSessions.copySessionId", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await vscode.env.clipboard.writeText(session.sessionId);
      }),
      vscode.commands.registerCommand("codexSessions.copyResumeCommand", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await vscode.env.clipboard.writeText(this.cliService.copyResumeCommand(session));
      }),
      vscode.commands.registerCommand("codexSessions.openSessionWorkspace", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session?.cwd) {
          return;
        }
        await this.runSafe(async () => {
          if (!fs.existsSync(session.cwd)) {
            throw new Error(t("workspacePathMissing", { path: session.cwd }));
          }
          await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(session.cwd), {
            forceNewWindow: false
          });
        });
      }),
      vscode.commands.registerCommand("codexSessions.revealSessionFile", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session?.path) {
          return;
        }
        await this.runSafe(async () => {
          if (!fs.existsSync(session.path)) {
            throw new Error(`session file not found: ${session.path}`);
          }
          await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(session.path));
        });
      }),
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (!event.affectsConfiguration(EXTENSION_NAMESPACE)) {
          return;
        }
        this.settings = getCurrentSettings();
        this.state.currentProjectOnly = this.state.currentProjectOnly && this.settings.currentProjectOnlyDefault ? true : this.state.currentProjectOnly;
        this.scheduleRefreshLoop();
        await this.refresh();
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await this.refresh();
      }),
      this.treeView.onDidChangeVisibility(async (event) => {
        if (!event.visible || !this.settings.focusCurrentWorkspaceOnViewOpen || this.state.currentProjectOnly) {
          return;
        }
        this.state.currentProjectOnly = true;
        await this.refresh();
      })
    );

    this.scheduleRefreshLoop();
    await this.refresh();
    await this.openPendingSessionAfterWorkspaceSwitch();
  }

  public dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.repository.dispose();
  }

  private scheduleRefreshLoop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, Math.max(5, this.settings.refreshIntervalSeconds) * 1000);
  }

  private async refresh(): Promise<void> {
    try {
      const snapshot = await this.repository.load(this.state, this.settings);
      const groups = this.repository.buildGroups(snapshot);
      this.treeProvider.setSnapshot(snapshot, groups);
      this.treeView.message = this.buildViewMessage(snapshot);
      await vscode.commands.executeCommand("setContext", "codexSessions.currentProjectOnly", this.state.currentProjectOnly);
      await vscode.commands.executeCommand("setContext", "codexSessions.showArchived", this.state.showArchived);
    } catch (error) {
      this.output.appendLine(`[extension] refresh failed: ${String(error)}`);
      this.treeView.message = `Load failed: ${String(error)}`;
    }
  }

  private buildViewMessage(snapshot: { sourceMode: string; cliAvailable: boolean; warning: string; searchTerm: string }): string {
    const parts = [`source=${snapshot.sourceMode}`];
    parts.push(snapshot.cliAvailable ? "cli=ready" : "cli=missing");
    parts.push(hasOfficialCodexExtension() ? t("officialReady") : t("officialMissing"));
    if (this.state.currentProjectOnly) {
      parts.push(t("currentGroupLabel"));
    } else {
      parts.push(t("allWorkspacesLabel"));
    }
    if (this.state.showArchived) {
      parts.push(t("archivedGroupLabel"));
    }
    if (snapshot.searchTerm) {
      parts.push(`${t("searchLabel")}=${snapshot.searchTerm}`);
    }
    if (snapshot.warning) {
      parts.push(t("fallbackActive"));
    }
    return parts.join(" | ");
  }

  private pickSession(node?: SessionNode): SessionRecord | null {
    if (node instanceof SessionNode) {
      return node.session;
    }
    const selection = this.treeView.selection[0];
    if (selection instanceof SessionNode) {
      return selection.session;
    }
    return null;
  }

  private async editMetadata(
    node: SessionNode | undefined,
    field: "alias" | "projectTag" | "note",
    prompt: string,
    placeHolder: string
  ): Promise<void> {
    const session = this.pickSession(node);
    if (!session) {
      return;
    }
    const value = await vscode.window.showInputBox({
      prompt,
      value: session.local[field],
      placeHolder
    });
    if (value === undefined) {
      return;
    }
    await this.metadataStore.update(session.sessionId, { [field]: value.trim() });
    await this.refresh();
  }

  private async openPrimarySessionTarget(session: SessionRecord): Promise<void> {
    if (session.archived) {
      await this.runSafe(async () => {
        await vscode.window.showInformationMessage(t("unarchivingBeforeOpen"));
        await this.unarchiveSessionWithFallback(session);
        await this.refresh();
      });
    }

    const switchedWorkspace = await this.switchWorkspaceForSessionIfNeeded(session);
    if (switchedWorkspace) {
      return;
    }

    if (!hasOfficialCodexExtension()) {
      await this.detailsProvider.open(session);
      await vscode.window.showWarningMessage(t("missingOfficial"));
      return;
    }

    try {
      const opened = await openOfficialCodexConversation(session.sessionId);
      if (!opened) {
        throw new Error(`VS Code rejected ${buildOfficialCodexConversationUri(session.sessionId).toString()}`);
      }
    } catch (error) {
      const message = String(error);
      this.output.appendLine(`[extension] official open failed, fallback to details: ${message}`);
      await this.detailsProvider.open(session);
      await vscode.window.showWarningMessage(t("officialOpenFailed"));
    }
  }

  private async unarchiveSessionWithFallback(session: SessionRecord): Promise<void> {
    try {
      await this.cliService.unarchive(session);
      return;
    } catch (error) {
      this.output.appendLine(`[extension] cli unarchive failed, trying filesystem fallback: ${String(error)}`);
    }

    const moved = this.unarchiveSessionFile(session);
    if (!moved) {
      throw new Error(t("unarchiveFailed", { sessionId: session.sessionId }));
    }
    this.output.appendLine(`[extension] filesystem unarchive fallback moved ${session.sessionId}`);
  }

  private unarchiveSessionFile(session: SessionRecord): boolean {
    const sourcePath = this.findArchivedSessionPath(session);
    if (!sourcePath) {
      return false;
    }

    const fileName = path.basename(sourcePath);
    const match = fileName.match(ROLLOUT_FILE_PATTERN);
    if (!match) {
      return false;
    }

    const codexHome = this.settings.codexHomeOverride.trim() || path.join(os.homedir(), ".codex");
    const sessionsRoot = path.resolve(codexHome, "sessions");
    const targetDir = path.resolve(sessionsRoot, match[1] ?? "", match[2] ?? "", match[3] ?? "");
    const targetPath = path.resolve(targetDir, fileName);

    if (!isPathInside(targetPath, sessionsRoot) || !isPathInside(sourcePath, path.resolve(codexHome, "archived_sessions"))) {
      return false;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    if (fs.existsSync(targetPath)) {
      fs.rmSync(sourcePath, { force: true });
      return true;
    }

    fs.renameSync(sourcePath, targetPath);
    return true;
  }

  private findArchivedSessionPath(session: SessionRecord): string {
    if (session.path && fs.existsSync(session.path) && session.path.includes("archived_sessions")) {
      return session.path;
    }

    const codexHome = this.settings.codexHomeOverride.trim() || path.join(os.homedir(), ".codex");
    const archivedRoot = path.join(codexHome, "archived_sessions");
    if (!fs.existsSync(archivedRoot)) {
      return "";
    }

    const stack = [archivedRoot];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const resolved = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(resolved);
          continue;
        }
        if (entry.isFile() && entry.name.includes(session.sessionId) && entry.name.endsWith(".jsonl")) {
          return resolved;
        }
      }
    }
    return "";
  }

  private currentWindowContainsWorkspace(workspacePath: string): boolean {
    const target = toDisplayPath(workspacePath);
    return (vscode.workspace.workspaceFolders ?? []).some((folder) => isPathInside(target, folder.uri.fsPath));
  }

  private async switchWorkspaceForSessionIfNeeded(session: SessionRecord): Promise<boolean> {
    const workspacePath = toDisplayPath(session.workspaceRoot || session.cwd);
    if (!workspacePath || this.currentWindowContainsWorkspace(workspacePath) || !fs.existsSync(workspacePath)) {
      return false;
    }

    let isDirectory = false;
    try {
      isDirectory = fs.statSync(workspacePath).isDirectory();
    } catch {
      isDirectory = false;
    }
    if (!isDirectory) {
      return false;
    }

    await this.context.globalState.update(PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY, {
      sessionId: session.sessionId,
      workspacePath,
      createdAt: Date.now()
    } satisfies PendingOpenAfterWorkspaceSwitch);

    await vscode.window.showInformationMessage(t("switchingWorkspaceForSession", { path: workspacePath }));
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspacePath), {
      forceNewWindow: false
    });
    return true;
  }

  private async openPendingSessionAfterWorkspaceSwitch(): Promise<void> {
    const pending = this.context.globalState.get<PendingOpenAfterWorkspaceSwitch>(PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY);
    if (!pending) {
      return;
    }

    if (Date.now() - pending.createdAt > PENDING_OPEN_MAX_AGE_MS) {
      await this.context.globalState.update(PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY, undefined);
      return;
    }

    if (!this.currentWindowContainsWorkspace(pending.workspacePath)) {
      return;
    }

    await this.context.globalState.update(PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY, undefined);
    if (!hasOfficialCodexExtension()) {
      await vscode.window.showWarningMessage(t("missingOfficial"));
      return;
    }

    try {
      const opened = await openOfficialCodexConversation(pending.sessionId);
      if (!opened) {
        throw new Error(`VS Code rejected ${buildOfficialCodexConversationUri(pending.sessionId).toString()}`);
      }
    } catch (error) {
      const message = String(error);
      this.output.appendLine(`[extension] pending official open failed: ${message}`);
      await vscode.window.showWarningMessage(t("officialOpenFailed"));
    }
  }

  private async runSafe(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      const message = String(error);
      this.output.appendLine(`[extension] action failed: ${message}`);
      await vscode.window.showErrorMessage(message);
    }
  }
}

let controller: SessionManagerController | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  configureLanguage(vscode.env.language);
  controller = new SessionManagerController(context);
  await controller.activate();
}

export function deactivate(): void {
  controller?.dispose();
  controller = null;
}
