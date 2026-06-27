import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { APP_SERVER_REQUEST_TIMEOUT_MS, MAX_LIST_PAGES } from "../constants";
import { AppServerThreadDetail, AppServerThreadSummary, ExtensionSettings, Logger, SessionSourceKind, SessionTurn, SessionTurnItem } from "../types";
import { toDisplayPath } from "../utils/pathUtils";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: NodeJS.Timeout;
}

interface JsonRpcResponse {
  id?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  method?: string;
}

function parseSessionSource(value: unknown): SessionSourceKind {
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
      return "unknown";
  }
}

function flattenItemText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  const pieces: string[] = [];
  for (const item of content) {
    if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
      pieces.push((item as { text: string }).text);
    }
  }
  return pieces.join("\n").trim();
}

function mapThreadSummary(raw: Record<string, unknown>, archived: boolean): AppServerThreadSummary {
  const gitInfo = raw.gitInfo as Record<string, unknown> | undefined;
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : "",
    preview: typeof raw.preview === "string" ? raw.preview : "",
    name: typeof raw.name === "string" ? raw.name : null,
    cwd: toDisplayPath(typeof raw.cwd === "string" ? raw.cwd : ""),
    path: typeof raw.path === "string" ? toDisplayPath(raw.path) : null,
    source: parseSessionSource(raw.source),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : null,
    modelProvider: typeof raw.modelProvider === "string" ? raw.modelProvider : null,
    cliVersion: typeof raw.cliVersion === "string" ? raw.cliVersion : null,
    gitBranch: typeof gitInfo?.branch === "string" ? gitInfo.branch : null,
    gitSha: typeof gitInfo?.sha === "string" ? gitInfo.sha : null,
    archived
  };
}

function mapTurnItems(items: unknown[]): SessionTurnItem[] {
  const summaries: SessionTurnItem[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const typedItem = item as Record<string, unknown>;
    const type = typeof typedItem.type === "string" ? typedItem.type : "other";

    if (type === "userMessage") {
      summaries.push({
        type,
        label: "User",
        text: flattenItemText(typedItem.content) || "(empty)"
      });
      continue;
    }

    if (type === "agentMessage") {
      const phase = typeof typedItem.phase === "string" ? ` [${typedItem.phase}]` : "";
      summaries.push({
        type,
        label: `Assistant${phase}`,
        text: typeof typedItem.text === "string" ? typedItem.text : "(empty)"
      });
      continue;
    }

    if (type === "webSearch") {
      summaries.push({
        type,
        label: "Web Search",
        text: typeof typedItem.query === "string" ? typedItem.query : "(query unavailable)"
      });
      continue;
    }

    if (type === "functionCall" || type === "dynamicToolCall" || type === "toolCall") {
      const toolName =
        typeof typedItem.name === "string"
          ? typedItem.name
          : typeof typedItem.tool_name === "string"
            ? typedItem.tool_name
            : "tool";
      summaries.push({
        type: "toolCall",
        label: `Tool: ${toolName}`,
        text: JSON.stringify(typedItem.arguments ?? typedItem.input ?? {}, null, 2)
      });
      continue;
    }

    if (type === "functionCallOutput" || type === "toolOutput") {
      summaries.push({
        type: "toolOutput",
        label: "Tool Output",
        text: JSON.stringify(typedItem.output ?? typedItem.content ?? typedItem, null, 2)
      });
      continue;
    }

    summaries.push({
      type: "other",
      label: type,
      text: JSON.stringify(typedItem, null, 2)
    });
  }

  return summaries;
}

function mapThreadDetail(raw: Record<string, unknown>): AppServerThreadDetail {
  const summary = mapThreadSummary(raw, false);
  const turns = Array.isArray(raw.turns)
    ? raw.turns.map((turn) => {
        const typedTurn = turn as Record<string, unknown>;
        return {
          id: typeof typedTurn.id === "string" ? typedTurn.id : "",
          status: typeof typedTurn.status === "string" ? typedTurn.status : null,
          startedAt: typeof typedTurn.startedAt === "number" ? typedTurn.startedAt : null,
          completedAt: typeof typedTurn.completedAt === "number" ? typedTurn.completedAt : null,
          durationMs: typeof typedTurn.durationMs === "number" ? typedTurn.durationMs : null,
          items: mapTurnItems(Array.isArray(typedTurn.items) ? typedTurn.items : [])
        } satisfies SessionTurn;
      })
    : [];

  return { ...summary, turns };
}

