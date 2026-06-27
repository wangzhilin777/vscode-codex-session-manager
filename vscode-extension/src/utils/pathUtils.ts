import path from "node:path";

export function stripWindowsNamespacePrefix(value: string): string {
  return value.startsWith("\\\\?\\") ? value.slice(4) : value;
}

export function normalizeFsPath(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const trimmed = stripWindowsNamespacePrefix(String(value).trim());
  if (!trimmed) {
    return "";
  }

  const normalized = path.normalize(trimmed);
  if (process.platform === "win32") {
    return normalized.replace(/\//g, "\\").toLowerCase();
  }
  return normalized;
}

export function toDisplayPath(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return stripWindowsNamespacePrefix(path.normalize(String(value).trim()));
}

export function pathsEqual(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeFsPath(left);
  const b = normalizeFsPath(right);
  return !!a && a === b;
}

export function isPathInside(child: string | null | undefined, parent: string | null | undefined): boolean {
  const normalizedChild = normalizeFsPath(child);
  const normalizedParent = normalizeFsPath(parent);

  if (!normalizedChild || !normalizedParent) {
    return false;
  }

  if (normalizedChild === normalizedParent) {
    return true;
  }

  const boundary = normalizedParent.endsWith(path.sep) ? normalizedParent : `${normalizedParent}${path.sep}`;
  return normalizedChild.startsWith(boundary);
}

export function pickLongestMatchingRoot(targetPath: string, roots: readonly string[]): string {
  let winner = "";
  for (const root of roots) {
    if (!root) {
      continue;
    }
    if (isPathInside(targetPath, root) && normalizeFsPath(root).length > normalizeFsPath(winner).length) {
      winner = root;
    }
  }
  return winner;
}

export function basenameOrPath(value: string): string {
  const display = toDisplayPath(value);
  if (!display) {
    return "";
  }
  const base = path.basename(display);
  return base || display;
}

export function sanitizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}
