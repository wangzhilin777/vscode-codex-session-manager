import fs from "node:fs";
import path from "node:path";
import { SessionRecord } from "../types";
import { isPathInside } from "./pathUtils";

const ROLLOUT_FILE_PATTERN = /^rollout-(\d{4})-(\d{2})-(\d{2})T.*-[0-9a-fA-F-]{36}\.jsonl$/;

export interface SessionFileOperationOptions {
  codexHome: string;
}

function sessionsRoot(codexHome: string): string {
  return path.resolve(codexHome, "sessions");
}

function archivedRoot(codexHome: string): string {
  return path.resolve(codexHome, "archived_sessions");
}

function isJsonlFile(filePath: string): boolean {
  return path.basename(filePath).endsWith(".jsonl");
}

function isDeletableSessionPath(filePath: string, codexHome: string): boolean {
  const resolved = path.resolve(filePath);
  return isJsonlFile(resolved) && (isPathInside(resolved, sessionsRoot(codexHome)) || isPathInside(resolved, archivedRoot(codexHome)));
}

function walkJsonlFiles(rootPath: string): string[] {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const results: string[] = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(resolved);
        continue;
      }
      if (entry.isFile() && isJsonlFile(resolved)) {
        results.push(resolved);
      }
    }
  }

  return results;
}

function safeExistingSessionPath(candidate: string, codexHome: string): string {
  const resolved = path.resolve(candidate);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return "";
  }
  return isDeletableSessionPath(resolved, codexHome) ? resolved : "";
}

export function findSessionFilePath(session: SessionRecord, options: SessionFileOperationOptions): string {
  const codexHome = path.resolve(options.codexHome);
  if (session.path) {
    const direct = safeExistingSessionPath(session.path, codexHome);
    if (direct) {
      return direct;
    }
  }

  for (const root of [sessionsRoot(codexHome), archivedRoot(codexHome)]) {
    for (const filePath of walkJsonlFiles(root)) {
      if (path.basename(filePath).includes(session.sessionId)) {
        return filePath;
      }
    }
  }

  return "";
}

export function deleteSessionFile(session: SessionRecord, options: SessionFileOperationOptions): string {
  const codexHome = path.resolve(options.codexHome);
  const filePath = findSessionFilePath(session, { codexHome });
  if (!filePath || !isDeletableSessionPath(filePath, codexHome)) {
    return "";
  }

  fs.rmSync(filePath, { force: true });
  return filePath;
}

export function archiveSessionFile(session: SessionRecord, options: SessionFileOperationOptions): boolean {
  const codexHome = path.resolve(options.codexHome);
  const sourcePath = findSessionFilePath(session, { codexHome });
  if (!sourcePath || !isPathInside(sourcePath, sessionsRoot(codexHome))) {
    return false;
  }

  const fileName = path.basename(sourcePath);
  const targetDir = archivedRoot(codexHome);
  const targetPath = path.resolve(targetDir, fileName);
  if (!isPathInside(targetPath, targetDir)) {
    return false;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  if (fs.existsSync(targetPath)) {
    fs.rmSync(sourcePath, { force: true });
    return true;
  }

  fs.renameSync(sourcePath, targetPath);
  return true;
}

export function unarchiveSessionFile(session: SessionRecord, options: SessionFileOperationOptions): boolean {
  const codexHome = path.resolve(options.codexHome);
  const sourcePath = findSessionFilePath(session, { codexHome });
  if (!sourcePath || !isPathInside(sourcePath, archivedRoot(codexHome))) {
    return false;
  }

  const fileName = path.basename(sourcePath);
  const match = fileName.match(ROLLOUT_FILE_PATTERN);
  if (!match) {
    return false;
  }

  const targetDir = path.resolve(sessionsRoot(codexHome), match[1] ?? "", match[2] ?? "", match[3] ?? "");
  const targetPath = path.resolve(targetDir, fileName);
  if (!isPathInside(targetPath, sessionsRoot(codexHome))) {
    return false;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  if (fs.existsSync(targetPath)) {
    fs.rmSync(sourcePath, { force: true });
    return true;
  }

  fs.renameSync(sourcePath, targetPath);
  return true;
}
