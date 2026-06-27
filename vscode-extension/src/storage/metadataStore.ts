import * as vscode from "vscode";
import { METADATA_STORAGE_KEY } from "../constants";
import { LocalSessionMetadata } from "../types";

type MetadataMap = Record<string, LocalSessionMetadata>;

export class MetadataStore {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public getAll(): MetadataMap {
    const stored = this.context.globalState.get<MetadataMap>(METADATA_STORAGE_KEY, {});
    return { ...stored };
  }

  public get(sessionId: string): LocalSessionMetadata {
    const value = this.getAll()[sessionId];
    return {
      alias: value?.alias ?? "",
      projectTag: value?.projectTag ?? "",
      note: value?.note ?? "",
      pinned: value?.pinned ?? false,
      unread: value?.unread ?? false
    };
  }

  public async update(sessionId: string, patch: Partial<LocalSessionMetadata>): Promise<LocalSessionMetadata> {
    const current = this.get(sessionId);
    const next: LocalSessionMetadata = {
      alias: patch.alias ?? current.alias,
      projectTag: patch.projectTag ?? current.projectTag,
      note: patch.note ?? current.note,
      pinned: patch.pinned ?? current.pinned,
      unread: patch.unread ?? current.unread
    };

    const map = this.getAll();
    map[sessionId] = next;
    await this.context.globalState.update(METADATA_STORAGE_KEY, map);
    return next;
  }

  public async delete(sessionId: string): Promise<void> {
    const map = this.getAll();
    delete map[sessionId];
    await this.context.globalState.update(METADATA_STORAGE_KEY, map);
  }
}
