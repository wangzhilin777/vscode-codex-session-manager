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
  | "execSourceLabel"
  | "filesystemSourceLabel"
  | "fallbackActive"
  | "inputSearchFilter"
  | "missingOfficial"
  | "officialMissing"
  | "officialOpenFailed"
  | "officialReady"
  | "openOfficialTooltip"
  | "otherGroupDescription"
  | "otherGroupLabel"
  | "projectLabel"
  | "searchLabel"
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
  | "updatedLabel"
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
  execSourceLabel: "Exec",
  filesystemSourceLabel: "Filesystem",
  fallbackActive: "fallback active",
  inputSearchFilter: "Set a session search filter",
  missingOfficial: "Official Codex VS Code extension was not detected. Opened the local details page instead.",
  officialMissing: "official missing",
  officialOpenFailed: "Failed to open the official Codex conversation. Opened the local details page instead.",
  officialReady: "official ready",
  openOfficialTooltip: "Click to open this conversation in the official Codex panel.",
  otherGroupDescription: "Sessions from other workspaces or historical projects",
  otherGroupLabel: "Other Workspaces",
  projectLabel: "Project",
  searchLabel: "search",
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
  updatedLabel: "Updated",
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
  execSourceLabel: "执行会话",
  filesystemSourceLabel: "本地文件",
  fallbackActive: "已启用兜底",
  inputSearchFilter: "设置会话搜索过滤",
  missingOfficial: "未检测到官方 Codex VS Code 插件，已回退到本地详情页。",
  officialMissing: "官方缺失",
  officialOpenFailed: "打开官方 Codex 会话失败，已回退到本地详情页。",
  officialReady: "官方就绪",
  openOfficialTooltip: "点击后会优先打开官方 Codex 会话。",
  otherGroupDescription: "其他工作区或历史项目",
  otherGroupLabel: "其他工作区",
  projectLabel: "项目",
  searchLabel: "搜索",
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
  updatedLabel: "更新",
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
