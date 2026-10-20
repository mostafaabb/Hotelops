#!/usr/bin/env bash
# HotelOps Deployment Setup Script
# Run this after creating accounts on Neon, Upstash, Fly.io, Vercel

set -e

echo "🏨 HotelOps Deployment Setup"
echo "============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 not found. Please install it first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $1 found"
}

echo "Checking prerequisites..."
check_command git
check_command flyctl
check_command vercel
check_command openssl
check_command curl

echo ""
echo "📋 Step 1: Generate JWT Secrets"
echo "-------------------------------"
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo ""
echo -e "${YELLOW}Save these! You'll need them for Fly.io secrets.${NC}"
echo ""

echo "📋 Step 2: GitHub Repository"
echo "----------------------------"
read -p "GitHub repo URL (e.g., https://github.com/username/hotelops): " REPO_URL
if [ -z "$REPO_URL" ]; then
    echo -e "${RED}Repository URL required${NC}"
    exit 1
fi

# Initialize git if needed
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial commit: HotelOps hotel management platform"
fi

# Add remote if not exists
if ! git remote | grep -q origin; then
    git remote add origin "$REPO_URL"
fi

git branch -M main
git push -u origin main
echo -e "${GREEN}✓ Pushed to GitHub${NC}"
echo ""

echo "📋 Step 3: Neon Database"
echo "------------------------"
echo "1. Go to https://neon.tech and create project 'hotelops'"
echo "2. Copy the connection string"
read -p "Neon connection string (postgresql://...): " DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Database URL required${NC}"
    exit 1
fi
echo ""

echo "📋 Step 4: Upstash Redis"
echo "------------------------"
echo "1. Go to https://upstash.com and create Redis database 'hotelops-redis'"
echo "2. Copy the Redis URL (use TCP format: redis://:password@host:port)"
read -p "Upstash Redis URL (redis://...): " REDIS_URL
if [ -z "$REDIS_URL" ]; then
    echo -e "${RED}Redis URL required${NC}"
    exit 1
fi
echo ""

echo "📋 Step 5: Fly.io API Deployment"
echo "---------------------------------"
echo "Deploying API to Fly.io..."
flyctl deploy --remote-only --app hotelops-api

echo "Setting secrets..."
flyctl secrets set \
    DATABASE_URL="$DATABASE_URL" \
    DIRECT_URL="$DATABASE_URL" \
    REDIS_URL="$REDIS_URL" \
    JWT_SECRET="$JWT_SECRET" \
    JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
    CORS_ORIGIN="https://hotelops-web.vercel.app" \
    --app hotelops-api

echo "Running migrations..."
flyctl ssh console --app hotelops-api -C "npx prisma migrate deploy && npx prisma db seed"

echo -e "${GREEN}✓ API deployed to https://hotelops-api.fly.dev${NC}"
echo ""

echo "📋 Step 6: Vercel Web Deployment"
echo "--------------------------------"
echo "1. Go to https://vercel.com and import your GitHub repo"
echo "2. Set Root Directory to 'apps/web'"
echo "3. Add Environment Variables:"
echo "   NEXT_PUBLIC_API_URL=https://hotelops-api.fly.dev/api/v1"
echo "   NEXT_PUBLIC_WS_URL=https://hotelops-api.fly.dev"
echo ""
read -p "Press Enter after Vercel deployment completes..."

echo ""
echo "📋 Step 7: Update CORS"
echo "----------------------"
read -p "Enter your Vercel URL (e.g., https://hotelops-web.vercel.app): " VERCEL_URL
flyctl secrets set CORS_ORIGIN="$VERCEL_URL" --app hotelops-api
echo -e "${GREEN}✓ CORS updated${NC}"
echo ""

echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Your HotelOps deployment:"
echo "  Frontend: $VERCEL_URL"
echo "  API:      https://hotelops-api.fly.dev/api/v1"
echo "  Swagger:  https://hotelops-api.fly.dev/api/docs"
echo "  Health:   https://hotelops-api.fly.dev/api/v1/health"
echo ""
echo "Demo credentials (after seeding):"
echo "  frontdesk@hotelops.app / Demo123!"
echo "  manager@hotelops.app   / Demo123!"
echo "  owner@hotelops.app     / Demo123!"
echo ""
echo "Next steps:"
echo "  1. Add custom domain in Vercel & Fly.io"
echo "  2. Set up SMTP for emails"
echo "  3. Configure monitoring (Sentry, Logtail)"
echo "  4. Set up backups for Neon"
echo ""
echo -e "${GREEN}Happy hotel managing! 🏨${NC}"