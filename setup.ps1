# setup.ps1 — HarvestHub one-command bootstrap
Write-Host ""
Write-Host "  🌾 HarvestHub Setup" -ForegroundColor Cyan
Write-Host ""

# 1. npm install
Write-Host "  [1/4] Installing Node.js dependencies..." -ForegroundColor Yellow
npm install --silent 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Node.js dependencies installed" -ForegroundColor Green

# 2. Python dependencies
Write-Host "  [2/4] Installing Python dependencies..." -ForegroundColor Yellow
pip install -r engine/requirements.txt -q 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠ Python deps failed — scrapling requires manual install" -ForegroundColor Yellow
    Write-Host "    Run: pip install scrapling orjson" -ForegroundColor DarkGray
} else {
    Write-Host "  ✓ Python dependencies installed" -ForegroundColor Green
}

# 3. Data directories
Write-Host "  [3/4] Creating data directories..." -ForegroundColor Yellow
@("data/store", "data/logs", "data/exports") | ForEach-Object {
    New-Item -ItemType Directory -Force -Path $_ | Out-Null
}
Write-Host "  ✓ Data directories ready" -ForegroundColor Green

# 4. Migrate legacy data
Write-Host "  [4/4] Migrating legacy data..." -ForegroundColor Yellow
if (Test-Path "export_all.py") {
    npx tsx src/cli/index.ts migrate 2>&1
} else {
    Write-Host "  ⚠ No export_all.py found — skipping migration" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick start:" -ForegroundColor Cyan
Write-Host "    npx tsx src/cli/index.ts status         # Check system status"
Write-Host "    npx tsx src/cli/index.ts scrape --help   # See scrape options"
Write-Host "    npx tsx src/cli/index.ts export -f xlsx  # Export to Excel"
Write-Host ""
