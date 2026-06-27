# Codex 会话管理 / Codex Session Manager

`Codex 会话管理 / Codex Session Manager` 为 VS Code 提供独立的 Codex 会话管理侧边栏，按项目聚合会话，并可跳转官方 Codex 继续对话。

`Codex Session Manager` adds a project-aware Codex session sidebar to VS Code. It groups conversations by workspace and can hand sessions back to the official Codex extension.

## 功能 / Features

- 按当前工作区、其他工作区、未归类分组展示会话。 / Group sessions by current workspace, other workspaces, and uncategorized items.
- 归档会话显示在对应项目下的“已归档”子文件夹。 / Show archived sessions inside an "Archived" subfolder under the matching project.
- 聚合同项目下的 VS Code、Desktop/App、CLI、Exec 会话。 / Merge VS Code, Desktop/App, CLI, and Exec sessions that belong to the same project.
- 自动折叠短时间重复同步的同名会话。 / Collapse short-lived duplicate synced sessions with the same title.
- 使用最新索引标题，兼容官方 Codex 重命名。 / Prefer the latest indexed title so official Codex renames stay in sync.
- 支持本地重命名、置顶、未读、项目标签、备注。 / Support local aliases, pinned state, unread state, project tags, and notes.
- 一键跳转官方 Codex 继续对话。 / Continue a session in the official Codex extension with one click.
- 打开归档会话前自动取消归档。 / Automatically unarchive a session before opening it.
- 一键在终端继续会话。 / Resume a session in the terminal.
- 右键支持归档、取消归档、删除已归档会话、复制会话 ID、复制工作目录、复制深度链接、复制恢复命令。 / Context menu actions include archive, unarchive, delete archived sessions, copy session ID, copy working directory, copy deep link, and copy resume command.
- 优先通过 `codex app-server` 读取，失败时自动回退本地 `~/.codex`。 / Prefer `codex app-server`, with an automatic local `~/.codex` fallback.

## 要求 / Requirements

- 已安装 `codex` CLI。 / The `codex` CLI is installed.
- 推荐安装官方 Codex VS Code 插件，用于跳转官方会话继续对话。 / The official Codex VS Code extension is recommended for handoff and continuation.
- 推荐 VS Code 1.95+。 / VS Code 1.95+ is recommended.

## 说明 / Notes

本插件不会修改官方 Codex 插件内部界面，只读取本机 Codex 会话数据并提供项目化分组、归档管理和快捷跳转。

This extension does not patch or inject into the official Codex extension UI. It reads local Codex session data and provides project grouping, archive management, and quick handoff actions.

## 打包 / Packaging

```powershell
npm install
npm run test
npm run package:vsix
```
