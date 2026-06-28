import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGroups,
  collectKnownWorkspaceRoots,
  dedupeRawSessions,
  filterSessions,
  isSessionPinned,
  projectBucketsForGroup,
  toSessionRecord
} from "../data/sessionTransforms";
import { RawSessionRecord } from "../types";
import { configureLanguage } from "../utils/i18n";

function makeRaw(id: string, cwd: string, archived = false): RawSessionRecord {
  return {
    id,
    sessionId: id,
    preview: `preview-${id}`,
    name: `name-${id}`,
    cwd,
    path: "",
    source: "vscode",
    createdAt: 1,
    updatedAt: 10,
    archived,
    modelProvider: "",
    cliVersion: "",
    gitBranch: "",
    gitSha: ""
  };
}

test("toSessionRecord marks current project and applies alias", () => {
  configureLanguage("en");
  const record = toSessionRecord(
    makeRaw("one", "E:\\Workspace\\VSCode\\test"),
    { alias: "Alias One", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );

  assert.equal(record.currentProject, true);
  assert.equal(record.workspaceAssigned, true);
  assert.equal(record.displayName, "Alias One");
});

test("toSessionRecord keeps path-only sessions outside workspace-assigned buckets", () => {
  configureLanguage("en");
  const record = toSessionRecord(
    makeRaw("path-only", "E:\\Workspace\\VSCode\\detached"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    ""
  );

  assert.equal(record.currentProject, false);
  assert.equal(record.workspaceAssigned, false);
  assert.equal(record.projectLabel, "detached");
});

test("toSessionRecord merges sessions into a known workspace root even without a direct hint", () => {
  configureLanguage("en");
  const knownRoots = collectKnownWorkspaceRoots(
    ["E:\\Workspace\\VSCode\\test"],
    {
      known: "E:\\Workspace\\cachelocal"
    }
  );
  const record = toSessionRecord(
    makeRaw("known-root", "E:\\Workspace\\cachelocal"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "",
    knownRoots
  );

  assert.equal(record.currentProject, false);
  assert.equal(record.workspaceAssigned, true);
  assert.equal(record.projectLabel, "cachelocal");
  assert.equal(record.workspaceRoot, "E:\\Workspace\\cachelocal");
});

test("toSessionRecord normalizes markdown-style titles", () => {
  configureLanguage("en");
  const raw = makeRaw("one", "E:\\Workspace\\VSCode\\test");
  raw.name = "# CPA配置\r\n\r\nbody that should not become the title";

  const record = toSessionRecord(raw, { alias: "", projectTag: "", note: "" }, [], "");

  assert.equal(record.displayName, "CPA配置");
});

test("toSessionRecord marks archived sessions in the active language", () => {
  configureLanguage("zh-CN");
  const record = toSessionRecord(
    makeRaw("one", "E:\\Workspace\\VSCode\\test", true),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );

  assert.equal(record.displayName.startsWith("[已归档]"), true);
  configureLanguage("en");
});

test("toSessionRecord keeps archived badge even when a local alias is set", () => {
  configureLanguage("zh-CN");
  const record = toSessionRecord(
    makeRaw("one", "E:\\Workspace\\VSCode\\test", true),
    { alias: "本地别名", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );

  assert.equal(record.displayName, "[已归档] 本地别名");
  configureLanguage("en");
});

test("toSessionRecord normalizes project keys for path casing", () => {
  configureLanguage("en");
  const upper = toSessionRecord(
    makeRaw("upper", "E:\\Workspace\\VSCode\\test"),
    { alias: "", projectTag: "", note: "" },
    [],
    ""
  );
  const lower = toSessionRecord(
    makeRaw("lower", "e:\\Workspace\\VSCode\\test"),
    { alias: "", projectTag: "", note: "" },
    [],
    ""
  );

  assert.equal(upper.projectKey, lower.projectKey);
});

test("filterSessions keeps current project only when requested", () => {
  configureLanguage("en");
  const current = toSessionRecord(
    makeRaw("one", "E:\\Workspace\\VSCode\\test"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );
  const other = toSessionRecord(
    makeRaw("two", "E:\\Workspace\\VSCode\\other"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\other"
  );

  const filtered = filterSessions([current, other], {
    currentProjectOnly: true,
    showArchived: false,
    searchTerm: ""
  });

  assert.deepEqual(filtered.map((item) => item.id), ["one"]);
});

test("filterSessions can find archived sessions by search even when archived are hidden by default", () => {
  configureLanguage("en");
  const archived = toSessionRecord(
    makeRaw("archived-cpa", "E:\\Workspace\\VSCode\\test", true),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );

  const filtered = filterSessions([archived], {
    currentProjectOnly: true,
    showArchived: false,
    searchTerm: "cpa"
  });

  assert.deepEqual(filtered.map((item) => item.id), ["archived-cpa"]);
});

test("filterSessions hides archived sessions by default when there is no search term", () => {
  configureLanguage("en");
  const archived = toSessionRecord(
    makeRaw("archived-cpa", "E:\\Workspace\\VSCode\\test", true),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );

  const filtered = filterSessions([archived], {
    currentProjectOnly: true,
    showArchived: false,
    searchTerm: ""
  });

  assert.deepEqual(filtered, []);
});

test("filterSessions matches local metadata, project label, workspace path, and git branch", () => {
  configureLanguage("en");
  const raw = makeRaw("searchable", "E:\\Workspace\\VSCode\\search-target");
  raw.gitBranch = "feature/session-search";
  const record = toSessionRecord(
    raw,
    { alias: "Local Alias", projectTag: "Customer Portal", note: "Needs follow up" },
    [],
    ""
  );

  for (const searchTerm of ["follow up", "customer portal", "search-target", "feature/session-search", "local alias"]) {
    const filtered = filterSessions([record], {
      currentProjectOnly: false,
      showArchived: true,
      searchTerm
    });

    assert.deepEqual(filtered.map((item) => item.id), ["searchable"]);
  }
});

test("dedupeRawSessions collapses short-lived duplicate VS Code sync rows", () => {
  const older = makeRaw("older", "E:\\Workspace\\VSCode\\test");
  older.name = "查询北京天气";
  older.preview = "查询北京天气";
  older.updatedAt = 100;

  const newer = makeRaw("newer", "E:\\Workspace\\VSCode\\test");
  newer.name = "查询北京天气";
  newer.preview = "查询北京天气";
  newer.updatedAt = 120;

  const deduped = dedupeRawSessions([older, newer]);

  assert.deepEqual(deduped.map((item) => item.id), ["newer"]);
});

test("dedupeRawSessions keeps same-title sessions that are far apart", () => {
  const first = makeRaw("first", "E:\\Workspace\\VSCode\\test");
  first.name = "查询北京天气";
  first.preview = "查询北京天气";
  first.updatedAt = 100;

  const second = makeRaw("second", "E:\\Workspace\\VSCode\\test");
  second.name = "查询北京天气";
  second.preview = "查询北京天气";
  second.updatedAt = 1000;

  const deduped = dedupeRawSessions([first, second]);

  assert.deepEqual(deduped.map((item) => item.id), ["second", "first"]);
});

test("buildGroups keeps archived sessions under their workspace group", () => {
  configureLanguage("en");
  const current = toSessionRecord(
    makeRaw("one", "E:\\Workspace\\VSCode\\test"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );
  const archived = toSessionRecord(
    makeRaw("two", "E:\\Workspace\\VSCode\\test", true),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );

  const groups = buildGroups([current, archived]);
  assert.deepEqual(groups.map((group) => group.kind), ["current"]);
  assert.deepEqual(groups[0]?.sessions.map((session) => session.id), ["one", "two"]);
});

test("buildGroups places archived sessions in the current workspace before other workspaces", () => {
  configureLanguage("en");
  const current = toSessionRecord(
    makeRaw("current", "E:\\Workspace\\VSCode\\test"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );
  const archived = toSessionRecord(
    makeRaw("archived", "E:\\Workspace\\VSCode\\test", true),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );
  const other = toSessionRecord(
    makeRaw("other", "E:\\Workspace\\VSCode\\other"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\other"
  );

  const groups = buildGroups([other, archived, current]);

  assert.deepEqual(
    groups.map((group) => group.kind),
    ["current", "other"]
  );
  assert.deepEqual(groups[0]?.sessions.map((session) => session.id), ["archived", "current"]);
});

test("buildGroups splits workspace-assigned sessions from no-workspace sessions", () => {
  configureLanguage("en");
  const otherWorkspace = toSessionRecord(
    makeRaw("other-workspace", "E:\\Workspace\\VSCode\\customer-a"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\customer-a"
  );
  const noWorkspace = toSessionRecord(
    makeRaw("no-workspace", "E:\\Workspace\\VSCode\\scratch-pad"),
    { alias: "", projectTag: "", note: "" },
    ["E:\\Workspace\\VSCode\\test"],
    ""
  );

  const groups = buildGroups([noWorkspace, otherWorkspace]);

  assert.deepEqual(
    groups.map((group) => group.kind),
    ["other", "noWorkspace"]
  );
  assert.deepEqual(groups[0]?.sessions.map((session) => session.id), ["other-workspace"]);
  assert.deepEqual(groups[1]?.sessions.map((session) => session.id), ["no-workspace"]);
});

test("buildGroups sorts desktop pinned sessions without changing local pinned metadata", () => {
  configureLanguage("en");
  const regular = toSessionRecord(
    {
      ...makeRaw("regular", "E:\\Workspace\\VSCode\\test"),
      updatedAt: 20
    },
    { alias: "", projectTag: "", note: "", pinned: false },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test"
  );
  const desktopPinned = toSessionRecord(
    {
      ...makeRaw("desktop-pinned", "E:\\Workspace\\VSCode\\test"),
      updatedAt: 10
    },
    { alias: "", projectTag: "", note: "", pinned: false },
    ["E:\\Workspace\\VSCode\\test"],
    "E:\\Workspace\\VSCode\\test",
    ["E:\\Workspace\\VSCode\\test"],
    true
  );

  const groups = buildGroups([regular, desktopPinned]);

  assert.equal(desktopPinned.local.pinned, false);
  assert.equal(isSessionPinned(desktopPinned), true);
  assert.deepEqual(groups[0]?.sessions.map((session) => session.id), ["desktop-pinned", "regular"]);
});

test("projectBucketsForGroup merges archived sessions with the matching project bucket", () => {
  configureLanguage("en");
  const active = toSessionRecord(
    makeRaw("active", "E:\\Workspace\\VSCode\\test"),
    { alias: "", projectTag: "", note: "" },
    [],
    ""
  );
  const archived = toSessionRecord(
    makeRaw("archived", "e:\\Workspace\\VSCode\\test", true),
    { alias: "", projectTag: "", note: "" },
    [],
    ""
  );

  const groups = buildGroups([active, archived]);
  const buckets = projectBucketsForGroup(groups[0]!);

  assert.equal(buckets.length, 1);
  assert.deepEqual(buckets[0]?.sessions.map((session) => session.id), ["active", "archived"]);
});

test("collectKnownWorkspaceRoots keeps unique normalized workspace roots", () => {
  const roots = collectKnownWorkspaceRoots(
    ["E:\\Workspace\\VSCode\\test"],
    {
      first: "e:\\Workspace\\cachelocal",
      second: "E:\\Workspace\\cachelocal"
    },
    [
      {
        workspaceAssigned: true,
        workspaceRoot: "E:\\Workspace\\VSCode\\test"
      }
    ]
  );

  assert.equal(roots.length, 2);
  assert.equal(roots[0], "E:\\Workspace\\VSCode\\test");
  assert.equal(roots[1]?.toLowerCase(), "e:\\workspace\\cachelocal");
});
