import { UNKNOWN_PROJECT_LABEL } from "../constants";
import { LocalSessionMetadata, ProjectBucket, RawSessionRecord, SessionFilterState, SessionGroup, SessionRecord } from "../types";
import { t } from "../utils/i18n";
import {
  basenameOrPath,
  isPathInside,
  normalizeFsPath,
  pickLongestMatchingRoot,
  sanitizeSearchText,
  toDisplayPath
} from "../utils/pathUtils";

const DUPLICATE_SESSION_WINDOW_SECONDS = 5 * 60;

export function sourceLabel(source: string): string {
  switch (source) {
    case "vscode":
      return "VS Code";
    case "appServer":
      return t("desktopAppSourceLabel");
    case "cli":
      return "CLI";
    case "exec":
      return t("execSourceLabel");
    case "subAgent":
    case "subAgentReview":
    case "subAgentCompact":
    case "subAgentThreadSpawn":
    case "subAgentOther":
      return t("subagentSourceLabel");
    case "filesystem":
      return t("filesystemSourceLabel");
    default:
      return t("unknownSourceLabel");
  }
}

export function normalizeSessionTitle(value: string): string {
  const firstUsefulLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstUsefulLine) {
    return "";
  }
  return firstUsefulLine.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
}

function rawSessionTitle(raw: RawSessionRecord): string {
  return normalizeSessionTitle(raw.name) || normalizeSessionTitle(raw.preview);
}

function duplicateKey(raw: RawSessionRecord): string {
  const title = rawSessionTitle(raw);
  const cwd = normalizeFsPath(raw.cwd);
  if (!title || !cwd || title === raw.sessionId) {
    return "";
  }
  return [raw.archived ? "archived" : "active", raw.source || "unknown", cwd, sanitizeSearchText(title)].join("\u0000");
}

function sessionTimestamp(raw: RawSessionRecord): number {
  return raw.updatedAt ?? raw.createdAt ?? 0;
}

function preferRawSession(left: RawSessionRecord, right: RawSessionRecord): RawSessionRecord {
  const leftTime = sessionTimestamp(left);
  const rightTime = sessionTimestamp(right);
  if (leftTime !== rightTime) {
    return leftTime > rightTime ? left : right;
  }
  if (!!left.path !== !!right.path) {
    return left.path ? left : right;
  }
  if (!!left.name !== !!right.name) {
    return left.name ? left : right;
  }
  return left;
}

export function dedupeRawSessions(raws: readonly RawSessionRecord[]): RawSessionRecord[] {
  const retained: RawSessionRecord[] = [];
  const buckets = new Map<string, number[]>();

  for (const raw of [...raws].sort((left, right) => sessionTimestamp(right) - sessionTimestamp(left))) {
    const key = duplicateKey(raw);
    if (!key) {
      retained.push(raw);
      continue;
    }

    const indexes = buckets.get(key) ?? [];
    const duplicateIndex = indexes.find((index) => {
      const existing = retained[index];
      return existing ? Math.abs(sessionTimestamp(existing) - sessionTimestamp(raw)) <= DUPLICATE_SESSION_WINDOW_SECONDS : false;
    });

    if (duplicateIndex === undefined) {
      indexes.push(retained.length);
      buckets.set(key, indexes);
      retained.push(raw);
      continue;
    }

    const existing = retained[duplicateIndex];
    if (existing) {
      retained[duplicateIndex] = preferRawSession(existing, raw);
    }
  }

  return retained.sort((left, right) => sessionTimestamp(right) - sessionTimestamp(left));
}

function projectKeyFor(projectTag: string, resolvedRoot: string): string {
  const tagged = projectTag.trim();
  if (tagged) {
    return `tag:${sanitizeSearchText(tagged)}`;
  }

  const normalizedRoot = normalizeFsPath(resolvedRoot);
  return normalizedRoot || UNKNOWN_PROJECT_LABEL;
}

export function toSessionRecord(
  raw: RawSessionRecord,
  local: LocalSessionMetadata,
  workspaceRoots: readonly string[],
  workspaceHint: string,
  knownWorkspaceRoots: readonly string[] = workspaceRoots
): SessionRecord {
  const preferredRoot = pickLongestMatchingRoot(raw.cwd, workspaceRoots);
  const normalizedHint = normalizeFsPath(workspaceHint);
  const inferredRoot = pickLongestMatchingRoot(raw.cwd, knownWorkspaceRoots);
  const assignedRoot = preferredRoot || inferredRoot || workspaceHint;
  const resolvedRoot = assignedRoot || raw.cwd;
  const currentProject = !!preferredRoot;
  const workspaceAssigned = !!assignedRoot || !!normalizedHint;
  const tagged = local.projectTag.trim();
  const projectKey = projectKeyFor(tagged, resolvedRoot);
  const projectLabel = tagged || basenameOrPath(resolvedRoot) || UNKNOWN_PROJECT_LABEL;
  const projectDescription = tagged ? toDisplayPath(resolvedRoot || raw.cwd) : toDisplayPath(resolvedRoot || raw.cwd);
  const title = normalizeSessionTitle(raw.name) || normalizeSessionTitle(raw.preview) || raw.sessionId;
  const baseDisplayName = local.alias.trim() || title;
  const displayName = raw.archived ? `[${t("archivedBadge")}] ${baseDisplayName}` : baseDisplayName;

  return {
    ...raw,
    local,
    displayName,
    workspaceRoot: toDisplayPath(resolvedRoot),
    workspaceAssigned,
    projectKey,
    projectLabel,
    projectDescription,
    currentProject,
    sourceLabel: sourceLabel(raw.source),
    detailAvailable: raw.source !== "filesystem"
  };
}

