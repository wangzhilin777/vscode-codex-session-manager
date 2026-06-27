# Codex Session Manager

`Codex Session Manager` 为 VS Code 提供独立的 Codex 会话管理侧边栏。

## 功能

- 按当前工作区、其他工作区、未归类分组展示会话
- 归档会话显示在对应项目下的“已归档”子文件夹
- 聚合同项目下的 VS Code、Desktop/App、CLI、Exec 会话
- 自动折叠短时间重复同步的同名会话
- 使用最新索引标题，兼容官方 Codex 重命名
- 支持本地别名、项目标签、备注
- 一键跳转官方 Codex 继续对话
- 打开归档会话前自动取消归档
- 一键在终端继续会话
- 一键归档、反归档、复制会话 ID、复制恢复命令
- 优先通过 `codex app-server` 读取，失败时自动回退本地 `~/.codex`

## 要求

- 已安装 `codex` CLI
- 推荐 VS Code 1.95+

## 打包

```powershell
npm install
npm run test
npm run package:vsix
```
