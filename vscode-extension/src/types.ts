export type DataSourceMode = "auto" | "appServerOnly" | "filesystemOnly";
export type DetailTurnFetchMode = "summary" | "full";

export type SessionSourceKind =
  | "vscode"
  | "cli"
  | "exec"
  | "appServer"
  | "subAgent"
  | "subAgentReview"
  | "subAgentCompact"
  | "subAgentThreadSpawn"
  | "subAgentOther"
  | "unknown"
  | "filesystem";

export interface ExtensionSettings {
  dataSourceMode: DataSourceMode;
  currentProjectOnlyDefault: boolean;
  showArchivedDefault: boolean;
  includeExecSessions: boolean;
  includeSubagentSessions: boolean;
  refreshIntervalSeconds: number;
  detailTurnFetchMode: DetailTurnFetchMode;
  codexHomeOverride: string;
  codexCliPath: string;
  focusCurrentWorkspaceOnViewOpen: boolean;
  enableDiskCache: boolean;
}

export interface LocalSessionMetadata {
  alias: string;
  projectTag: string;
  note: string;
  pinned?: boolean;
  unread?: boolean;
}

export interface Logger {
  appendLine(value: string): void;
}

export interface AppServerThreadSummary {
  id: string;
  sessionId: string;
  preview: string;
  name: string | null;
  cwd: string;
  path: string | null;
  source: SessionSourceKind;
  createdAt: number | null;
  updatedAt: number | null;
  modelProvider: string | null;
  cliVersion: string | null;
  gitBranch: string | null;
  gitSha: string | null;
  archived: boolean;
}

export interface AppServerThreadDetail extends AppServerThreadSummary {
  turns: SessionTurn[];
}

export interface SessionTurn {
  id: string;
  status: string | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  items: SessionTurnItem[];
}

export type SessionTurnItemType =
  | "userMessage"
  | "agentMessage"
  | "toolCall"
  | "toolOutput"
  | "webSearch"
  | "other";

export interface SessionTurnItem {
  type: SessionTurnItemType;
  label: string;
  text: string;
}

export interface RawSessionRecord {
  id: string;
  sessionId: string;
  preview: string;
  name: string;
  cwd: string;
  path: string;
  source: SessionSourceKind;
  createdAt: number | null;
  updatedAt: number | null;
  archived: boolean;
  modelProvider: string;
  cliVersion: string;
  gitBranch: string;
  gitSha: string;
}

export interface SessionRecord extends RawSessionRecord {
  local: LocalSessionMetadata;
  displayName: string;
  workspaceRoot: string;
  projectKey: string;
  projectLabel: string;
  projectDescription: string;
  currentProject: boolean;
  sourceLabel: string;
  detailAvailable: boolean;
}

export interface RepositorySnapshot {
  sessions: SessionRecord[];
  sourceMode: "appServer" | "filesystem";
  cliAvailable: boolean;
  currentWorkspaceRoots: string[];
  searchTerm: string;
  lastUpdatedAt: string;
  warning: string;
}

export interface SessionFilterState {
  currentProjectOnly: boolean;
  showArchived: boolean;
  searchTerm: string;
}

export interface SessionGroup {
  id: string;
  label: string;
  description: string;
  kind: "current" | "other" | "uncategorized" | "archived";
  sessions: SessionRecord[];
}

export interface ProjectBucket {
  id: string;
  label: string;
  description: string;
  sessions: SessionRecord[];
}

export interface FilesystemProviderOptions {
  codexHome: string;
  logger: Logger;
}
