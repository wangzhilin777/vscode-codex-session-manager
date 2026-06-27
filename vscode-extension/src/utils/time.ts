export function formatRelativeTime(unixSeconds: number | null): string {
  if (!unixSeconds) {
    return "unknown";
  }

  const deltaSeconds = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  if (deltaSeconds < 3600) {
    return `${Math.floor(deltaSeconds / 60)}m ago`;
  }
  if (deltaSeconds < 86400) {
    return `${Math.floor(deltaSeconds / 3600)}h ago`;
  }
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
}

export function formatAbsoluteTime(unixSeconds: number | null): string {
  if (!unixSeconds) {
    return "unknown";
  }
  return new Date(unixSeconds * 1000).toLocaleString();
}

export function formatIsoNow(): string {
  return new Date().toISOString();
}
