<# 
.SYNOPSIS
    HotelOps Deployment Setup Script for Windows PowerShell

.DESCRIPTION
    Automates the initial deployment setup for HotelOps to Fly.io (API) and Vercel (Web)
    with Neon (PostgreSQL) and Upstash (Redis).

.PREREQUISITES
    - Git
    - Fly.io CLI (flyctl)
    - Vercel CLI (vercel)
    - OpenSSL (included in Git for Windows)
    - Accounts on: GitHub, Neon, Upstash, Fly.io, Vercel

.USAGE
    .\scripts\deploy-setup.ps1
#>

param()

$ErrorActionPreference = "Stop"

# Colors
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Reset = "`e[0m"

function Write-Success { param($msg) Write-Host "${Green}✓${Reset} $msg" }
function Write-Warning { param($msg) Write-Host "${Yellow}⚠${Reset} $msg" }
function Write-ErrorMsg { param($msg) Write-Host "${Red}❌${Reset} $msg" }
function Write-Header { param($msg) Write-Host "`n${Yellow}$msg${Reset}`n" + ("-" * $msg.Length) }

function Check-Command {
    param($name, $installHint = "")
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-ErrorMsg "$name not found. $installHint"
        exit 1
    }
    Write-Success "$name found"
}

Write-Header "🏨 HotelOps Deployment Setup"

# Check prerequisites
Write-Host "Checking prerequisites..."
Check-Command git "Install from https://git-scm.com"
Check-Command flyctl "Run: iwr https://fly.io/install.ps1 -useb | iex"
Check-Command vercel "Run: npm install -g vercel"
Check-Command openssl "Included in Git for Windows"
Check-Command curl "Built into Windows 10+"

# Step 1: Generate JWT Secrets
Write-Header "📋 Step 1: Generate JWT Secrets"
$JwtSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
$JwtRefreshSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

Write-Host "JWT_SECRET=$JwtSecret"
Write-Host "JWT_REFRESH_SECRET=$JwtRefreshSecret"
Write-Warning "Save these! You'll need them for Fly.io secrets."
Write-Host ""

# Step 2: GitHub Repository
Write-Header "📋 Step 2: GitHub Repository"
$RepoUrl = Read-Host "GitHub repo URL (e.g., https://github.com/username/hotelops)"
if (-not $RepoUrl) { Write-ErrorMsg "Repository URL required"; exit 1 }

if (-not (Test-Path ".git")) {
    git init
    git add .
    git commit -m "Initial commit: HotelOps hotel management platform"
}

if (-not (git remote | Select-String "origin")) {
    git remote add origin $RepoUrl
}

git branch -M main
git push -u origin main
Write-Success "Pushed to GitHub"
Write-Host ""

# Step 3: Neon Database
Write-Header "📋 Step 3: Neon Database"
Write-Host "1. Go to https://neon.tech and create project 'hotelops'"
Write-Host "2. Copy the connection string"
$DatabaseUrl = Read-Host "Neon connection string (postgresql://...)"
if (-not $DatabaseUrl) { Write-ErrorMsg "Database URL required"; exit 1 }
Write-Host ""

# Step 4: Upstash Redis
Write-Header "📋 Step 4: Upstash Redis"
Write-Host "1. Go to https://upstash.com and create Redis database 'hotelops-redis'"
Write-Host "2. Copy the Redis URL (use TCP format: redis://:password@host:port)"
$RedisUrl = Read-Host "Upstash Redis URL (redis://...)"
if (-not $RedisUrl) { Write-ErrorMsg "Redis URL required"; exit 1 }
Write-Host ""

# Step 5: Fly.io API Deployment
Write-Header "📋 Step 5: Fly.io API Deployment"
Write-Host "Deploying API to Fly.io..."
flyctl deploy --remote-only --app hotelops-api

Write-Host "Setting secrets..."
flyctl secrets set `
    DATABASE_URL="$DatabaseUrl" `
    DIRECT_URL="$DatabaseUrl" `
    REDIS_URL="$RedisUrl" `
    JWT_SECRET="$JwtSecret" `
    JWT_REFRESH_SECRET="$JwtRefreshSecret" `
    CORS_ORIGIN="https://hotelops-web.vercel.app" `
    --app hotelops-api

Write-Host "Running migrations..."
flyctl ssh console --app hotelops-api -C "npx prisma migrate deploy && npx prisma db seed"

Write-Success "API deployed to https://hotelops-api.fly.dev"
Write-Host ""

# Step 6: Vercel Web Deployment
Write-Header "📋 Step 6: Vercel Web Deployment"
Write-Host "1. Go to https://vercel.com and import your GitHub repo"
Write-Host "2. Set Root Directory to 'apps/web'"
Write-Host "3. Add Environment Variables:"
Write-Host "   NEXT_PUBLIC_API_URL=https://hotelops-api.fly.dev/api/v1"
Write-Host "   NEXT_PUBLIC_WS_URL=https://hotelops-api.fly.dev"
Write-Host ""
Read-Host "Press Enter after Vercel deployment completes..."

# Step 7: Update CORS
Write-Header "📋 Step 7: Update CORS"
$VercelUrl = Read-Host "Enter your Vercel URL (e.g., https://hotelops-web.vercel.app)"
flyctl secrets set CORS_ORIGIN="$VercelUrl" --app hotelops-api
Write-Success "CORS updated"
Write-Host ""

# Complete
Write-Header "🎉 Setup Complete!"
Write-Host ""
Write-Host "Your HotelOps deployment:"
Write-Host "  Frontend: $VercelUrl"
Write-Host "  API:      https://hotelops-api.fly.dev/api/v1"
Write-Host "  Swagger:  https://hotelops-api.fly.dev/api/docs"
Write-Host "  Health:   https://hotelops-api.fly.dev/api/v1/health"
Write-Host ""
Write-Host "Demo credentials (after seeding):"
Write-Host "  frontdesk@hotelops.app / Demo123!"
Write-Host "  manager@hotelops.app   / Demo123!"
Write-Host "  owner@hotelops.app     / Demo123!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Add custom domain in Vercel & Fly.io"
Write-Host "  2. Set up SMTP for emails"
Write-Host "  3. Configure monitoring (Sentry, Logtail)"
Write-Host "  4. Set up backups for Neon"
Write-Host ""
Write-Success "Happy hotel managing! 🏨"