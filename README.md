# VS Code Codex 会话管理 / VS Code Codex Session Manager

一个独立的 VS Code 扩展，用来按工作区/项目分组和过滤 Codex 会话，兼容 VS Code、Desktop/App、CLI、Exec 等来源，并支持跳转官方 Codex 继续对话。

An independent VS Code extension for grouping and filtering Codex sessions by workspace/project. It supports sessions from VS Code, Desktop/App, CLI, and Exec sources, with handoff back to the official Codex extension.

Marketplace Publisher: `wangzhilin777`

## 目录 / Project Layout

- `vscode-extension/`: 扩展源码、测试与 `vsix` 打包入口。 / Extension source, tests, and VSIX packaging entry.
- `scripts/build-vsix.ps1`: Windows 一键打包脚本。 / One-command Windows packaging script.

## 主要能力 / Key Features

- 默认展示所有工作区，并可一键切回本工作区。 / Show all workspaces by default, with one-click filtering back to the current workspace.
- 按工作区/项目文件夹聚合会话，其他工作区默认折叠。 / Group sessions by workspace/project folder, with other workspaces collapsed by default.
- 归档会话归入对应项目下的“已归档”子文件夹。 / Place archived sessions inside the matching project's "Archived" subfolder.
- 打开归档会话前自动取消归档，避免官方 Codex 报 `session is archived`。 / Automatically unarchive before opening, avoiding the official Codex `session is archived` error.
- 同标题、同工作区的短时间重复会话自动折叠。 / Collapse short-lived duplicate sessions with the same title and workspace.
- 官方重命名后的会话标题按最新索引显示。 / Keep titles in sync with official Codex renames by using the newest index.
- 支持中英文界面，跟随 VS Code 当前语言。 / Support Chinese and English UI, following the current VS Code language.
- 支持本地重命名、置顶、未读、项目标签、备注、复制会话 ID 和恢复命令。 / Support local aliases, pinned state, unread state, project tags, notes, copy session ID, and copy resume command.

## 设计原则 / Design Principles

- 官方协议优先：优先通过 `codex app-server` 读取会话。 / Official protocol first: prefer `codex app-server`.
- 文件系统兜底：`app-server` 不可用时回退到本地 `~/.codex` 数据。 / Filesystem fallback: use local `~/.codex` data when `app-server` is unavailable.
- 本地元数据独立：别名、项目标签、备注写入扩展 `globalStorage`。 / Independent local metadata: aliases, project tags, and notes are stored in extension `globalStorage`.
- 只通过官方 URI 打开 Codex 会话，避免改包或注入官方 Webview。 / Open Codex sessions only through official URIs, without patching packages or injecting into official webviews.
- 可与 `vscode-codex-bridge` 同时安装。 / Can be installed alongside `vscode-codex-bridge`.

## 使用 / Usage

进入 `vscode-extension/` 后执行：

Run the following inside `vscode-extension/`:

```powershell
npm install
npm run test
npm run package:vsix
```

## 发布到 VS Code Marketplace / Publishing To VS Code Marketplace

当前 Publisher 配置为 `wangzhilin777`。首次发布前需要准备 Marketplace Publisher 和具有 `Manage` 权限的 `VSCE_PAT`。

The current publisher is `wangzhilin777`. Before publishing for the first time, prepare a Marketplace publisher and a `VSCE_PAT` with `Manage` permission.

详见 [Marketplace 发布说明](docs/01_Marketplace发布说明.md)。

See [Marketplace 发布说明](docs/01_Marketplace发布说明.md) for details.
