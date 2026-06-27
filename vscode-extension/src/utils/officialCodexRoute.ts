import { OFFICIAL_CODEX_EXTENSION_ID, OFFICIAL_CODEX_LOCAL_ROUTE_PREFIX } from "../constants";

function normalizeSessionId(sessionId: string): string {
  return sessionId.trim();
}

export function buildOfficialCodexConversationPath(sessionId: string): string {
  return `${OFFICIAL_CODEX_LOCAL_ROUTE_PREFIX}${encodeURIComponent(normalizeSessionId(sessionId))}`;
}

export function buildOfficialCodexConversationUriString(uriScheme: string, sessionId: string): string {
  return `${uriScheme}://${OFFICIAL_CODEX_EXTENSION_ID}${buildOfficialCodexConversationPath(sessionId)}`;
}
