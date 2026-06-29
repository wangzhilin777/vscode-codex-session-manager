type MessageKey =
  | "activityName"
  | "activeSessionsGroupDescription"
  | "activeSessionsGroupLabel"
  | "archivedBadge"
  | "archivedGroupDescription"
  | "archivedGroupLabel"
  | "archivedSourceLabel"
  | "allWorkspacesLabel"
  | "cachedSnapshotLabel"
  | "currentGroupDescription"
  | "currentGroupLabel"
  | "desktopAppSourceLabel"
  | "desktopPinnedManagedByDesktop"
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
  | "inlineAliasLabel"
  | "inlineArchiveLabel"
  | "inlineCancelLabel"
  | "inlineClearLabel"
  | "inlineDeleteLabel"
  | "inlineDetailsLabel"
  | "inlineEditingPrefix"
  | "inlineFilteredSummary"
  | "inlineHideArchivedLabel"
  | "inlineNoMatchesLabel"
  | "inlineNoteLabel"
  | "inlineOpenLabel"
  | "inlineProjectTagLabel"
  | "inlineRefreshLabel"
  | "inlineRenameLabel"
  | "inlineResultSummary"
  | "inlineSaveLabel"
  | "inlineSearchInPanelLabel"
  | "inlineSearchTitle"
  | "inlineShowArchivedLabel"
  | "inlineUnarchiveLabel"
  | "loadingSessionsForSearch"
  | "metadataSavedMessage"
  | "missingOfficial"
  | "noSessionsAvailable"
  | "noWorkspaceGroupDescription"
  | "noWorkspaceGroupLabel"
  | "noteLabel"
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
  | "sessionLocalUnpinnedDesktopStillPinned"
  | "sessionRenamedMessage"
  | "sessionUnpinned"
  | "sessionUnarchivedMessage"
  | "searchLabel"
  | "searchSessionsPlaceholder"
  | "searchSessionsTitle"
  | "resumeStarted"
  | "sessionFileMissing"
  | "sessionNotFoundMessage"
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
  activeSessionsGroupDescription: "Active sessions",
  activeSessionsGroupLabel: "Sessions",
  archivedBadge: "Archived",
  archivedGroupDescription: "Archived sessions",
  archivedGroupLabel: "Archived",
  archivedSourceLabel: "Archived",
  allWorkspacesLabel: "All Workspaces",
  cachedSnapshotLabel: "cached",
  currentGroupDescription: "Sessions matched to the current workspace",
  currentGroupLabel: "Current Workspace",
  desktopAppSourceLabel: "Desktop App",
  desktopPinnedManagedByDesktop: "\"{title}\" is pinned by Codex desktop. Unpin it in the desktop app, then refresh this view.",
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
  inlineAliasLabel: "alias",
  inlineArchiveLabel: "Archive",
  inlineCancelLabel: "Cancel",
  inlineClearLabel: "Clear",
  inlineDeleteLabel: "Delete",
  inlineDetailsLabel: "Details",
  inlineEditingPrefix: "Editing ",
  inlineFilteredSummary: "{visible} matched / {total} total",
  inlineHideArchivedLabel: "Hide Archived",
  inlineNoMatchesLabel: "No sessions match this search.",
  inlineNoteLabel: "note",
  inlineOpenLabel: "Open",
  inlineProjectTagLabel: "project tag",
  inlineRefreshLabel: "Refresh",
  inlineRenameLabel: "Rename",
  inlineResultSummary: "{visible} visible / {total} total",
  inlineSaveLabel: "Save",
  inlineSearchInPanelLabel: "Search and edit sessions in this panel.",
  inlineSearchTitle: "Search And Edit",
  inlineShowArchivedLabel: "Show Archived",
  inlineUnarchiveLabel: "Unarchive",
  loadingSessionsForSearch: "No cache is available yet. Loading Codex sessions before search.",
  metadataSavedMessage: "Saved {label} for \"{title}\".",
  missingOfficial: "Official Codex VS Code extension was not detected. Opened the local details page instead.",
  noSessionsAvailable: "No Codex sessions were found.",
  noWorkspaceGroupDescription: "Sessions that do not have a workspace assignment",
  noWorkspaceGroupLabel: "No Workspace",
  noteLabel: "Note",
  officialMissing: "official missing",
  officialOpenFailed: "Failed to open the official Codex conversation. Opened the local details page instead.",
  officialReady: "official ready",
  openOfficialTooltip: "Click to continue in the official Codex panel. Use the context menu for the local details page.",
  otherGroupDescription: "Sessions assigned to other workspaces",
  otherGroupLabel: "Other Workspaces",
  projectLabel: "Project",
  pinnedBadge: "Pinned",
  sessionArchivedMessage: "Archived session \"{title}\".",
  sessionMarkedRead: "Marked \"{title}\" as read.",
  sessionMarkedUnread: "Marked \"{title}\" as unread.",
  sessionPinned: "Pinned \"{title}\".",
  sessionLocalUnpinnedDesktopStillPinned: "Removed the local pin for \"{title}\". It is still pinned by Codex desktop.",
  sessionRenamedMessage: "Renamed session to \"{title}\".",
  sessionUnpinned: "Unpinned \"{title}\".",
  sessionUnarchivedMessage: "Unarchived session \"{title}\".",
  searchLabel: "search",
  searchSessionsPlaceholder: "Search by title, preview, note, path, project, or session ID",
  searchSessionsTitle: "Search Codex Sessions",
  resumeStarted: "Started Codex resume in the terminal.",
  sessionFileMissing: "This session has no local session file path.",
  sessionNotFoundMessage: "Session {sessionId} was not found in the current cache. Refresh and try again.",
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
  activeSessionsGroupDescription: "未归档的当前会话",
  activeSessionsGroupLabel: "会话",
  archivedBadge: "已归档",
  archivedGroupDescription: "已归档的历史会话",
  archivedGroupLabel: "已归档",
  archivedSourceLabel: "归档",
  allWorkspacesLabel: "全部工作区",
  cachedSnapshotLabel: "已缓存",
  currentGroupDescription: "当前工作区命中的会话",
  currentGroupLabel: "本工作区",
  desktopAppSourceLabel: "桌面端",
  desktopPinnedManagedByDesktop: "“{title}”由 Codex 桌面端置顶，请在桌面端取消置顶后刷新插件视图。",
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
  inlineAliasLabel: "别名",
  inlineArchiveLabel: "归档",
  inlineCancelLabel: "取消",
  inlineClearLabel: "清除",
  inlineDeleteLabel: "删除",
  inlineDetailsLabel: "详情",
  inlineEditingPrefix: "正在编辑",
  inlineFilteredSummary: "命中 {visible} 条 / 共 {total} 条",
  inlineHideArchivedLabel: "隐藏归档",
  inlineNoMatchesLabel: "没有匹配的会话。",
  inlineNoteLabel: "备注",
  inlineOpenLabel: "打开",
  inlineProjectTagLabel: "项目标签",
  inlineRefreshLabel: "刷新",
  inlineRenameLabel: "重命名",
  inlineResultSummary: "显示 {visible} 条 / 共 {total} 条",
  inlineSaveLabel: "保存",
  inlineSearchInPanelLabel: "可直接在这里搜索和编辑会话。",
  inlineSearchTitle: "搜索与编辑",
  inlineShowArchivedLabel: "显示归档",
  inlineUnarchiveLabel: "取消归档",
  loadingSessionsForSearch: "当前还没有缓存，正在先加载 Codex 会话再搜索。",
  metadataSavedMessage: "已保存“{title}”的{label}。",
  missingOfficial: "未检测到官方 Codex VS Code 插件，已回退到本地详情页。",
  noSessionsAvailable: "没有找到 Codex 会话。",
  noWorkspaceGroupDescription: "还没有工作区归属的会话",
  noWorkspaceGroupLabel: "无工作区",
  noteLabel: "备注",
  officialMissing: "官方缺失",
  officialOpenFailed: "打开官方 Codex 会话失败，已回退到本地详情页。",
  officialReady: "官方就绪",
  openOfficialTooltip: "单击会优先在官方 Codex 继续；本地详情页请从右键菜单打开。",
  otherGroupDescription: "已归属到其他工作区的会话",
  otherGroupLabel: "其他工作区",
  projectLabel: "项目",
  pinnedBadge: "已置顶",
  sessionArchivedMessage: "已归档会话“{title}”。",
  sessionMarkedRead: "已将“{title}”标记为已读。",
  sessionMarkedUnread: "已将“{title}”标记为未读。",
  sessionPinned: "已置顶“{title}”。",
  sessionLocalUnpinnedDesktopStillPinned: "已取消“{title}”的插件本地置顶；该会话仍由 Codex 桌面端置顶。",
  sessionRenamedMessage: "已重命名为“{title}”。",
  sessionUnpinned: "已取消置顶“{title}”。",
  sessionUnarchivedMessage: "已取消归档会话“{title}”。",
  searchLabel: "搜索",
  searchSessionsPlaceholder: "可按标题、预览、备注、路径、项目或会话 ID 搜索",
  searchSessionsTitle: "搜索 Codex 会话",
  resumeStarted: "已在终端启动 Codex 继续会话。",
  sessionFileMissing: "这个会话没有本地会话文件路径。",
  sessionNotFoundMessage: "当前缓存里没有找到会话 {sessionId}，请刷新后重试。",
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
