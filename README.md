# VS Code Codex Session Manager

一个独立的 VS Code 扩展，用来按工作区/项目分组和过滤 Codex 会话，兼容 VS Code、Desktop/App、CLI 等来源，并支持跳转官方 Codex 继续对话。

Marketplace Publisher: `wangzhilin777`

## 目录

- `vscode-extension/`: 扩展源码、测试与 `vsix` 打包入口
- `scripts/build-vsix.ps1`: Windows 一键打包脚本

## 主要能力

- 默认展示所有工作区，并可一键切回本工作区
- 按工作区/项目文件夹聚合会话，其他工作区默认折叠
- 归档会话归入对应项目下的“已归档”子文件夹
- 打开归档会话前自动取消归档，避免官方 Codex 报 `session is archived`
- 同标题、同工作区的短时间重复会话自动折叠
- 官方重命名后的会话标题按最新索引显示
- 支持中英文界面，跟随 VS Code 当前语言
- 支持本地重命名、置顶、未读、项目标签、备注、复制会话 ID 和恢复命令

## 设计原则

- 官方协议优先：优先通过 `codex app-server` 读取会话
- 文件系统兜底：`app-server` 不可用时回退到本地 `~/.codex` 数据
- 本地元数据独立：别名、项目标签、备注写入扩展 `globalStorage`
- 只通过官方 URI 打开 Codex 会话，避免改包或注入官方 Webview
- 可与 `vscode-codex-bridge` 同时安装

## 使用

进入 `vscode-extension/` 后执行：

```powershell
npm install
npm run test
npm run package:vsix
```
