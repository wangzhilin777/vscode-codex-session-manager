param(
  [string]$Publisher = "wangzhilin777",
  [string]$PackageName = "vscode-codex-session-manager"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$extensionRoot = Join-Path $repoRoot "vscode-extension"
$distRoot = Join-Path $repoRoot "dist"

if (-not $env:VSCE_PAT) {
  throw 'Missing VSCE_PAT. Create an Azure DevOps PAT with Marketplace Manage permission, then set $env:VSCE_PAT in this terminal.'
}

Push-Location $extensionRoot
try {
  npm test

  if (-not (Test-Path -LiteralPath $distRoot)) {
    New-Item -ItemType Directory -Path $distRoot | Out-Null
  }

  $packageJson = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
  if ($packageJson.publisher -ne $Publisher) {
    throw "package.json publisher '$($packageJson.publisher)' does not match target publisher '$Publisher'."
  }

  $vsixPath = Join-Path $distRoot "$Publisher.$PackageName-$($packageJson.version).vsix"
  npx vsce package --no-dependencies --out $vsixPath
  npx vsce publish --packagePath $vsixPath
}
finally {
  Pop-Location
}
