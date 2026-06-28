import * as vscode from "vscode";
import fs from "node:fs/promises";
import path from "node:path";
import { Logger, RepositorySnapshot } from "../types";

const CACHE_VERSION = 1;
const CACHE_FILE_NAME = "sessionSnapshotCache.v1.json";

interface CacheFile {
  version: number;
  savedAt: number;
  snapshot: RepositorySnapshot;
}

function isCacheFile(value: unknown): value is CacheFile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<CacheFile>;
  return candidate.version === CACHE_VERSION && !!candidate.snapshot && Array.isArray(candidate.snapshot.sessions);
}

export class SessionSnapshotCache {
  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {}

  public async read(): Promise<RepositorySnapshot | null> {
    try {
      const text = await fs.readFile(this.cachePath(), "utf8");
      const parsed = JSON.parse(text) as unknown;
      if (!isCacheFile(parsed)) {
        return null;
      }
      return parsed.snapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.appendLine(`[cache] failed to read session cache: ${String(error)}`);
      }
      return null;
    }
  }

  public async write(snapshot: RepositorySnapshot): Promise<void> {
    try {
      const cachePath = this.cachePath();
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      const tempPath = `${cachePath}.${process.pid}.tmp`;
      const payload: CacheFile = {
        version: CACHE_VERSION,
        savedAt: Date.now(),
        snapshot: {
          ...snapshot,
          searchTerm: ""
        }
      };
      await fs.writeFile(tempPath, JSON.stringify(payload), "utf8");
      await fs.rename(tempPath, cachePath);
    } catch (error) {
      this.logger.appendLine(`[cache] failed to write session cache: ${String(error)}`);
    }
  }

  private cachePath(): string {
    return path.join(this.context.globalStorageUri.fsPath, CACHE_FILE_NAME);
  }
}
