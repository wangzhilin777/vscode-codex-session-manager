import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FilesystemProviderOptions, Logger, RawSessionRecord, SessionSourceKind } from "../types";
import { toDisplayPath } from "../utils/pathUtils";

interface SessionMetaHeader {
  id: string;
  cwd: string;
  source: SessionSourceKind;
  modelProvider: string;
  cliVersion: string;
  gitBranch: string;
  gitSha: string;
}

interface SessionIndexEntry {
  threadName: string;
  updatedAt: number | null;
  order: number;
}

const ROLLOUT_ID_PATTERN = /(?:^|[/\\])rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-([0-9a-fA-F-]{36})\.jsonl$/;

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function arrayOfStrings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readJsonLines(filePath: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8");
  const rows: Array<Record<string, unknown>> = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    try {
      rows.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      continue;
    }
  }
  return rows;
}

function walkJsonlFiles(rootPath: string, recursive: boolean): string[] {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const results: string[] = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          stack.push(resolved);
        }
        continue;
      }
      if (entry.isFile() && resolved.endsWith(".jsonl")) {
        results.push(resolved);
      }
    }
  }

  return results.sort();
}

function parseGitInfo(gitInfo: unknown): { branch: string; sha: string } {
  if (!gitInfo || typeof gitInfo !== "object") {
    return { branch: "", sha: "" };
  }

  const branch = typeof (gitInfo as { branch?: unknown }).branch === "string" ? (gitInfo as { branch: string }).branch : "";
  const sha = typeof (gitInfo as { sha?: unknown }).sha === "string" ? (gitInfo as { sha: string }).sha : "";
  return { branch, sha };
}

function parseSource(value: unknown): SessionSourceKind {
  const raw = typeof value === "string" ? value : "";
  switch (raw) {
    case "vscode":
    case "cli":
    case "exec":
    case "appServer":
    case "subAgent":
    case "subAgentReview":
    case "subAgentCompact":
    case "subAgentThreadSpawn":
    case "subAgentOther":
    case "unknown":
      return raw;
    default:
      return "filesystem";
  }
}

function parseSessionIdFromPath(filePath: string): string {
  const match = filePath.match(ROLLOUT_ID_PATTERN);
  return match?.[1] ?? "";
}

function textFromContentItem(item: unknown): string {
  if (!item || typeof item !== "object") {
    return "";
  }
  const typed = item as Record<string, unknown>;
  return typeof typed.text === "string" ? typed.text : "";
}

function normalizeUserTitleCandidate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const requestMarker = "## My request for Codex:";
  const requestIndex = trimmed.indexOf(requestMarker);
  const candidate = requestIndex >= 0 ? trimmed.slice(requestIndex + requestMarker.length) : trimmed;
  const withoutImageTags = candidate.replace(/<image[\s\S]*$/i, "").trim();
  const firstUsefulLine = withoutImageTags
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstUsefulLine) {
    return "";
  }

  const skippedPrefixes = [
    "# AGENTS.md instructions",
    "<environment_context>",
    "<turn_aborted>",
    "<permissions instructions>",
    "<collaboration_mode>",
    "<apps_instructions>",
    "<skills_instructions>",
    "<plugins_instructions>"
  ];
  if (skippedPrefixes.some((prefix) => firstUsefulLine.startsWith(prefix))) {
    return "";
  }

  return firstUsefulLine.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
}

function parseUserTitleFromRows(rows: Array<Record<string, unknown>>): string {
  for (const row of rows.slice(0, 300)) {
    const payload = row.payload as Record<string, unknown> | undefined;
    if (!payload) {
      continue;
    }

    if (payload.type === "user_message" && typeof payload.message === "string") {
      const title = normalizeUserTitleCandidate(payload.message);
      if (title) {
        return title;
      }
    }

    if (payload.type === "message" && payload.role === "user" && Array.isArray(payload.content)) {
      const title = normalizeUserTitleCandidate(payload.content.map(textFromContentItem).filter(Boolean).join("\n"));
      if (title) {
        return title;
      }
    }
  }

  return "";
}

