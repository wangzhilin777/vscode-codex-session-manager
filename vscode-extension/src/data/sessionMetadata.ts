import { LocalSessionMetadata, RawSessionRecord } from "../types";

export const EMPTY_LOCAL_SESSION_METADATA: LocalSessionMetadata = {
  alias: "",
  projectTag: "",
  note: "",
  pinned: false,
  unread: false
};

export function normalizeLocalSessionMetadata(value: Partial<LocalSessionMetadata> | undefined): LocalSessionMetadata {
  return {
    alias: value?.alias ?? "",
    projectTag: value?.projectTag ?? "",
    note: value?.note ?? "",
    pinned: value?.pinned ?? false,
    unread: value?.unread ?? false
  };
}

export function metadataForRawSession(
  raw: RawSessionRecord,
  metadataById: Readonly<Record<string, LocalSessionMetadata>>
): LocalSessionMetadata {
  return normalizeLocalSessionMetadata(metadataById[raw.sessionId] ?? metadataById[raw.id]);
}
