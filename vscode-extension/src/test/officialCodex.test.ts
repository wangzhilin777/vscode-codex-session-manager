import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOfficialCodexConversationPath,
  buildOfficialCodexConversationUriString
} from "../utils/officialCodexRoute";

test("buildOfficialCodexConversationPath uses the official local route prefix", () => {
  assert.equal(
    buildOfficialCodexConversationPath("019e9f75-2682-7e21-9e46-bf93fd68d1e5"),
    "/local/019e9f75-2682-7e21-9e46-bf93fd68d1e5"
  );
});

test("buildOfficialCodexConversationUriString uses the VS Code uri scheme and official extension id", () => {
  assert.equal(
    buildOfficialCodexConversationUriString("vscode", "019e9f75-2682-7e21-9e46-bf93fd68d1e5"),
    "vscode://openai.chatgpt/local/019e9f75-2682-7e21-9e46-bf93fd68d1e5"
  );
});

test("buildOfficialCodexConversationUriString encodes reserved characters", () => {
  assert.equal(
    buildOfficialCodexConversationUriString("vscode-insiders", "session with spaces/and?#"),
    "vscode-insiders://openai.chatgpt/local/session%20with%20spaces%2Fand%3F%23"
  );
});
