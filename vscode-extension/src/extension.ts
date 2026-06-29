import * as vscode from "vscode";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CodexCliService } from "./actions/codexCliService";
import { EXTENSION_NAMESPACE, INLINE_SEARCH_VIEW_ID, VIEW_ID } from "./constants";
import { getCurrentSettings, SessionRepository } from "./data/sessionRepository";
import { MetadataStore } from "./storage/metadataStore";
import { SessionSnapshotCache } from "./storage/sessionSnapshotCache";
import { SessionNode, SessionTreeProvider } from "./tree/sessionTreeProvider";
import { ExtensionSettings, RepositorySnapshot, SessionFilterState, SessionRecord } from "./types";
import {
  buildOfficialCodexConversationUri,
  hasOfficialCodexExtension,
  openOfficialCodexConversation
} from "./utils/officialCodex";
import { configureLanguage, t } from "./utils/i18n";
import { isPathInside, toDisplayPath } from "./utils/pathUtils";
import { deleteSessionFile, unarchiveSessionFile } from "./utils/sessionFiles";
import { SessionDetailsProvider } from "./view/sessionDetailsProvider";
import { MetadataField, SessionInlineSearchProvider } from "./view/sessionInlineSearchProvider";

const PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY = "pendingOpenAfterWorkspaceSwitch";
const PENDING_OPEN_MAX_AGE_MS = 2 * 60 * 1000;
const OFFICIAL_OPEN_RETRY_COUNT = 6;
const OFFICIAL_OPEN_RETRY_DELAY_MS = 750;

