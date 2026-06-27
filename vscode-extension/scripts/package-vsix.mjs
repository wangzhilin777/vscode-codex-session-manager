import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const extensionDir = path.resolve(currentDir, "..");
const packageJson = JSON.parse(readFileSync(path.join(extensionDir, "package.json"), "utf8"));
const distDir = path.resolve(extensionDir, "..", "dist");
const fileName = `${packageJson.publisher}.${packageJson.name}-${packageJson.version}.vsix`;
const outPath = path.join(distDir, fileName);
const vsceEntrypoint = path.join(extensionDir, "node_modules", "@vscode", "vsce", "vsce");

mkdirSync(distDir, { recursive: true });

const result = spawnSync(
  process.execPath,
  [vsceEntrypoint, "package", "--allow-missing-repository", "--out", outPath],
  {
    cwd: extensionDir,
    stdio: "inherit"
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
