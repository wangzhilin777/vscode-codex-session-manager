type MessageKey =
  | "activityName"
  | "archivedBadge"
  | "archivedGroupDescription"
  | "archivedGroupLabel"
  | "archivedSourceLabel"
  | "allWorkspacesLabel"
  | "currentGroupDescription"
  | "currentGroupLabel"
  | "desktopAppSourceLabel"
  | "deleteOnlyArchived"
  | "deleteSessionConfirmButton"
  | "deleteSessionConfirmDetail"
  | "deleteSessionConfirmMessage"
  | "deleteSessionFailed"
  | "deleteSessionSucceeded"
  | "execSourceLabel"
  | "filesystemSourceLabel"
  | "fallbackActive"
  | "forkStarted"
  | "inputSearchFilter"
  | "metadataSavedMessage"
  | "missingOfficial"
  | "officialMissing"
  | "officialOpenFailed"
  | "officialReady"
  | "openOfficialTooltip"
  | "otherGroupDescription"
  | "otherGroupLabel"
  | "projectLabel"
  | "pinnedBadge"
  | "sessionArchivedMessage"
  | "sessionMarkedRead"
  | "sessionMarkedUnread"
  | "sessionPinned"
  | "sessionRenamedMessage"
  | "sessionUnpinned"
  | "sessionUnarchivedMessage"
  | "searchLabel"
  | "resumeStarted"
  | "sessionFileMissing"
  | "showAllWorkspacesMessage"
  | "showCurrentWorkspaceMessage"
  | "sourceLabel"
  | "subagentSourceLabel"
  | "switchingWorkspaceForSession"
  | "unarchiveFailed"
  | "unarchivingBeforeOpen"
  | "unknownGroupDescription"
  | "unknownGroupLabel"
  | "unknownSourceLabel"
  | "unarchiveSessionConfirmButton"
  | "unarchiveSessionConfirmMessage"
  | "unreadBadge"
  | "updatedLabel"
  | "valueCopied"
  | "workingDirectoryMissing"
  | "workspacePathMissing";

const en: Record<MessageKey, string> = {
  activityName: "Codex Sessions",
  archivedBadge: "Archived",
  archivedGroupDescription: "Archived sessions",
  archivedGroupLabel: "Archived",
  archivedSourceLabel: "Archived",
  allWorkspacesLabel: "All Workspaces",
  currentGroupDescription: "Sessions matched to the current workspace",
  currentGroupLabel: "Current Workspace",
  desktopAppSourceLabel: "Desktop App",
  deleteOnlyArchived: "Only archived sessions can be deleted from this view.",
  deleteSessionConfirmButton: "Delete Session",
  deleteSessionConfirmDetail: "This removes the local Codex session file from CODEX_HOME. This operation cannot be undone.",
  deleteSessionConfirmMessage: "Delete archived session \"{title}\"?",
  deleteSessionFailed: "Failed to delete session {sessionId}. The session file was not found under CODEX_HOME.",
  deleteSessionSucceeded: "Deleted archived session \"{title}\".",
  execSourceLabel: "Exec",
  filesystemSourceLabel: "Filesystem",
  fallbackActive: "fallback active",
  forkStarted: "Started Codex fork in the terminal.",
  inputSearchFilter: "Set a session search filter",
  metadataSavedMessage: "Saved {label} for \"{title}\".",
  missingOfficial: "Official Codex VS Code extension was not detected. Opened the local details page instead.",
  officialMissing: "official missing",
  officialOpenFailed: "Failed to open the official Codex conversation. Opened the local details page instead.",
  officialReady: "official ready",
  openOfficialTooltip: "Click to continue in the official Codex panel. Use the context menu for the local details page.",
  otherGroupDescription: "Sessions from other workspaces or historical projects",
  otherGroupLabel: "Other Workspaces",
  projectLabel: "Project",
  pinnedBadge: "Pinned",
  sessionArchivedMessage: "Archived session \"{title}\".",
  sessionMarkedRead: "Marked \"{title}\" as read.",
  sessionMarkedUnread: "Marked \"{title}\" as unread.",
  sessionPinned: "Pinned \"{title}\".",
  sessionRenamedMessage: "Renamed session to \"{title}\".",
  sessionUnpinned: "Unpinned \"{title}\".",
  sessionUnarchivedMessage: "Unarchived session \"{title}\".",
  searchLabel: "search",
  resumeStarted: "Started Codex resume in the terminal.",
  sessionFileMissing: "This session has no local session file path.",
  showAllWorkspacesMessage: "Showing all workspaces.",
  showCurrentWorkspaceMessage: "Showing the current workspace.",
  sourceLabel: "Source",
  subagentSourceLabel: "Subagent",
  switchingWorkspaceForSession: "Switching VS Code to {path}; Codex will open the selected conversation after the workspace reloads.",
  unarchiveFailed: "Failed to unarchive session {sessionId}. Please run codex unarchive manually and try again.",
  unarchivingBeforeOpen: "This session is archived. Unarchiving it before opening in Codex.",
  unknownGroupDescription: "Sessions without a usable path or project mapping",
  unknownGroupLabel: "Uncategorized",
  unknownSourceLabel: "Unknown",
  unarchiveSessionConfirmButton: "Unarchive",
  unarchiveSessionConfirmMessage: "Unarchive session \"{title}\"?",
  unreadBadge: "Unread",
  updatedLabel: "Updated",
  valueCopied: "Copied {label}.",
  workingDirectoryMissing: "This session has no usable working directory.",
  workspacePathMissing: "workspace path not found: {path}"
};

