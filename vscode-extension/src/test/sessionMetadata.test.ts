import test from "node:test";
import assert from "node:assert/strict";
import { metadataForRawSession } from "../data/sessionMetadata";
import { RawSessionRecord } from "../types";

function makeRaw(patch: Partial<RawSessionRecord>): RawSessionRecord {
  return {
    id: "thread-id",
    sessionId: "session-id",
    preview: "",
    name: "",
    cwd: "",
    path: "",
    source: "appServer",
    createdAt: null,
    updatedAt: null,
    archived: false,
    modelProvider: "",
    cliVersion: "",
    gitBranch: "",
    gitSha: "",
    ...patch
  };
}

test("metadataForRawSession prefers sessionId over app-server thread id", () => {
  const metadata = metadataForRawSession(makeRaw({}), {
    "thread-id": {
      alias: "Old thread alias",
      projectTag: "",
      note: "",
      pinned: false,
      unread: false
    },
    "session-id": {
      alias: "Session alias",
      projectTag: "",
      note: "",
      pinned: true,
      unread: true
    }
  });

  assert.equal(metadata.alias, "Session alias");
  assert.equal(metadata.pinned, true);
  assert.equal(metadata.unread, true);
});

test("metadataForRawSession falls back to raw id for older local metadata", () => {
  const metadata = metadataForRawSession(makeRaw({}), {
    "thread-id": {
      alias: "Thread alias",
      projectTag: "",
      note: "",
      pinned: false,
      unread: true
    }
  });

  assert.equal(metadata.alias, "Thread alias");
  assert.equal(metadata.unread, true);
});
