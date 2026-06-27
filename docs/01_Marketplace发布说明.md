# Marketplace 发布说明

## 当前状态

- 扩展 Publisher 已切换为 `wangzhilin777`。
- Marketplace 扩展 ID 将是 `wangzhilin777.vscode-codex-session-manager`。
- 当前已通过 `npm test` 和 `vsce package` 校验。
- 当前机器缺少有发布权限的 Marketplace PAT 或 Microsoft Entra 登录态，因此无法直接完成发布。

## 首次发布前准备

1. 打开 https://marketplace.visualstudio.com/manage/publishers/。
2. 创建或确认 Publisher ID 为 `wangzhilin777`。
3. 确认当前 Microsoft 账号是该 Publisher 的 owner 或 contributor。
4. 创建 Azure DevOps Personal Access Token。
5. PAT 需要具备 Marketplace `Manage` 权限。

## 发布命令

在 PowerShell 中设置 PAT 后执行：

```powershell
$env:VSCE_PAT = "<你的 Marketplace PAT>"
.\scripts\publish-marketplace.ps1
```

如果使用网页上传，请点击 `New extension` 后选择 `Visual Studio Code` 类型，再上传 `dist/` 下以 `wangzhilin777.vscode-codex-session-manager-` 开头的 `.vsix` 文件。不要选择 Azure DevOps 扩展类型。

脚本会自动执行：

- `npm test`
- `npx vsce package --no-dependencies`
- `npx vsce publish --packagePath`

## 本轮验证结果

本轮已执行真实发布尝试，失败原因是凭证没有 `wangzhilin777` Publisher 发布权限：

```text
TF400813: The user 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' is not authorized to access this resource.
```

本轮也尝试了 `--azure-credential`，但当前机器没有可用 Azure CLI、Az PowerShell、环境凭证或 Azure Developer CLI 登录态。