function fileTimestamp(filePath: string): number | null {
  try {
    const stat = fs.statSync(filePath);
    const timestampMs = stat.mtimeMs || stat.ctimeMs;
    return Number.isFinite(timestampMs) && timestampMs > 0 ? timestampMs / 1000 : null;
  } catch {
    return null;
  }
}

function parseIndexUpdatedAt(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Date.parse(value) / 1000;
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldReplaceIndexEntry(next: SessionIndexEntry, current: SessionIndexEntry | undefined): boolean {
  if (!current) {
    return true;
  }
  const nextTime = next.updatedAt ?? 0;
  const currentTime = current.updatedAt ?? 0;
  if (nextTime !== currentTime) {
    return nextTime > currentTime;
  }
  return next.order > current.order;
}

function buildLatestIndexById(rows: Array<Record<string, unknown>>): Map<string, SessionIndexEntry> {
  const indexById = new Map<string, SessionIndexEntry>();

  rows.forEach((row, order) => {
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) {
      return;
    }

    const next: SessionIndexEntry = {
      threadName: typeof row.thread_name === "string" ? row.thread_name : "",
      updatedAt: parseIndexUpdatedAt(row.updated_at),
      order
    };
    const current = indexById.get(id);
    if (!shouldReplaceIndexEntry(next, current)) {
      return;
    }

    indexById.set(id, {
      ...next,
      threadName: next.threadName.trim() || current?.threadName || ""
    });
  });

  return indexById;
}

function parseSessionMetaFromRows(rows: Array<Record<string, unknown>>): SessionMetaHeader {
  for (const row of rows.slice(0, 20)) {
    const type = typeof row.type === "string" ? row.type : "";
    if (type === "session_meta") {
      const payload = row.payload as Record<string, unknown> | undefined;
      const git = parseGitInfo(payload?.git_info);
      return {
        id: typeof payload?.id === "string" ? payload.id : "",
        cwd: typeof payload?.cwd === "string" ? payload.cwd : "",
        source: parseSource(payload?.source),
        modelProvider: typeof payload?.model_provider === "string" ? payload.model_provider : "",
        cliVersion: typeof payload?.cli_version === "string" ? payload.cli_version : "",
        gitBranch: git.branch,
        gitSha: git.sha
      };
    }
  }

  for (const row of rows.slice(0, 5)) {
    const payload = row.payload as Record<string, unknown> | undefined;
    if (!payload) {
      continue;
    }
    const git = parseGitInfo(payload.git_info);
    return {
      id: typeof payload.id === "string" ? payload.id : "",
      cwd: typeof payload.cwd === "string" ? payload.cwd : "",
      source: parseSource(payload.source),
      modelProvider: typeof payload.model_provider === "string" ? payload.model_provider : "",
      cliVersion: typeof payload.cli_version === "string" ? payload.cli_version : "",
      gitBranch: git.branch,
      gitSha: git.sha
    };
  }

  return {
    id: "",
    cwd: "",
    source: "filesystem",
    modelProvider: "",
    cliVersion: "",
    gitBranch: "",
    gitSha: ""
  };
}

export class CodexFilesystemProvider {
  private codexHome: string;
  private readonly logger: Logger;

  public constructor(options: FilesystemProviderOptions) {
    this.codexHome = options.codexHome || path.join(os.homedir(), ".codex");
    this.logger = options.logger;
  }

  public updateCodexHome(codexHome: string): void {
    this.codexHome = codexHome || path.join(os.homedir(), ".codex");
  }

  public getDesktopWorkspaceRoots(): string[] {
    const globalState = readJsonFile<Record<string, unknown>>(path.join(this.codexHome, ".codex-global-state.json"), {});
    const roots = [
      ...arrayOfStrings(globalState["active-workspace-roots"]),
      ...arrayOfStrings(globalState["electron-saved-workspace-roots"])
    ];
    return roots.map(toDisplayPath).filter((value) => value.trim().length > 0);
  }

