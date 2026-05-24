# ZynkPOS Release Script
# Usage: .\release.ps1 -Version "1.0.2" -Notes "Bug fixes"
param(
  [Parameter(Mandatory)][string]$Version,
  [string]$Notes = "Bug fixes and improvements"
)

$ErrorActionPreference = "Stop"
$ProjectDir  = $PSScriptRoot
$TauriConf   = "$ProjectDir\src-tauri\tauri.conf.json"
$PackageJson = "$ProjectDir\package.json"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ZynkPOS Release  v$Version" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectDir

# 1. Update version numbers
Write-Host "[1/3] Updating version to $Version ..." -ForegroundColor Yellow
$noBom = New-Object System.Text.UTF8Encoding $false
$conf = [System.IO.File]::ReadAllText($TauriConf) | ConvertFrom-Json
$conf.version = $Version
[System.IO.File]::WriteAllText($TauriConf, ($conf | ConvertTo-Json -Depth 20), $noBom)
$pkg = [System.IO.File]::ReadAllText($PackageJson) | ConvertFrom-Json
$pkg.version = $Version
[System.IO.File]::WriteAllText($PackageJson, ($pkg | ConvertTo-Json -Depth 10), $noBom)
Write-Host "    Done." -ForegroundColor Green

# 2. Commit
Write-Host ""
Write-Host "[2/3] Committing version bump..." -ForegroundColor Yellow
git add src-tauri/tauri.conf.json package.json
git commit -m "chore: release v$Version"
Write-Host "    Done." -ForegroundColor Green

# 3. Tag and push
Write-Host ""
Write-Host "[3/3] Tagging and pushing to GitHub..." -ForegroundColor Yellow
git tag "v$Version" -m $Notes
git push origin HEAD
git push origin "v$Version"
Write-Host "    Done." -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Tag v$Version pushed!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "GitHub Actions is now building. Watch at:" -ForegroundColor Yellow
Write-Host "  https://github.com/dulan8080/ZynkPOS2026/actions" -ForegroundColor Cyan
Write-Host ""

Start-Process "https://github.com/dulan8080/ZynkPOS2026/actions"
