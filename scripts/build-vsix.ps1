$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginRoot = Split-Path -Parent $scriptDir
$extensionDir = Join-Path $pluginRoot "vscode-extension"

if (-not (Test-Path $extensionDir)) {
    throw "Extension directory not found: $extensionDir"
}

Push-Location $extensionDir
try {
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    npm run package:vsix
}
finally {
    Pop-Location
}
