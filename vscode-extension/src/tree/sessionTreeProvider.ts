import * as vscode from "vscode";
import { SessionGroup, SessionRecord, ProjectBucket, RepositorySnapshot } from "../types";
import { formatRelativeTime } from "../utils/time";
import { projectBucketsForGroup } from "../data/sessionTransforms";
import { t } from "../utils/i18n";

const PROJECT_LABEL_PREFIX = "\u00a0\u00a0";
const ARCHIVE_LABEL_PREFIX = "\u00a0\u00a0\u00a0\u00a0";
const SESSION_LABEL_PREFIX = "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0";

export type TreeNode = GroupNode | ProjectNode | ProjectArchiveNode | SessionNode;

export class GroupNode {
  public constructor(public readonly group: SessionGroup) {}
}

export class ProjectNode {
  public constructor(public readonly group: SessionGroup, public readonly project: ProjectBucket) {}
}

export class ProjectArchiveNode {
  public constructor(public readonly group: SessionGroup, public readonly project: ProjectBucket, public readonly sessions: SessionRecord[]) {}
}

export class SessionNode {
  public constructor(public readonly group: SessionGroup, public readonly project: ProjectBucket, public readonly session: SessionRecord) {}
}

export class SessionTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TreeNode | undefined>();
  private groups: SessionGroup[] = [];
  private snapshot: RepositorySnapshot | null = null;

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public setSnapshot(snapshot: RepositorySnapshot, groups: SessionGroup[]): void {
    this.snapshot = snapshot;
    this.groups = groups;
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  public getSnapshot(): RepositorySnapshot | null {
    return this.snapshot;
  }

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  public getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element instanceof GroupNode) {
      const collapsibleState =
        element.group.kind === "other" ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded;
      const item = new vscode.TreeItem(element.group.label, collapsibleState);
      item.description = `${element.group.sessions.length}`;
      item.tooltip = element.group.description;
      item.contextValue = "group";
      item.iconPath = new vscode.ThemeIcon("folder-library");
      return item;
    }

    if (element instanceof ProjectNode) {
      const collapsibleState =
        element.group.kind === "other" ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded;
      const item = new vscode.TreeItem(`${PROJECT_LABEL_PREFIX}${element.project.label}`, collapsibleState);
      item.description = `${element.project.sessions.length}`;
      item.tooltip = element.project.description || element.project.label;
      item.contextValue = "project";
      item.iconPath = new vscode.ThemeIcon("folder");
      return item;
    }

    if (element instanceof ProjectArchiveNode) {
      const item = new vscode.TreeItem(`${ARCHIVE_LABEL_PREFIX}${t("archivedGroupLabel")}`, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = `${element.sessions.length}`;
      item.tooltip = t("archivedGroupDescription");
      item.contextValue = "archiveBucket";
      item.iconPath = new vscode.ThemeIcon("archive", new vscode.ThemeColor("charts.orange"));
      return item;
    }

    const item = new vscode.TreeItem(`${SESSION_LABEL_PREFIX}${element.session.displayName}`, vscode.TreeItemCollapsibleState.None);
    const stateLabels = [
      element.session.archived ? t("archivedBadge") : "",
      element.session.local.pinned ? t("pinnedBadge") : "",
      element.session.local.unread ? t("unreadBadge") : ""
    ].filter(Boolean);
    const statePrefix = stateLabels.length > 0 ? `${stateLabels.join(" · ")} · ` : "";
    item.description = `${statePrefix}${element.session.sourceLabel} · ${formatRelativeTime(element.session.updatedAt)}`;
    item.tooltip = new vscode.MarkdownString(
      [
        `**${element.session.displayName}**`,
        "",
        t("openOfficialTooltip"),
        "",
        `- ${t("sourceLabel")}: ${element.session.sourceLabel}`,
        `- ${t("projectLabel")}: ${element.session.projectLabel}`,
        `- ${t("updatedLabel")}: ${formatRelativeTime(element.session.updatedAt)}`,
        `- CWD: \`${element.session.cwd || "-"}\``,
        "",
        element.session.preview || "_No preview_"
      ].join("\n")
    );
    item.contextValue = element.session.archived ? "sessionArchived" : "session";
    item.command = {
      command: "codexSessions.openInOfficialCodex",
      title: "Open In Official Codex",
      arguments: [element]
    };
    item.iconPath = element.session.archived
      ? new vscode.ThemeIcon("archive", new vscode.ThemeColor("charts.orange"))
      : element.session.local.pinned
        ? new vscode.ThemeIcon("pinned", new vscode.ThemeColor("charts.yellow"))
        : element.session.local.unread
          ? new vscode.ThemeIcon("circle-large-filled", new vscode.ThemeColor("charts.blue"))
          : new vscode.ThemeIcon("comment-discussion");
    return item;
  }

  public getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.groups.map((group) => new GroupNode(group));
    }

    if (element instanceof GroupNode) {
      return projectBucketsForGroup(element.group).map((bucket) => new ProjectNode(element.group, bucket));
    }

    if (element instanceof ProjectNode) {
      const active = element.project.sessions.filter((session) => !session.archived);
      const archived = element.project.sessions.filter((session) => session.archived);
      const children: TreeNode[] = active.map((session) => new SessionNode(element.group, element.project, session));
      if (archived.length > 0) {
        children.push(new ProjectArchiveNode(element.group, element.project, archived));
      }
      return children;
    }

    if (element instanceof ProjectArchiveNode) {
      return element.sessions.map((session) => new SessionNode(element.group, element.project, session));
    }

    return [];
  }
}
