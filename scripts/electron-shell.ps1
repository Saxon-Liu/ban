param(
  [ValidateSet('sync', 'package')]
  [string]$Step = 'package',

  [ValidateSet('portable', 'setup', 'green', 'all')]
  [string]$Target = 'portable',

  [switch]$SkipFrontendBuild
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host "[electron-shell]" $Message
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$shellRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot '..\..\Electron\electron-shell'))
$updateDistScript = Join-Path $shellRoot 'update-dist.ps1'
$shellPackageJson = Join-Path $shellRoot 'package.json'
$frontendDist = Join-Path $repoRoot 'dist'

if (-not (Test-Path -LiteralPath $shellRoot)) {
  throw "Electron 壳项目不存在: $shellRoot"
}

if (-not (Test-Path -LiteralPath $shellPackageJson)) {
  throw "Electron 壳项目缺少 package.json: $shellPackageJson"
}

if (-not $SkipFrontendBuild) {
  Write-Step "构建 Vue 前端产物"
  Push-Location $repoRoot
  try {
    npm run build
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $frontendDist)) {
  throw "前端 dist 不存在: $frontendDist"
}

if (-not (Test-Path -LiteralPath $updateDistScript)) {
  throw "未找到 Electron 壳同步脚本: $updateDistScript"
}

Write-Step "同步前端 dist 到 Electron resources/app"
Push-Location $shellRoot
try {
  & $updateDistScript
}
finally {
  Pop-Location
}

if ($Step -eq 'sync') {
  Write-Step "同步完成"
  exit 0
}

$commandMap = @{
  portable = 'build:portable'
  setup = 'build:setup'
  green = 'build:green'
  all = 'build'
}

$shellScript = $commandMap[$Target]
if (-not $shellScript) {
  throw "不支持的打包目标: $Target"
}

Write-Step "执行 Electron 打包: npm run $shellScript"
Push-Location $shellRoot
try {
  npm run $shellScript
}
finally {
  Pop-Location
}

Write-Step "Electron 打包完成"
