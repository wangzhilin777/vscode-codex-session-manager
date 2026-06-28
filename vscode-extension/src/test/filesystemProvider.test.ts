import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CodexFilesystemProvider } from "../data/filesystemProvider";

function makeLogger() {
  return {
    appendLine() {}
  };
}

test("filesystem provider loads indexed and archived sessions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  const sessionsDir = path.join(root, "sessions", "2026", "06", "27");
  const archivedDir = path.join(root, "archived_sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.mkdirSync(archivedDir, { recursive: true });

  fs.writeFileSync(
    path.join(root, "session_index.jsonl"),
    [
      JSON.stringify({
        id: "session-a",
        thread_name: "Thread A",
        updated_at: "2026-06-27T12:00:00Z"
      }),
      JSON.stringify({
        id: "session-b",
        thread_name: "Thread B",
        updated_at: "2026-06-27T11:00:00Z"
      }),
      JSON.stringify({
        id: "index-only-session",
        thread_name: "Index Only",
        updated_at: "2026-06-27T10:00:00Z"
      })
    ].join("\n"),
    "utf8"
  );

  fs.writeFileSync(
    path.join(root, ".codex-global-state.json"),
    JSON.stringify({
      "thread-workspace-root-hints": {
        "session-a": "E:\\Workspace\\VSCode\\test"
      }
    }),
    "utf8"
  );

  fs.writeFileSync(
    path.join(sessionsDir, "session-a.jsonl"),
    `${JSON.stringify({
      type: "session_meta",
      payload: {
        id: "session-a",
        cwd: "E:\\Workspace\\VSCode\\test",
        source: "vscode",
        model_provider: "openai",
        cli_version: "0.1.0",
        git_info: {
          branch: "main",
          sha: "abc123"
        }
      }
    })}\n`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(archivedDir, "session-b.jsonl"),
    `${JSON.stringify({
      type: "session_meta",
      payload: {
        id: "session-b",
        cwd: "E:\\Workspace\\VSCode\\other",
        source: "cli"
      }
    })}\n`,
    "utf8"
  );

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  const hints = provider.getWorkspaceHints();
  const sessions = provider.listSessions();

  assert.equal(hints["session-a"], "E:\\Workspace\\VSCode\\test");
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]?.id, "session-a");
  assert.equal(sessions[1]?.archived, true);
});

test("filesystem provider reads desktop pinned thread ids from global state", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  fs.writeFileSync(
    path.join(root, ".codex-global-state.json"),
    JSON.stringify({
      "pinned-thread-ids": ["session-a", "session-b"]
    }),
    "utf8"
  );

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  const pinned = provider.getPinnedThreadIds();

  assert.equal(pinned.has("session-a"), true);
  assert.equal(pinned.has("session-b"), true);
  assert.equal(pinned.size, 2);
});

test("filesystem provider accepts a single desktop pinned thread id", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  fs.writeFileSync(
    path.join(root, ".codex-global-state.json"),
    JSON.stringify({
      "pinned-thread-ids": "session-a"
    }),
    "utf8"
  );

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  const pinned = provider.getPinnedThreadIds();

  assert.deepEqual([...pinned], ["session-a"]);
});

test("filesystem provider reads desktop workspace roots from global state", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  fs.writeFileSync(
    path.join(root, ".codex-global-state.json"),
    JSON.stringify({
      "active-workspace-roots": "E:\\Workspace\\VSCode\\test",
      "electron-saved-workspace-roots": ["e:\\Workspace\\VSCode\\cachelocal"]
    }),
    "utf8"
  );

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  assert.deepEqual(provider.getDesktopWorkspaceRoots(), ["E:\\Workspace\\VSCode\\test", "e:\\Workspace\\VSCode\\cachelocal"]);
});

test("filesystem provider includes rollout files even when metadata is incomplete", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  const sessionsDir = path.join(root, "sessions", "2026", "06", "28");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const sessionId = "019f098d-7192-7333-8d97-e3d56ba6b50b";
  fs.writeFileSync(
    path.join(sessionsDir, `rollout-2026-06-27T22-48-17-${sessionId}.jsonl`),
    `${JSON.stringify({
      timestamp: "2026-06-27T22:48:17.000Z",
      type: "response_item",
      payload: {
        type: "message",
        content: "metadata is not available in the first rows"
      }
    })}\n`,
    "utf8"
  );

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  const sessions = provider.listSessions();

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.id, sessionId);
  assert.equal(sessions[0]?.sessionId, sessionId);
  assert.equal(typeof sessions[0]?.updatedAt, "number");
});