const zh: Record<MessageKey, string> = {
  activityName: "Codex 会话",
  archivedBadge: "已归档",
  archivedGroupDescription: "已归档的历史会话",
  archivedGroupLabel: "已归档",
  archivedSourceLabel: "归档",
  allWorkspacesLabel: "全部工作区",
  currentGroupDescription: "当前工作区命中的会话",
  currentGroupLabel: "本工作区",
  desktopAppSourceLabel: "桌面端",
  deleteOnlyArchived: "当前视图只允许删除已归档会话。",
  deleteSessionConfirmButton: "删除会话",
  deleteSessionConfirmDetail: "这会删除 CODEX_HOME 下的本地 Codex 会话文件，操作不可撤销。",
  deleteSessionConfirmMessage: "确定删除已归档会话“{title}”吗？",
  deleteSessionFailed: "删除会话 {sessionId} 失败：未在 CODEX_HOME 下找到对应会话文件。",
  deleteSessionSucceeded: "已删除归档会话“{title}”。",
  execSourceLabel: "执行会话",
  filesystemSourceLabel: "本地文件",
  fallbackActive: "已启用兜底",
  forkStarted: "已在终端启动 Codex 派生。",
  inputSearchFilter: "设置会话搜索过滤",
  metadataSavedMessage: "已保存“{title}”的{label}。",
  missingOfficial: "未检测到官方 Codex VS Code 插件，已回退到本地详情页。",
  officialMissing: "官方缺失",
  officialOpenFailed: "打开官方 Codex 会话失败，已回退到本地详情页。",
  officialReady: "官方就绪",
  openOfficialTooltip: "单击会优先在官方 Codex 继续；本地详情页请从右键菜单打开。",
  otherGroupDescription: "其他工作区或历史项目",
  otherGroupLabel: "其他工作区",
  projectLabel: "项目",
  pinnedBadge: "已置顶",
  sessionArchivedMessage: "已归档会话“{title}”。",
  sessionMarkedRead: "已将“{title}”标记为已读。",
  sessionMarkedUnread: "已将“{title}”标记为未读。",
  sessionPinned: "已置顶“{title}”。",
  sessionRenamedMessage: "已重命名为“{title}”。",
  sessionUnpinned: "已取消置顶“{title}”。",
  sessionUnarchivedMessage: "已取消归档会话“{title}”。",
  searchLabel: "搜索",
  resumeStarted: "已在终端启动 Codex 继续会话。",
  sessionFileMissing: "这个会话没有本地会话文件路径。",
  showAllWorkspacesMessage: "已显示全部工作区。",
  showCurrentWorkspaceMessage: "已显示本工作区。",
  sourceLabel: "来源",
  subagentSourceLabel: "子代理",
  switchingWorkspaceForSession: "正在切换 VS Code 到 {path}；工作区重载后会自动打开选中的 Codex 会话。",
  unarchiveFailed: "取消归档会话 {sessionId} 失败，请手动运行 codex unarchive 后重试。",
  unarchivingBeforeOpen: "该会话已归档，正在先取消归档再打开 Codex。",
  unknownGroupDescription: "缺少路径或无法归属项目",
  unknownGroupLabel: "未归类",
  unknownSourceLabel: "未知",
  unarchiveSessionConfirmButton: "取消归档",
  unarchiveSessionConfirmMessage: "确定取消归档会话“{title}”吗？",
  unreadBadge: "未读",
  updatedLabel: "更新",
  valueCopied: "已复制{label}。",
  workingDirectoryMissing: "这个会话没有可用的工作目录。",
  workspacePathMissing: "工作区路径不存在：{path}"
};

let currentLanguage = inferInitialLanguage();

function inferInitialLanguage(): string {
  const config = process.env.VSCODE_NLS_CONFIG;
  if (config) {
    try {
      const parsed = JSON.parse(config) as { locale?: unknown };
      if (typeof parsed.locale === "string") {
        return parsed.locale;
      }
    } catch {
      // Ignore malformed host metadata and fall back to process locale.
    }
  }
  return process.env.LANG ?? "en";
}

export function configureLanguage(language: string): void {
  currentLanguage = language || "en";
}

export function isChineseLanguage(): boolean {
  return currentLanguage.toLowerCase().startsWith("zh");
}

export function t(key: MessageKey, values: Record<string, string> = {}): string {
  const catalog = isChineseLanguage() ? zh : en;
  return (catalog[key] ?? en[key]).replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? "");
}
