# Codex Session Manager

`Codex Session Manager` 为 VS Code 提供独立的 Codex 会话管理侧边栏。

## 功能

- 按当前工作区、其他工作区、未归类分组展示会话
- 归档会话显示在对应项目下的“已归档”子文件夹
- 聚合同项目下的 VS Code、Desktop/App、CLI、Exec 会话
- 自动折叠短时间重复同步的同名会话
- 使用最新索引标题，兼容官方 Codex 重命名
- 支持本地重命名、置顶、未读、项目标签、备注
- 一键跳转官方 Codex 继续对话
- 打开归档会话前自动取消归档
- 一键在终端继续会话
- 右键支持归档、取消归档、删除已归档会话、复制会话 ID、复制工作目录、复制深度链接、复制恢复命令
- 优先通过 `codex app-server` 读取，失败时自动回退本地 `~/.codex`

## 要求

- 已安装 `codex` CLI
- 推荐安装官方 Codex VS Code 插件，用于跳转官方会话继续对话
- 推荐 VS Code 1.95+

## 说明

本插件不会修改官方 Codex 插件内部界面，只读取本机 Codex 会话数据并提供项目化分组、归档管理和快捷跳转。

## 打包

```powershell
npm install
npm run test
npm run package:vsix
```
