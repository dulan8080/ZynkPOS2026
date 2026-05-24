# ─────────────────────────────────────────────────────────────────────────────
# ZynkPOS Release Script
# Usage: .\release.ps1 -Version "1.0.2" -Notes "Bug fixes and improvements"
#
# What this does:
#   1. Updates version in tauri.conf.json and package.json
#   2. Commits the version bump
#   3. Pushes a git tag  →  GitHub Actions takes over:
#        - Builds the app on a Windows runner
#        - Signs the installer with your private key (from GitHub Secrets)
#        - Creates a GitHub Release with the .zip, .sig, and .exe
#        - Your Next.js server reads the release automatically
# ─────────────────────────────────────────────────────────────────────────────
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

# ── 1. Update version numbers ─────────────────────────────────────────────────
Write-Host "[1/4] Updating version to $Version ..." -ForegroundColor Yellow

$conf = Get-Content $TauriConf -Raw | ConvertFrom-Json
$conf.version = $Version
$conf | ConvertTo-Json -Depth 20 | Set-Content $TauriConf -Encoding UTF8

$pkg = Get-Content $PackageJson -Raw | ConvertFrom-Json
$pkg.version = $Version
$pkg | ConvertTo-Json -Depth 10 | Set-Content $PackageJson -Encoding UTF8

Write-Host "    Done." -ForegroundColor Green

# ── 2. Commit the version bump ────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Committing version bump..." -ForegroundColor Yellow

git add src-tauri/tauri.conf.json package.json
git commit -m "chore: release v$Version"

Write-Host "    Done." -ForegroundColor Green

# ── 3. Tag and push ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Tagging and pushing to GitHub..." -ForegroundColor Yellow

git tag "v$Version" -m $Notes
git push origin HEAD
git push origin "v$Version"

Write-Host "    Done." -ForegroundColor Green

# ── 4. Done ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Tag v$Version pushed!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "[4/4] GitHub Actions is now building and signing the release." -ForegroundColor Yellow
Write-Host "      Watch progress at:" -ForegroundColor White
Write-Host "      https://github.com/dulan8080/ZynkPOS2026/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "      Once done, your POS apps will auto-detect the update" -ForegroundColor White
Write-Host "      on next launch via https://my.lassanapata.com/api/pos/updates/latest" -ForegroundColor Cyan
Write-Host ""

Start-Process "https://github.com/dulan8080/ZynkPOS2026/actions"
param(
  [Parameter(Mandatory)][string]$Version,
  [string]$Notes = "Bug fixes and improvements"
)

$ErrorActionPreference = "Stop"
$ProjectDir  = $PSScriptRoot
$TauriConf   = "$ProjectDir\src-tauri\tauri.conf.json"
$PackageJson = "$ProjectDir\package.json"
$BundleDir   = "$ProjectDir\src-tauri\target\release\bundle\nsis"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ZynkPOS Release  v$Version" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Update version in tauri.conf.json ─────────────────────────────────────
Write-Host "[1/4] Updating version to $Version ..." -ForegroundColor Yellow
$conf = Get-Content $TauriConf -Raw | ConvertFrom-Json
$conf.version = $Version
$conf | ConvertTo-Json -Depth 20 | Set-Content $TauriConf -Encoding UTF8

$pkg = Get-Content $PackageJson -Raw | ConvertFrom-Json
$pkg.version = $Version
$pkg | ConvertTo-Json -Depth 10 | Set-Content $PackageJson -Encoding UTF8
Write-Host "    Version updated." -ForegroundColor Green

# ── 2. Build ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Building Tauri app (this takes a few minutes)..." -ForegroundColor Yellow
Set-Location $ProjectDir
npm run tauri build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }
Write-Host "    Build complete." -ForegroundColor Green

# ── 3. Collect release files ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Collecting release files..." -ForegroundColor Yellow

$zipFile = "$BundleDir\ZynkPOS_${Version}_x64-setup.nsis.zip"
$sigFile = "$BundleDir\ZynkPOS_${Version}_x64-setup.nsis.zip.sig"
$exeFile = "$BundleDir\ZynkPOS_${Version}_x64-setup.exe"

if (-not (Test-Path $zipFile)) { Write-Host "ERROR: $zipFile not found!" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $sigFile)) { Write-Host "ERROR: $sigFile not found! Make sure TAURI_SIGNING_PRIVATE_KEY_PATH is set." -ForegroundColor Red; exit 1 }

$signature = (Get-Content $sigFile -Raw).Trim()
$pubDate   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")

Write-Host "    Files ready." -ForegroundColor Green

# ── 4. Print production instructions ─────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Production deployment instructions:" -ForegroundColor Yellow
Write-Host ""
Write-Host "┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "│  STEP A — Upload this file to your production server:           │" -ForegroundColor Cyan
Write-Host "│                                                                  │" -ForegroundColor Cyan
Write-Host "│  LOCAL :  $zipFile" -ForegroundColor White
Write-Host "│  SERVER:  /public/pos-releases/ZynkPOS_${Version}_x64-setup.nsis.zip" -ForegroundColor White
Write-Host "│           (via FTP / FileZilla / SSH / cPanel File Manager)      │" -ForegroundColor Cyan
Write-Host "│                                                                  │" -ForegroundColor Cyan
Write-Host "│  STEP B — Set these env vars in .env.local on your server       │" -ForegroundColor Cyan
Write-Host "│           then restart the Next.js server:                       │" -ForegroundColor Cyan
Write-Host "│                                                                  │" -ForegroundColor Cyan
Write-Host "│  POS_LATEST_VERSION=$Version" -ForegroundColor Green
Write-Host "│  POS_LATEST_NOTES=$Notes" -ForegroundColor Green
Write-Host "│  POS_LATEST_PUB_DATE=$pubDate" -ForegroundColor Green
Write-Host "│  POS_LATEST_WIN_URL=https://my.lassanapata.com/pos-releases/ZynkPOS_${Version}_x64-setup.nsis.zip" -ForegroundColor Green
Write-Host "│  POS_LATEST_WIN_SIG=$signature" -ForegroundColor Green
Write-Host "│                                                                  │" -ForegroundColor Cyan
Write-Host "│  STEP C — Verify update endpoint is live:                       │" -ForegroundColor Cyan
Write-Host "│  https://my.lassanapata.com/api/pos/updates/latest              │" -ForegroundColor White
Write-Host "└─────────────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""

# Also copy the env block to clipboard for easy pasting
$envBlock = @"
POS_LATEST_VERSION=$Version
POS_LATEST_NOTES=$Notes
POS_LATEST_PUB_DATE=$pubDate
POS_LATEST_WIN_URL=https://my.lassanapata.com/pos-releases/ZynkPOS_${Version}_x64-setup.nsis.zip
POS_LATEST_WIN_SIG=$signature
"@
$envBlock | Set-Clipboard
Write-Host "The .env.local block has been copied to your clipboard." -ForegroundColor Magenta
Write-Host ""

# Open the bundle folder so you can grab the zip easily
Start-Process explorer.exe $BundleDir