export class CodexAppServerClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private initialized = false;
  private readonly logger: Logger;
  private readonly settings: ExtensionSettings;

  public constructor(settings: ExtensionSettings, logger: Logger) {
    this.settings = settings;
    this.logger = logger;
  }

  public async listThreads(sourceKinds: SessionSourceKind[], searchTerm: string): Promise<AppServerThreadSummary[]> {
    const active = await this.collectAllPages(false, sourceKinds, searchTerm);
    const archived = await this.collectAllPages(true, sourceKinds, searchTerm);
    return [...active, ...archived].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
  }

  public async readThread(threadId: string): Promise<AppServerThreadDetail> {
    const result = await this.request("thread/read", {
      threadId,
      includeTurns: true
    });
    const thread = (result as { thread?: Record<string, unknown> }).thread;
    if (!thread) {
      throw new Error(`thread/read returned no thread for ${threadId}`);
    }
    return mapThreadDetail(thread);
  }

  public dispose(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("app-server disposed"));
    }
    this.pending.clear();
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.initialized = false;
  }

  private async collectAllPages(
    archived: boolean,
    sourceKinds: SessionSourceKind[],
    searchTerm: string
  ): Promise<AppServerThreadSummary[]> {
    const sessions: AppServerThreadSummary[] = [];
    let cursor: string | null = null;

    for (let pageIndex = 0; pageIndex < MAX_LIST_PAGES; pageIndex += 1) {
      const result = await this.request("thread/list", {
        archived,
        cursor,
        limit: 200,
        searchTerm: searchTerm || null,
        sortKey: "updated_at",
        sortDirection: "desc",
        sourceKinds
      });

      const data = Array.isArray((result as { data?: unknown[] }).data) ? ((result as { data: unknown[] }).data ?? []) : [];
      for (const item of data) {
        if (item && typeof item === "object") {
          sessions.push(mapThreadSummary(item as Record<string, unknown>, archived));
        }
      }

      cursor = typeof (result as { nextCursor?: unknown }).nextCursor === "string" ? ((result as { nextCursor: string }).nextCursor ?? "") : null;
      if (!cursor) {
        break;
      }
    }

    return sessions;
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    await this.ensureInitialized();
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;

    return await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timed out waiting for ${method}`));
      }, APP_SERVER_REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timer });
      this.process?.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })}\n`);
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.process) {
      return;
    }

    if (!this.process) {
      await this.startProcess();
    }

    if (this.initialized) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const requestId = this.nextRequestId;
      this.nextRequestId += 1;
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("Timed out waiting for initialize"));
      }, APP_SERVER_REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, {
        resolve: () => {
          this.initialized = true;
          resolve();
        },
        reject: (error) => reject(error),
        timer
      });

      this.process?.stdin.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: requestId,
          method: "initialize",
          params: {
            clientInfo: {
              name: "codex-session-manager",
              version: "0.1.0"
            },
            capabilities: {},
            protocolVersion: 2
          }
        })}\n`
      );
    });
  }

  private async startProcess(): Promise<void> {
    if (this.process) {
      return;
    }

    const env = { ...process.env };
    if (this.settings.codexHomeOverride.trim()) {
      env.CODEX_HOME = this.settings.codexHomeOverride.trim();
    }

    this.process = spawn(this.settings.codexCliPath || "codex", ["app-server", "--stdio"], {
      env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.process.on("error", (error) => {
      this.logger.appendLine(`[app-server] failed to start: ${error.message}`);
      this.rejectAllPending(error);
      this.process = null;
      this.initialized = false;
    });

    this.process.on("exit", (code, signal) => {
      this.logger.appendLine(`[app-server] exited code=${code ?? "null"} signal=${signal ?? "null"}`);
      this.rejectAllPending(new Error("app-server exited"));
      this.process = null;
      this.initialized = false;
    });

    this.process.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString("utf8");
      this.drainBuffer();
    });

    this.process.stderr.on("data", (chunk) => {
      const message = chunk.toString("utf8").trim();
      if (message) {
        this.logger.appendLine(`[app-server][stderr] ${message}`);
      }
    });
  }

  private drainBuffer(): void {
    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex < 0) {
        return;
      }

      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) {
        continue;
      }

      try {
        this.handleMessage(JSON.parse(line) as JsonRpcResponse);
      } catch (error) {
        this.logger.appendLine(`[app-server] failed to parse line: ${String(error)}`);
      }
    }
  }

  private handleMessage(message: JsonRpcResponse): void {
    if (typeof message.id !== "number") {
      if (message.method) {
        this.logger.appendLine(`[app-server] notification ${message.method}`);
      }
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new Error(message.error.message));
      return;
    }

    pending.resolve(message.result);
  }

  private rejectAllPending(error: unknown): void {
    for (const [requestId, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(requestId);
    }
  }
}
