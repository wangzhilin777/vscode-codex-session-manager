import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { archiveSessionFile, deleteSessionFile, unarchiveSessionFile } from "../utils/sessionFiles";
import { SessionRecord } from "../types";

function makeSession(patch: Partial<SessionRecord>): SessionRecord {
  return {
    id: "019f098d-7192-7333-8d97-e3d56ba6b50b",
    sessionId: "019f098d-7192-7333-8d97-e3d56ba6b50b",
    preview: "Test session",
    name: "Test session",
    cwd: "",
    path: "",
    source: "filesystem",
    createdAt: null,
    updatedAt: null,
    archived: true,
    modelProvider: "",
    cliVersion: "",
    gitBranch: "",
    gitSha: "",
    local: {
      alias: "",
      projectTag: "",
      note: ""
    },
    displayName: "Test session",
    workspaceRoot: "",
    workspaceAssigned: false,
    desktopPinned: false,
    desktopProjectless: false,
    projectKey: "",
    projectLabel: "",
    projectDescription: "",
    currentProject: false,
    sourceLabel: "Filesystem",
    detailAvailable: false,
    ...patch
  };
}

test("deleteSessionFile deletes only session files under CODEX_HOME", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-files-"));
  const archivedDir = path.join(codexHome, "archived_sessions");
  fs.mkdirSync(archivedDir, { recursive: true });

  const sessionPath = path.join(archivedDir, "019f098d-7192-7333-8d97-e3d56ba6b50b.jsonl");
  fs.writeFileSync(sessionPath, "{}\n", "utf8");

  const deleted = deleteSessionFile(makeSession({ path: sessionPath }), { codexHome });

  assert.equal(deleted, sessionPath);
  assert.equal(fs.existsSync(sessionPath), false);
});

test("deleteSessionFile refuses paths outside CODEX_HOME", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-files-"));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-outside-"));
  const outsidePath = path.join(outsideDir, "019f098d-7192-7333-8d97-e3d56ba6b50b.jsonl");
  fs.writeFileSync(outsidePath, "{}\n", "utf8");

  const deleted = deleteSessionFile(makeSession({ path: outsidePath }), { codexHome });

  assert.equal(deleted, "");
  assert.equal(fs.existsSync(outsidePath), true);
});

test("archiveSessionFile moves rollout files into archived_sessions", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-files-"));
  const sessionsDir = path.join(codexHome, "sessions", "2026", "06", "28");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const fileName = "rollout-2026-06-28T22-48-17-019f098d-7192-7333-8d97-e3d56ba6b50b.jsonl";
  const sessionPath = path.join(sessionsDir, fileName);
  fs.writeFileSync(sessionPath, "{}\n", "utf8");

  const moved = archiveSessionFile(makeSession({ path: sessionPath, archived: false }), { codexHome });
  const archivedPath = path.join(codexHome, "archived_sessions", fileName);

  assert.equal(moved, true);
  assert.equal(fs.existsSync(sessionPath), false);
  assert.equal(fs.existsSync(archivedPath), true);
});

test("archiveSessionFile refuses files already outside sessions root", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-files-"));
  const archivedDir = path.join(codexHome, "archived_sessions");
  fs.mkdirSync(archivedDir, { recursive: true });

  const fileName = "rollout-2026-06-28T22-48-17-019f098d-7192-7333-8d97-e3d56ba6b50b.jsonl";
  const archivedPath = path.join(archivedDir, fileName);
  fs.writeFileSync(archivedPath, "{}\n", "utf8");

  const moved = archiveSessionFile(makeSession({ path: archivedPath, archived: true }), { codexHome });

  assert.equal(moved, false);
  assert.equal(fs.existsSync(archivedPath), true);
});

test("unarchiveSessionFile moves rollout files back under dated sessions folder", () => {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-files-"));
  const archivedDir = path.join(codexHome, "archived_sessions");
  fs.mkdirSync(archivedDir, { recursive: true });

  const fileName = "rollout-2026-06-28T22-48-17-019f098d-7192-7333-8d97-e3d56ba6b50b.jsonl";
  const archivedPath = path.join(archivedDir, fileName);
  fs.writeFileSync(archivedPath, "{}\n", "utf8");

  const moved = unarchiveSessionFile(makeSession({ path: archivedPath }), { codexHome });
  const targetPath = path.join(codexHome, "sessions", "2026", "06", "28", fileName);

  assert.equal(moved, true);
  assert.equal(fs.existsSync(archivedPath), false);
  assert.equal(fs.existsSync(targetPath), true);
});
