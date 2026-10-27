<# 
HotelOps API Deployment to Fly.io
Run this script after: flyctl auth login
#>

$ErrorActionPreference = "Stop"

# Ensure flyctl is in PATH
$env:PATH += ";$env:USERPROFILE\.fly\bin"

# =============================================================================
# YOUR VALUES (already filled in)
# =============================================================================
$DatabaseUrl = "postgresql://neondb_owner:npg_QFh1GUu7ECxc@ep-billowing-dew-zazlh1yv-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$RedisUrl = "redis://default:gQAAAAAAAovMAAIgcDIzYzVkZTI0ZGM1YTY0ZGY3OTczMjQxODVmZjcyNTU1MQ@peaceful-deer-166860.upstash.io:6379"
$AppName = "hotelops-api"
$Region = "lhr"  # London, closest to your Neon region (eu-west-2)
$CorsOrigin = "https://hotelops-web.vercel.app"

# =============================================================================
# GENERATE JWT SECRETS
# =============================================================================
Write-Host "`n[1/6] Generating JWT secrets..." -ForegroundColor Cyan
$JwtSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
$JwtRefreshSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

Write-Host "JWT_SECRET=$JwtSecret"
Write-Host "JWT_REFRESH_SECRET=$JwtRefreshSecret"
Write-Warning "SAVE THESE TWO VALUES! You'll need them if you ever recreate the app."

# =============================================================================
# LAUNCH FLY APP
# =============================================================================
Write-Host "`n[2/6] Launching Fly.io app..." -ForegroundColor Cyan
flyctl launch --no-deploy --name $AppName --region $Region --no-postgres --no-redis --dockerfile Dockerfile.api

# =============================================================================
# CREATE VOLUME
# =============================================================================
Write-Host "`n[3/6] Creating persistent volume for uploads..." -ForegroundColor Cyan
flyctl volumes create hotelops_data --region $Region --size 1 --app $AppName

# =============================================================================
# SET SECRETS
# =============================================================================
Write-Host "`n[4/6] Setting secrets..." -ForegroundColor Cyan
flyctl secrets set `
  DATABASE_URL="$DatabaseUrl" `
  DIRECT_URL="$DatabaseUrl" `
  REDIS_URL="$RedisUrl" `
  JWT_SECRET="$JwtSecret" `
  JWT_REFRESH_SECRET="$JwtRefreshSecret" `
  CORS_ORIGIN="$CorsOrigin" `
  --app $AppName

# =============================================================================
# DEPLOY
# =============================================================================
Write-Host "`n[5/6] Deploying API..." -ForegroundColor Cyan
flyctl deploy --app $AppName

# =============================================================================
# RUN MIGRATIONS & SEED
# =============================================================================
Write-Host "`n[6/6] Running database migrations & seed..." -ForegroundColor Cyan
flyctl ssh console --app $AppName -C "npx prisma migrate deploy && npx prisma db seed"

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "✅ API DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "API URL:      https://$AppName.fly.dev/api/v1"
Write-Host "Health:       https://$AppName.fly.dev/api/v1/health"
Write-Host "Swagger:      https://$AppName.fly.dev/api/docs"
Write-Host ""
Write-Host "JWT_SECRET (save this): $JwtSecret"
Write-Host "JWT_REFRESH_SECRET:      $JwtRefreshSecret"
Write-Host ""
Write-Host "Next: Deploy Web to Vercel, then update CORS:"
Write-Host "  flyctl secrets set CORS_ORIGIN=`"https://YOUR_VERCEL_URL.vercel.app`" --app $AppName" -ForegroundColor Yellow