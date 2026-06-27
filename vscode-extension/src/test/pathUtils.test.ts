import test from "node:test";
import assert from "node:assert/strict";
import { basenameOrPath, isPathInside, normalizeFsPath, pickLongestMatchingRoot } from "../utils/pathUtils";

test("normalizeFsPath normalizes windows namespace prefixes", () => {
  assert.equal(normalizeFsPath("\\\\?\\C:\\Users\\Test\\Work"), process.platform === "win32" ? "c:\\users\\test\\work" : "\\\\?\\C:\\Users\\Test\\Work");
});

test("isPathInside detects nested folders", () => {
  assert.equal(isPathInside("E:\\Workspace\\VSCode\\test\\plugins", "E:\\Workspace\\VSCode\\test"), true);
  assert.equal(isPathInside("E:\\Workspace\\VSCode\\other", "E:\\Workspace\\VSCode\\test"), false);
});

test("pickLongestMatchingRoot prefers the deepest workspace root", () => {
  const result = pickLongestMatchingRoot("E:\\Workspace\\VSCode\\test\\plugins\\demo", [
    "E:\\Workspace\\VSCode",
    "E:\\Workspace\\VSCode\\test"
  ]);
  assert.equal(result, "E:\\Workspace\\VSCode\\test");
});

test("basenameOrPath falls back to the full path for roots", () => {
  assert.equal(basenameOrPath("E:\\"), "E:\\");
});
