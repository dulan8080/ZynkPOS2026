# LassanaPata POS - Setup Script
# Run this script to check prerequisites and install dependencies

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   LassanaPata POS - Setup Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  ✓ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js not found. Install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check Rust
Write-Host "[2/4] Checking Rust..." -ForegroundColor Yellow
try {
    $rustVersion = rustc --version 2>&1
    Write-Host "  ✓ $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Rust not found." -ForegroundColor Red
    Write-Host "    Install Rust from: https://rustup.rs/" -ForegroundColor Yellow
    Write-Host "    After installing, restart this terminal and run setup again." -ForegroundColor Yellow
    
    $answer = Read-Host "Open rustup.rs in browser? (y/n)"
    if ($answer -eq 'y') {
        Start-Process "https://rustup.rs/"
    }
    exit 1
}

# Check Tauri CLI
Write-Host "[3/4] Checking Tauri CLI..." -ForegroundColor Yellow
try {
    $tauriVersion = cargo tauri --version 2>&1
    Write-Host "  ✓ $tauriVersion" -ForegroundColor Green
} catch {
    Write-Host "  Installing Tauri CLI..." -ForegroundColor Yellow
    cargo install tauri-cli --version "^2"
    Write-Host "  ✓ Tauri CLI installed" -ForegroundColor Green
}

# Install npm packages
Write-Host "[4/4] Installing npm packages..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ npm packages installed" -ForegroundColor Green

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Setup Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Make sure your LassanaPata Next.js server is running" -ForegroundColor Gray
Write-Host "     (run 'npm run dev' in the LassanaPata folder)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Generate app icons (optional but recommended):" -ForegroundColor Gray
Write-Host "     Place a 1024x1024 PNG as 'app-icon.png' then run:" -ForegroundColor Gray
Write-Host "     npx tauri icon app-icon.png" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Start development mode:" -ForegroundColor Gray
Write-Host "     npm run tauri dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Build for production:" -ForegroundColor Gray
Write-Host "     npm run tauri build" -ForegroundColor Gray
Write-Host ""