export function filterSessions(sessions: readonly SessionRecord[], state: SessionFilterState): SessionRecord[] {
  const query = sanitizeSearchText(state.searchTerm);

  return sessions.filter((session) => {
    if (!state.showArchived && session.archived && !query) {
      return false;
    }

    if (state.currentProjectOnly && !session.currentProject) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      session.displayName,
      session.name,
      session.preview,
      session.local.alias,
      session.local.projectTag,
      session.local.note,
      session.local.pinned ? "pinned" : "",
      session.local.unread ? "unread" : "",
      session.sessionId,
      session.cwd,
      session.workspaceRoot,
      session.projectKey,
      session.projectLabel,
      session.projectDescription,
      session.gitBranch,
      session.sourceLabel
    ]
      .join("\n")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function bucketize(sessions: readonly SessionRecord[]): Map<string, ProjectBucket> {
  const buckets = new Map<string, ProjectBucket>();

  for (const session of sessions) {
    const key = session.projectKey || UNKNOWN_PROJECT_LABEL;
    const existing = buckets.get(key);
    if (existing) {
      existing.sessions.push(session);
      continue;
    }
    buckets.set(key, {
      id: key,
      label: session.projectLabel || UNKNOWN_PROJECT_LABEL,
      description: session.projectDescription,
      sessions: [session]
    });
  }

  return buckets;
}

function sortBuckets(values: Iterable<ProjectBucket>): ProjectBucket[] {
  return [...values].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function sortSessions(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.sort((left, right) => {
    if (left.local.pinned !== right.local.pinned) {
      return left.local.pinned ? -1 : 1;
    }
    return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
  });
}

export function buildGroups(sessions: readonly SessionRecord[]): SessionGroup[] {
  const current = sessions.filter((session) => session.currentProject);
  const other = sessions.filter(
    (session) => !session.currentProject && session.workspaceAssigned && session.projectKey !== UNKNOWN_PROJECT_LABEL
  );
  const noWorkspace = sessions.filter(
    (session) => !session.currentProject && !session.workspaceAssigned && session.projectKey !== UNKNOWN_PROJECT_LABEL
  );
  const uncategorized = sessions.filter(
    (session) => !session.projectKey || session.projectKey === UNKNOWN_PROJECT_LABEL
  );

  const groups: SessionGroup[] = [
    {
      id: "current",
      label: t("currentGroupLabel"),
      description: t("currentGroupDescription"),
      kind: "current",
      sessions: sortSessions(current)
    },
    {
      id: "other",
      label: t("otherGroupLabel"),
      description: t("otherGroupDescription"),
      kind: "other",
      sessions: sortSessions(other)
    },
    {
      id: "noWorkspace",
      label: t("noWorkspaceGroupLabel"),
      description: t("noWorkspaceGroupDescription"),
      kind: "noWorkspace",
      sessions: sortSessions(noWorkspace)
    },
    {
      id: "uncategorized",
      label: t("unknownGroupLabel"),
      description: t("unknownGroupDescription"),
      kind: "uncategorized",
      sessions: sortSessions(uncategorized)
    }
  ];

  return groups.filter((group) => group.sessions.length > 0);
}

export function projectBucketsForGroup(group: SessionGroup): ProjectBucket[] {
  if (group.kind === "uncategorized") {
    return [
      {
        id: `${group.id}:${UNKNOWN_PROJECT_LABEL}`,
        label: t("unknownGroupLabel"),
        description: "",
        sessions: [...group.sessions]
      }
    ];
  }

  return sortBuckets(bucketize(group.sessions).values()).map((bucket) => ({
    ...bucket,
    sessions: sortSessions(bucket.sessions)
  }));
}

export function collectKnownWorkspaceRoots(
  currentWorkspaceRoots: readonly string[],
  workspaceHints: Readonly<Record<string, string>>,
  sessions: readonly Pick<SessionRecord, "workspaceAssigned" | "workspaceRoot">[] = []
): string[] {
  const unique = new Map<string, string>();

  for (const root of currentWorkspaceRoots) {
    const normalized = normalizeFsPath(root);
    if (normalized) {
      unique.set(normalized, root);
    }
  }

  for (const root of Object.values(workspaceHints)) {
    const normalized = normalizeFsPath(root);
    if (normalized) {
      unique.set(normalized, root);
    }
  }

  for (const session of sessions) {
    if (!session.workspaceAssigned) {
      continue;
    }
    const normalized = normalizeFsPath(session.workspaceRoot);
    if (normalized) {
      unique.set(normalized, session.workspaceRoot);
    }
  }

  return [...unique.values()];
}

export function resolveWorkspaceHint(sessionId: string, cwd: string, hints: Readonly<Record<string, string>>): string {
  const hinted = hints[sessionId] ?? "";
  if (hinted) {
    return hinted;
  }
  return "";
}

export function sessionMatchesWorkspace(session: SessionRecord, workspaceRoot: string): boolean {
  return isPathInside(session.workspaceRoot || session.cwd, workspaceRoot);
}