test("filesystem provider derives a title from rollout user messages when index is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  const sessionsDir = path.join(root, "sessions", "2026", "06", "28");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const sessionId = "019f098d-7192-7333-8d97-e3d56ba6b50b";
  fs.writeFileSync(
    path.join(sessionsDir, `rollout-2026-06-27T22-48-17-${sessionId}.jsonl`),
    [
      JSON.stringify({
        type: "session_meta",
        payload: {
          id: sessionId,
          cwd: "E:\\Workspace\\VSCode\\test",
          source: "vscode"
        }
      }),
      JSON.stringify({
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "# AGENTS.md instructions\n\n<INSTRUCTIONS>not a title</INSTRUCTIONS>"
            }
          ]
        }
      }),
      JSON.stringify({
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "vscode codex插件和codex桌面端会话内容是分开的吗？"
        }
      })
    ].join("\n"),
    "utf8"
  );

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  const sessions = provider.listSessions();

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.preview, "vscode codex插件和codex桌面端会话内容是分开的吗？");
});

test("filesystem provider derives a title from Codex image request wrappers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  const sessionsDir = path.join(root, "sessions", "2026", "06", "28");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const sessionId = "019f098d-7192-7333-8d97-e3d56ba6b50c";
  fs.writeFileSync(
    path.join(sessionsDir, `rollout-2026-06-28T22-48-17-${sessionId}.jsonl`),
    `${JSON.stringify({
      type: "event_msg",
      payload: {
        type: "user_message",
        message:
          "\n# Files mentioned by the user:\n\n## a.png: C:/a.png\n\n## My request for Codex:\n这个显示不一致，是因为桌面端还没退出吗？\n<image name=[Image #1] path=\"C:\\a.png\">"
      }
    })}\n`,
    "utf8"
  );

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  const sessions = provider.listSessions();

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.preview, "这个显示不一致，是因为桌面端还没退出吗？");
});

test("filesystem provider sorts unindexed rollout files by file timestamp fallback", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  const sessionsDir = path.join(root, "sessions", "2026", "06", "28");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const olderId = "019f098d-7192-7333-8d97-e3d56ba6b50b";
  const newerId = "019f098d-7192-7333-8d97-e3d56ba6b50c";
  const olderPath = path.join(sessionsDir, `rollout-2026-06-27T22-48-17-${olderId}.jsonl`);
  const newerPath = path.join(sessionsDir, `rollout-2026-06-28T22-48-17-${newerId}.jsonl`);
  fs.writeFileSync(olderPath, "{}\n", "utf8");
  fs.writeFileSync(newerPath, "{}\n", "utf8");
  fs.utimesSync(olderPath, new Date("2026-06-27T00:00:00Z"), new Date("2026-06-27T00:00:00Z"));
  fs.utimesSync(newerPath, new Date("2026-06-28T00:00:00Z"), new Date("2026-06-28T00:00:00Z"));

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  const sessions = provider.listSessions();

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0]?.id, newerId);
  assert.equal(sessions[1]?.id, olderId);
});

test("filesystem provider keeps the newest index title for renamed sessions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-manager-"));
  const sessionsDir = path.join(root, "sessions", "2026", "06", "28");
  fs.mkdirSync(sessionsDir, { recursive: true });

  fs.writeFileSync(
    path.join(root, "session_index.jsonl"),
    [
      JSON.stringify({
        id: "renamed-session",
        thread_name: "CPA配置",
        updated_at: "2026-06-28T01:00:00Z"
      }),
      JSON.stringify({
        id: "renamed-session",
        thread_name: "CPA配置1",
        updated_at: "2026-06-28T01:02:00Z"
      })
    ].join("\n"),
    "utf8"
  );

  fs.writeFileSync(
    path.join(sessionsDir, "renamed-session.jsonl"),
    `${JSON.stringify({
      type: "session_meta",
      payload: {
        id: "renamed-session",
        cwd: "E:\\Workspace\\VSCode\\test",
        source: "vscode"
      }
    })}\n`,
    "utf8"
  );

  const provider = new CodexFilesystemProvider({
    codexHome: root,
    logger: makeLogger()
  });

  const sessions = provider.listSessions();

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.name, "CPA配置1");
  assert.equal(sessions[0]?.preview, "CPA配置1");
});