  public getWorkspaceHints(): Record<string, string> {
    const globalState = readJsonFile<Record<string, unknown>>(path.join(this.codexHome, ".codex-global-state.json"), {});
    const hints = globalState["thread-workspace-root-hints"];
    if (!hints || typeof hints !== "object") {
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(hints)) {
      if (typeof value === "string" && value.trim()) {
        result[key] = toDisplayPath(value);
      }
    }
    return result;
  }

  public getPinnedThreadIds(): Set<string> {
    const globalState = readJsonFile<Record<string, unknown>>(path.join(this.codexHome, ".codex-global-state.json"), {});
    const pinned = globalState["pinned-thread-ids"];
    return new Set(arrayOfStrings(pinned));
  }

  public listSessions(): RawSessionRecord[] {
    const indexFile = path.join(this.codexHome, "session_index.jsonl");
    const sessionsDir = path.join(this.codexHome, "sessions");
    const archivedDir = path.join(this.codexHome, "archived_sessions");
    const indexRows = readJsonLines(indexFile);
    const latestIndexById = buildLatestIndexById(indexRows);
    const fileMap = new Map<string, RawSessionRecord>();

    for (const filePath of walkJsonlFiles(sessionsDir, true)) {
      const rows = readJsonLines(filePath);
      const meta = parseSessionMetaFromRows(rows);
      const id = meta.id || parseSessionIdFromPath(filePath);
      if (!id) {
        continue;
      }
      fileMap.set(id, {
        id,
        sessionId: id,
        preview: parseUserTitleFromRows(rows),
        name: "",
        cwd: toDisplayPath(meta.cwd),
        path: toDisplayPath(filePath),
        source: meta.source,
        createdAt: null,
        updatedAt: fileTimestamp(filePath),
        archived: false,
        modelProvider: meta.modelProvider,
        cliVersion: meta.cliVersion,
        gitBranch: meta.gitBranch,
        gitSha: meta.gitSha
      });
    }

    for (const filePath of walkJsonlFiles(archivedDir, true)) {
      const rows = readJsonLines(filePath);
      const meta = parseSessionMetaFromRows(rows);
      const id = meta.id || parseSessionIdFromPath(filePath);
      if (!id || fileMap.has(id)) {
        continue;
      }
      fileMap.set(id, {
        id,
        sessionId: id,
        preview: parseUserTitleFromRows(rows),
        name: "",
        cwd: toDisplayPath(meta.cwd),
        path: toDisplayPath(filePath),
        source: meta.source,
        createdAt: null,
        updatedAt: fileTimestamp(filePath),
        archived: true,
        modelProvider: meta.modelProvider,
        cliVersion: meta.cliVersion,
        gitBranch: meta.gitBranch,
        gitSha: meta.gitSha
      });
    }

    const sessions: RawSessionRecord[] = [];

    for (const [id, row] of latestIndexById.entries()) {
      const existing = fileMap.get(id);
      if (!existing) {
        continue;
      }
      const threadName = row.threadName;
      sessions.push({
        id,
        sessionId: id,
        preview: threadName,
        name: threadName,
        cwd: existing?.cwd ?? "",
        path: existing?.path ?? "",
        source: existing?.source ?? "filesystem",
        createdAt: null,
        updatedAt: row.updatedAt ?? existing.updatedAt,
        archived: existing?.archived ?? false,
        modelProvider: existing?.modelProvider ?? "",
        cliVersion: existing?.cliVersion ?? "",
        gitBranch: existing?.gitBranch ?? "",
        gitSha: existing?.gitSha ?? ""
      });
      fileMap.delete(id);
    }

    for (const remaining of fileMap.values()) {
      sessions.push(remaining);
    }

    sessions.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
    this.logger.appendLine(`[filesystem] loaded ${sessions.length} session(s) from ${this.codexHome}`);
    return sessions;
  }
}
