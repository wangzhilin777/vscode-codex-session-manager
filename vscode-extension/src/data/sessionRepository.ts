import * as vscode from "vscode";
import { CodexCliService } from "../actions/codexCliService";
import { CodexAppServerClient } from "./appServerClient";
import { CodexFilesystemProvider } from "./filesystemProvider";
import { metadataForRawSession } from "./sessionMetadata";
import { buildGroups, dedupeRawSessions, filterSessions, resolveWorkspaceHint, toSessionRecord } from "./sessionTransforms";
import { MetadataStore } from "../storage/metadataStore";
import { ExtensionSettings, Logger, RawSessionRecord, RepositorySnapshot, SessionFilterState, SessionGroup, SessionRecord, SessionSourceKind } from "../types";
import { formatIsoNow } from "../utils/time";

function workspaceRoots(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

function listSourceKinds(settings: ExtensionSettings): SessionSourceKind[] {
  const kinds: SessionSourceKind[] = ["vscode", "cli", "appServer", "unknown"];
  if (settings.includeExecSessions) {
    kinds.push("exec");
  }
  if (settings.includeSubagentSessions) {
    kinds.push("subAgent", "subAgentReview", "subAgentCompact", "subAgentThreadSpawn", "subAgentOther");
  }
  return kinds;
}

export class SessionRepository {
  private readonly appServerClient: CodexAppServerClient;
  private readonly filesystemProvider: CodexFilesystemProvider;
  private readonly metadataStore: MetadataStore;
  private readonly cliService: CodexCliService;
  private readonly logger: Logger;

  public constructor(
    settings: ExtensionSettings,
    metadataStore: MetadataStore,
    cliService: CodexCliService,
    logger: Logger
  ) {
    this.metadataStore = metadataStore;
    this.cliService = cliService;
    this.logger = logger;
    this.appServerClient = new CodexAppServerClient(settings, logger);
    this.filesystemProvider = new CodexFilesystemProvider({
      codexHome: settings.codexHomeOverride,
      logger
    });
  }

  public async load(state: SessionFilterState, settings: ExtensionSettings): Promise<RepositorySnapshot> {
    const snapshot = await this.loadFull(settings);
    return this.filterSnapshot(snapshot, state);
  }

  public async loadFull(settings: ExtensionSettings): Promise<RepositorySnapshot> {
    const currentRoots = workspaceRoots();
    const hints = this.filesystemProvider.getWorkspaceHints();
    const metadataById = this.metadataStore.getAll();
    const cliAvailable = await this.cliService.checkAvailability();

    let warning = "";
    let sourceMode: "appServer" | "filesystem" = "filesystem";
    let raws: RawSessionRecord[] = [];

    if (settings.dataSourceMode !== "filesystemOnly") {
      try {
        // Keep search local so extension-only metadata such as alias, note, project tag,
        // and normalized workspace paths participate in filtering consistently.
        raws = (await this.appServerClient.listThreads(listSourceKinds(settings), "")).map((thread) => ({
          id: thread.id,
          sessionId: thread.sessionId,
          preview: thread.preview,
          name: thread.name ?? "",
          cwd: thread.cwd,
          path: thread.path ?? "",
          source: thread.source,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
          archived: thread.archived,
          modelProvider: thread.modelProvider ?? "",
          cliVersion: thread.cliVersion ?? "",
          gitBranch: thread.gitBranch ?? "",
          gitSha: thread.gitSha ?? ""
        }));
        sourceMode = "appServer";
      } catch (error) {
        warning = `app-server unavailable, using filesystem fallback: ${String(error)}`;
        this.logger.appendLine(`[repository] ${warning}`);
        if (settings.dataSourceMode === "appServerOnly") {
          raws = [];
        }
      }
    }

    if (raws.length === 0 && settings.dataSourceMode !== "appServerOnly") {
      raws = this.filesystemProvider.listSessions();
      sourceMode = "filesystem";
    }

    const deduped = new Map<string, RawSessionRecord>();
    for (const raw of raws) {
      if (!raw.id) {
        continue;
      }
      const existing = deduped.get(raw.id);
      if (!existing || (raw.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
        deduped.set(raw.id, raw);
      }
    }

    const rawCount = raws.length;
    const idDeduped = [...deduped.values()];
    const rawDeduped = dedupeRawSessions(idDeduped);
    const archivedCount = rawDeduped.filter((raw) => raw.archived).length;

    const sessions = rawDeduped
      .map((raw) =>
        toSessionRecord(
          raw,
          metadataForRawSession(raw, metadataById),
          currentRoots,
          resolveWorkspaceHint(raw.id, raw.cwd, hints)
        )
      )
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
    this.logger.appendLine(
      [
        "[repository] load",
        `source=${sourceMode}`,
        `raw=${rawCount}`,
        `idDeduped=${idDeduped.length}`,
        `deduped=${rawDeduped.length}`,
        `archived=${archivedCount}`,
        `full=${sessions.length}`
      ].join(" ")
    );

    return {
      sessions,
      sourceMode,
      cliAvailable,
      currentWorkspaceRoots: currentRoots,
      searchTerm: "",
      lastUpdatedAt: formatIsoNow(),
      warning
    };
  }

  public filterSnapshot(snapshot: RepositorySnapshot, state: SessionFilterState): RepositorySnapshot {
    const sessions = filterSessions(snapshot.sessions, state);
    this.logger.appendLine(
      [
        "[repository] filter",
        `visible=${sessions.length}`,
        `showArchived=${state.showArchived}`,
        `currentProjectOnly=${state.currentProjectOnly}`,
        `search=${state.searchTerm || "<empty>"}`
      ].join(" ")
    );
    return {
      ...snapshot,
      sessions,
      searchTerm: state.searchTerm
    };
  }

  public rehydrateSnapshot(snapshot: RepositorySnapshot): RepositorySnapshot {
    const currentRoots = workspaceRoots();
    const metadataById = this.metadataStore.getAll();
    const sessions = snapshot.sessions
      .map((session) =>
        toSessionRecord(
          session,
          metadataForRawSession(session, metadataById),
          currentRoots,
          session.workspaceAssigned ? session.workspaceRoot || session.cwd : ""
        )
      )
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));

    return {
      ...snapshot,
      sessions,
      currentWorkspaceRoots: currentRoots,
      searchTerm: ""
    };
  }

  public buildGroups(snapshot: RepositorySnapshot): SessionGroup[] {
    return buildGroups(snapshot.sessions);
  }

  public async readThread(sessionId: string): Promise<SessionRecord | null> {
    const snapshot = await this.load(
      {
        currentProjectOnly: false,
        showArchived: true,
        searchTerm: ""
      },
      {
        ...getCurrentSettings(),
        currentProjectOnlyDefault: false,
        showArchivedDefault: true
      }
    );
    return snapshot.sessions.find((session) => session.sessionId === sessionId) ?? null;
  }

  public async readDetails(sessionId: string) {
    return await this.appServerClient.readThread(sessionId);
  }

  public dispose(): void {
    this.appServerClient.dispose();
  }
}

export function getCurrentSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration("codexSessionManager");
  return {
    dataSourceMode: config.get<ExtensionSettings["dataSourceMode"]>("dataSourceMode", "auto"),
    currentProjectOnlyDefault: config.get<boolean>("currentProjectOnlyDefault", false),
    showArchivedDefault: config.get<boolean>("showArchivedDefault", true),
    includeExecSessions: config.get<boolean>("includeExecSessions", true),
    includeSubagentSessions: config.get<boolean>("includeSubagentSessions", false),
    refreshIntervalSeconds: config.get<number>("refreshIntervalSeconds", 20),
    detailTurnFetchMode: config.get<ExtensionSettings["detailTurnFetchMode"]>("detailTurnFetchMode", "summary"),
    codexHomeOverride: config.get<string>("codexHomeOverride", ""),
    codexCliPath: config.get<string>("codexCliPath", "codex"),
    focusCurrentWorkspaceOnViewOpen: config.get<boolean>("focusCurrentWorkspaceOnViewOpen", false),
    enableDiskCache: config.get<boolean>("enableDiskCache", true)
  };
}