interface PendingOpenAfterWorkspaceSwitch {
  sessionId: string;
  workspacePath: string;
  createdAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class SessionManagerController {
  private readonly output = vscode.window.createOutputChannel("Codex Session Manager");
  private readonly metadataStore: MetadataStore;
  private readonly snapshotCache: SessionSnapshotCache;
  private settings: ExtensionSettings;
  private state: SessionFilterState;
  private readonly cliService: CodexCliService;
  private readonly repository: SessionRepository;
  private readonly treeProvider = new SessionTreeProvider();
  private readonly inlineSearchProvider: SessionInlineSearchProvider;
  private readonly detailsProvider: SessionDetailsProvider;
  private readonly treeView: vscode.TreeView<SessionNode | unknown>;
  private refreshTimer: NodeJS.Timeout | null = null;
  private fullSnapshot: RepositorySnapshot | null = null;
  private refreshPromise: Promise<void> | null = null;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.metadataStore = new MetadataStore(context);
    this.snapshotCache = new SessionSnapshotCache(context, this.output);
    this.settings = getCurrentSettings();
    this.state = {
      currentProjectOnly: this.settings.currentProjectOnlyDefault,
      showArchived: this.settings.showArchivedDefault,
      searchTerm: ""
    };
    this.cliService = new CodexCliService(this.settings, this.output);
    this.repository = new SessionRepository(this.settings, this.metadataStore, this.cliService, this.output);
    this.detailsProvider = new SessionDetailsProvider(this.repository, () => this.settings);
    this.inlineSearchProvider = new SessionInlineSearchProvider({
      onSearchChanged: async (value) => {
        this.state.searchTerm = value.trim();
        await this.renderCurrentSnapshotOrRefresh();
      },
      onToggleCurrentProjectOnly: async () => {
        this.state.currentProjectOnly = !this.state.currentProjectOnly;
        await this.renderCurrentSnapshotOrRefresh();
      },
      onToggleArchived: async () => {
        this.state.showArchived = !this.state.showArchived;
        await this.renderCurrentSnapshotOrRefresh();
      },
      onClearSearch: async () => {
        this.state.searchTerm = "";
        await this.renderCurrentSnapshotOrRefresh();
      },
      onRefresh: async () => {
        await this.refresh();
      },
      onOpenOfficial: async (sessionId) => {
        await this.openSessionById(sessionId, "official");
      },
      onOpenDetails: async (sessionId) => {
        await this.openSessionById(sessionId, "details");
      },
      onSaveMetadata: async (sessionId, field, value) => {
        await this.saveMetadataById(sessionId, field, value);
      }
    });
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
      vscode.window.registerWebviewViewProvider(INLINE_SEARCH_VIEW_ID, this.inlineSearchProvider, {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }),
      vscode.commands.registerCommand("codexSessions.refresh", async () => {
        await this.refresh();
      }),
      vscode.commands.registerCommand("codexSessions.toggleCurrentProjectOnly", async () => {
        this.state.currentProjectOnly = !this.state.currentProjectOnly;
        await this.renderCurrentSnapshotOrRefresh();
      }),
      vscode.commands.registerCommand("codexSessions.showCurrentWorkspace", async () => {
        this.state.currentProjectOnly = true;
        await this.renderCurrentSnapshotOrRefresh();
        await vscode.window.showInformationMessage(t("showCurrentWorkspaceMessage"));
      }),
      vscode.commands.registerCommand("codexSessions.showAllWorkspaces", async () => {
        this.state.currentProjectOnly = false;
        await this.renderCurrentSnapshotOrRefresh();
        await vscode.window.showInformationMessage(t("showAllWorkspacesMessage"));
      }),
      vscode.commands.registerCommand("codexSessions.toggleArchived", async () => {
        this.state.showArchived = !this.state.showArchived;
        await this.renderCurrentSnapshotOrRefresh();
      }),
      vscode.commands.registerCommand("codexSessions.setSearchFilter", async () => {
        await this.focusInlineSearch();
      }),
      vscode.commands.registerCommand("codexSessions.clearSearchFilter", async () => {
        this.state.searchTerm = "";
        await this.renderCurrentSnapshotOrRefresh();
      }),
      vscode.commands.registerCommand("codexSessions.searchAndOpenSession", async () => {
        await this.focusInlineSearch();
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
        await this.editMetadata(node, "alias");
      }),
      vscode.commands.registerCommand("codexSessions.setProjectTag", async (node?: SessionNode) => {
        await this.editMetadata(node, "projectTag");
      }),
      vscode.commands.registerCommand("codexSessions.setNote", async (node?: SessionNode) => {
        await this.editMetadata(node, "note");
      }),
      vscode.commands.registerCommand("codexSessions.resumeInTerminal", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await this.runSafe(async () => {
          this.cliService.resumeInTerminal(session);
          await vscode.window.showInformationMessage(t("resumeStarted"));
        });
      }),
      vscode.commands.registerCommand("codexSessions.forkInTerminal", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await this.runSafe(async () => {
          this.cliService.forkInTerminal(session);
          await vscode.window.showInformationMessage(t("forkStarted"));
        });
      }),
      vscode.commands.registerCommand("codexSessions.togglePinSession", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        if (session.desktopPinned && !session.local.pinned) {
          await vscode.window.showInformationMessage(t("desktopPinnedManagedByDesktop", { title: session.displayName }));
          return;
        }
        const nextPinned = !session.local.pinned;
        await this.metadataStore.update(this.metadataKeyFor(session), { pinned: nextPinned });
        await this.renderCurrentSnapshotOrRefresh();
        await this.writeCurrentSnapshotCache();
        const messageKey = nextPinned
          ? "sessionPinned"
          : session.desktopPinned
            ? "sessionLocalUnpinnedDesktopStillPinned"
            : "sessionUnpinned";
        await vscode.window.showInformationMessage(t(messageKey, { title: session.displayName }));
      }),
      vscode.commands.registerCommand("codexSessions.toggleUnreadSession", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        const nextUnread = !session.local.unread;
        await this.metadataStore.update(this.metadataKeyFor(session), { unread: nextUnread });
        await this.renderCurrentSnapshotOrRefresh();
        await this.writeCurrentSnapshotCache();
        await vscode.window.showInformationMessage(t(nextUnread ? "sessionMarkedUnread" : "sessionMarkedRead", { title: session.displayName }));
      }),
      vscode.commands.registerCommand("codexSessions.archiveSession", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await this.runSafe(async () => {
          await this.cliService.archive(session);
          await this.refresh();
          await vscode.window.showInformationMessage(t("sessionArchivedMessage", { title: session.displayName }));
        });
      }),
      vscode.commands.registerCommand("codexSessions.unarchiveSession", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        const confirmed = await this.confirmSessionAction(
          t("unarchiveSessionConfirmMessage", { title: session.displayName }),
          t("unarchiveSessionConfirmButton")
        );
        if (!confirmed) {
          return;
        }
        await this.runSafe(async () => {
          await this.unarchiveSessionWithFallback(session);
          await this.refresh();
          await vscode.window.showInformationMessage(t("sessionUnarchivedMessage", { title: session.displayName }));
        });
      }),
      vscode.commands.registerCommand("codexSessions.deleteSession", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        if (!session.archived) {
          await vscode.window.showWarningMessage(t("deleteOnlyArchived"));
          return;
        }
        const confirmed = await this.confirmSessionAction(
          t("deleteSessionConfirmMessage", { title: session.displayName }),
          t("deleteSessionConfirmButton"),
          t("deleteSessionConfirmDetail")
        );
        if (!confirmed) {
          return;
        }
        await this.runSafe(async () => {
          const deletedPath = deleteSessionFile(session, { codexHome: this.getCodexHome() });
          if (!deletedPath) {
            throw new Error(t("deleteSessionFailed", { sessionId: session.sessionId }));
          }
          this.output.appendLine(`[extension] deleted archived session ${session.sessionId}: ${deletedPath}`);
          await this.metadataStore.delete(this.metadataKeyFor(session));
          await this.refresh();
          await vscode.window.showInformationMessage(t("deleteSessionSucceeded", { title: session.displayName }));
        });
      }),
      vscode.commands.registerCommand("codexSessions.copySessionId", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await vscode.env.clipboard.writeText(session.sessionId);
      }),
      vscode.commands.registerCommand("codexSessions.copyWorkingDirectory", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await vscode.env.clipboard.writeText(session.cwd || session.workspaceRoot || "");
      }),
      vscode.commands.registerCommand("codexSessions.copyDeepLink", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session) {
          return;
        }
        await vscode.env.clipboard.writeText(buildOfficialCodexConversationUri(session.sessionId).toString());
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
        const targetPath = session?.workspaceRoot || session?.cwd || "";
        if (!targetPath) {
          await vscode.window.showWarningMessage(t("workingDirectoryMissing"));
          return;
        }
        await this.runSafe(async () => {
          if (!fs.existsSync(targetPath)) {
            throw new Error(t("workspacePathMissing", { path: targetPath }));
          }
          await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(targetPath), false);
        });
      }),
      vscode.commands.registerCommand("codexSessions.openSessionWorkspaceNewWindow", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        const targetPath = session?.workspaceRoot || session?.cwd || "";
        if (!targetPath) {
          await vscode.window.showWarningMessage(t("workingDirectoryMissing"));
          return;
        }
        await this.runSafe(async () => {
          if (!fs.existsSync(targetPath)) {
            throw new Error(t("workspacePathMissing", { path: targetPath }));
          }
          await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(targetPath), true);
        });
      }),
      vscode.commands.registerCommand("codexSessions.revealSessionWorkspace", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        const targetPath = session?.workspaceRoot || session?.cwd || "";
        if (!targetPath) {
          await vscode.window.showWarningMessage(t("workingDirectoryMissing"));
          return;
        }
        await this.runSafe(async () => {
          if (!fs.existsSync(targetPath)) {
            throw new Error(t("workspacePathMissing", { path: targetPath }));
          }
          await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(targetPath));
        });
      }),
      vscode.commands.registerCommand("codexSessions.revealSessionFile", async (node?: SessionNode) => {
        const session = this.pickSession(node);
        if (!session?.path) {
          await vscode.window.showWarningMessage(t("sessionFileMissing"));
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
        this.cliService.updateSettings(this.settings);
        this.repository.updateSettings(this.settings);
        this.state.currentProjectOnly = this.state.currentProjectOnly && this.settings.currentProjectOnlyDefault ? true : this.state.currentProjectOnly;
        this.scheduleRefreshLoop();
        await this.renderCurrentSnapshotOrRefresh();
        this.refreshInBackground("configuration");
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await this.renderCurrentSnapshotOrCache();
        this.refreshInBackground("workspaceFolders");
        await this.openPendingSessionAfterWorkspaceSwitch();
      }),
      this.treeView.onDidChangeVisibility(async (event) => {
        if (!event.visible || !this.settings.focusCurrentWorkspaceOnViewOpen || this.state.currentProjectOnly) {
          return;
        }
        this.state.currentProjectOnly = true;
        await this.renderCurrentSnapshotOrRefresh();
      })
    );

    this.scheduleRefreshLoop();
    await this.renderCachedSnapshotIfAvailable();
    await this.openPendingSessionAfterWorkspaceSwitch();
    this.refreshInBackground("activate");
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
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = this.refreshFromSource();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private refreshInBackground(reason: string): void {
    this.output.appendLine(`[extension] background refresh requested: ${reason}`);
    void this.refresh();
  }

  private async refreshFromSource(): Promise<void> {
    try {
      const snapshot = await this.repository.loadFull(this.settings);
      await this.renderFullSnapshot(snapshot, false);
      if (this.settings.enableDiskCache && this.fullSnapshot) {
        await this.snapshotCache.write(this.fullSnapshot);
      }
    } catch (error) {
      this.output.appendLine(`[extension] refresh failed: ${String(error)}`);
      this.treeView.message = `Load failed: ${String(error)}`;
    }
  }

  private async renderCurrentSnapshotOrRefresh(): Promise<void> {
    if (await this.renderCurrentSnapshotOrCache()) {
      return;
    }
    await this.refresh();
  }

  private async renderCurrentSnapshotOrCache(): Promise<boolean> {
    if (this.fullSnapshot) {
      await this.renderFullSnapshot(this.fullSnapshot, true);
      return true;
    }
    return await this.renderCachedSnapshotIfAvailable();
  }

  private async renderCachedSnapshotIfAvailable(): Promise<boolean> {
    if (!this.settings.enableDiskCache) {
      return false;
    }

    const cached = await this.snapshotCache.read();
    if (!cached) {
      return false;
    }

    await this.renderFullSnapshot(cached, true);
    return true;
  }

  private async renderFullSnapshot(snapshot: RepositorySnapshot, cached: boolean): Promise<void> {
    this.fullSnapshot = this.repository.rehydrateSnapshot(snapshot);
    const visibleSnapshot = this.repository.filterSnapshot(this.fullSnapshot, this.state);
    const groups = this.repository.buildGroups(visibleSnapshot);
    this.treeProvider.setSnapshot(visibleSnapshot, groups);
    this.treeView.message = this.buildViewMessage(visibleSnapshot, cached);
    this.inlineSearchProvider.setSnapshot(
      visibleSnapshot,
      { ...this.state },
      this.treeView.message ?? "",
      this.fullSnapshot?.sessions.length ?? visibleSnapshot.sessions.length
    );
    await vscode.commands.executeCommand("setContext", "codexSessions.currentProjectOnly", this.state.currentProjectOnly);
    await vscode.commands.executeCommand("setContext", "codexSessions.showArchived", this.state.showArchived);
  }

  private async writeCurrentSnapshotCache(): Promise<void> {
    if (!this.settings.enableDiskCache || !this.fullSnapshot) {
      return;
    }
    await this.snapshotCache.write(this.fullSnapshot);
  }

  private buildViewMessage(snapshot: { sourceMode: string; cliAvailable: boolean; warning: string; searchTerm: string }, cached = false): string {
    const parts = [`source=${snapshot.sourceMode}`];
    if (cached) {
      parts.push(t("cachedSnapshotLabel"));
    }
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

  private async editMetadata(node: SessionNode | undefined, field: MetadataField): Promise<void> {
    const session = this.pickSession(node);
    if (!session) {
      return;
    }
    await this.focusInlineEditor(session, field);
  }

  private metadataKeyFor(session: SessionRecord): string {
    return session.sessionId || session.id;
  }

  private async focusInlineSearch(): Promise<void> {
    await vscode.commands.executeCommand("workbench.view.extension.codexSessions");
    try {
      await vscode.commands.executeCommand(`${INLINE_SEARCH_VIEW_ID}.focus`);
    } catch (error) {
      this.output.appendLine(`[extension] inline search focus command failed: ${String(error)}`);
    }
    this.inlineSearchProvider.focusSearch();
  }

  private async focusInlineEditor(session: SessionRecord, field: MetadataField): Promise<void> {
    await vscode.commands.executeCommand("workbench.view.extension.codexSessions");
    try {
      await vscode.commands.executeCommand(`${INLINE_SEARCH_VIEW_ID}.focus`);
    } catch (error) {
      this.output.appendLine(`[extension] inline editor focus command failed: ${String(error)}`);
    }
    this.inlineSearchProvider.beginEdit(session.sessionId || session.id, field);
  }

  private findSessionById(sessionId: string): SessionRecord | null {
    const snapshots = [this.fullSnapshot, this.treeProvider.getSnapshot()].filter(Boolean) as RepositorySnapshot[];
    for (const snapshot of snapshots) {
      const session = snapshot.sessions.find((item) => item.sessionId === sessionId || item.id === sessionId);
      if (session) {
        return session;
      }
    }
    return null;
  }

  private async openSessionById(sessionId: string, target: "official" | "details"): Promise<void> {
    const session = this.findSessionById(sessionId);
    if (!session) {
      await vscode.window.showWarningMessage(t("sessionNotFoundMessage", { sessionId }));
      return;
    }
    if (target === "details") {
      await this.detailsProvider.open(session);
      return;
    }
    await this.openPrimarySessionTarget(session);
  }

  private async saveMetadataById(sessionId: string, field: MetadataField, value: string): Promise<void> {
    const session = this.findSessionById(sessionId);
    if (!session) {
      await vscode.window.showWarningMessage(t("sessionNotFoundMessage", { sessionId }));
      return;
    }
    const nextValue = value.trim();
    await this.metadataStore.update(this.metadataKeyFor(session), { [field]: nextValue });
    await this.renderCurrentSnapshotOrRefresh();
    await this.writeCurrentSnapshotCache();
    if (field === "alias") {
      await vscode.window.showInformationMessage(t("sessionRenamedMessage", { title: nextValue || session.displayName }));
      return;
    }
    await vscode.window.showInformationMessage(
      t("metadataSavedMessage", { title: session.displayName, label: this.metadataFieldMessageLabel(field) })
    );
  }

  private metadataFieldMessageLabel(field: MetadataField): string {
    switch (field) {
      case "alias":
        return t("inlineAliasLabel");
      case "projectTag":
        return t("inlineProjectTagLabel");
      case "note":
        return t("inlineNoteLabel");
    }
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

    await this.openOfficialConversationOrFallback(session);
  }

  private async openOfficialConversationOrFallback(session: SessionRecord): Promise<void> {
    try {
      await this.openOfficialConversationWithRetry(session.sessionId);
    } catch (error) {
      const message = String(error);
      this.output.appendLine(`[extension] official open failed, fallback to details: ${message}`);
      await this.detailsProvider.open(session);
      await vscode.window.showWarningMessage(t("officialOpenFailed"));
    }
  }

  private async openOfficialConversationWithRetry(sessionId: string): Promise<void> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= OFFICIAL_OPEN_RETRY_COUNT; attempt += 1) {
      try {
        const opened = await openOfficialCodexConversation(sessionId);
        if (!opened) {
          throw new Error(`VS Code rejected ${buildOfficialCodexConversationUri(sessionId).toString()}`);
        }
        return;
      } catch (error) {
        lastError = error;
        this.output.appendLine(`[extension] official open attempt ${attempt}/${OFFICIAL_OPEN_RETRY_COUNT} failed: ${String(error)}`);
        if (attempt < OFFICIAL_OPEN_RETRY_COUNT) {
          await sleep(OFFICIAL_OPEN_RETRY_DELAY_MS);
        }
      }
    }
    throw lastError ?? new Error(t("officialOpenFailed"));
  }

  private async unarchiveSessionWithFallback(session: SessionRecord): Promise<void> {
    try {
      await this.cliService.unarchive(session);
      return;
    } catch (error) {
      this.output.appendLine(`[extension] cli unarchive failed, trying filesystem fallback: ${String(error)}`);
    }

    const moved = unarchiveSessionFile(session, { codexHome: this.getCodexHome() });
    if (!moved) {
      throw new Error(t("unarchiveFailed", { sessionId: session.sessionId }));
    }
    this.output.appendLine(`[extension] filesystem unarchive fallback moved ${session.sessionId}`);
  }

  private getCodexHome(): string {
    return this.settings.codexHomeOverride.trim() || path.join(os.homedir(), ".codex");
  }

  private async confirmSessionAction(message: string, confirmLabel: string, detail?: string): Promise<boolean> {
    const selected = await vscode.window.showWarningMessage(message, { modal: true, detail }, confirmLabel);
    return selected === confirmLabel;
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

    void vscode.window.showInformationMessage(t("switchingWorkspaceForSession", { path: workspacePath }));
    await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspacePath), false);
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

    if (!hasOfficialCodexExtension()) {
      await this.context.globalState.update(PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY, undefined);
      await vscode.window.showWarningMessage(t("missingOfficial"));
      return;
    }

    try {
      await this.openOfficialConversationWithRetry(pending.sessionId);
      await this.context.globalState.update(PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY, undefined);
    } catch (error) {
      const message = String(error);
      this.output.appendLine(`[extension] pending official open failed: ${message}`);
      await this.context.globalState.update(PENDING_OPEN_AFTER_WORKSPACE_SWITCH_KEY, undefined);
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
