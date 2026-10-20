# HotelOps Deployment Guide

Complete step-by-step deployment to **Vercel (Web)** + **Fly.io (API)** + **Neon (PostgreSQL)** + **Upstash (Redis)** — all **free tiers**.

---

## 📁 Files Created for Deployment

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI pipeline: lint, typecheck, test, build |
| `.github/workflows/deploy-api.yml` | Auto-deploy API to Fly.io on push to main |
| `.github/workflows/deploy-web.yml` | Auto-deploy Web to Vercel on push to main |
| `fly.toml` | Fly.io configuration for API |
| `apps/web/vercel.json` | Vercel configuration for Web |
| `docker-compose.prod.yml` | Production Docker Compose with Caddy |
| `Caddyfile` | Reverse proxy with auto-HTTPS |
| `.env.production.template` | Production environment template |
| `.dockerignore` | Optimized Docker builds |
| `scripts/deploy-setup.sh` | Linux/macOS setup script |
| `scripts/deploy-setup.ps1` | Windows PowerShell setup script |

---

## 🚀 Quick Start (Automated)

### Windows PowerShell (Recommended)
```powershell
# Run from HotelOps directory
.\scripts\deploy-setup.ps1
```

### Linux/macOS
```bash
chmod +x scripts/deploy-setup.sh
./scripts/deploy-setup.sh
```

The script will:
1. Generate JWT secrets
2. Push to GitHub
3. Prompt for Neon/Upstash URLs
4. Deploy API to Fly.io
5. Run migrations & seed
6. Guide Vercel deployment
7. Update CORS

---

## 📋 Manual Step-by-Step

### Prerequisites
- [ ] GitHub account
- [ ] Fly.io account (credit card for verification, no charge)
- [ ] Vercel account (GitHub login)
- [ ] Neon account (GitHub login, no card)
- [ ] Upstash account (GitHub login, no card)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create hotelops --public --source=. --push
# Or manually create at github.com/new
```

### 2. Create Neon Database
1. Go to [neon.tech](https://neon.tech) → New Project
2. Name: `hotelops`, Region: closest to you
3. Copy connection string:
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

### 3. Create Upstash Redis
1. Go to [upstash.com](https://upstash.com) → Create Database
2. Name: `hotelops-redis`, Type: Redis, Tier: Free
3. Copy Redis URL (use **TCP** format):
   ```
   redis://:password@host:port
   ```

### 4. Deploy API to Fly.io
```bash
# Install Fly CLI
iwr https://fly.io/install.ps1 -useb | iex  # Windows
# or: curl -L https://fly.io/install.sh | sh  # Linux/macOS

# Login & launch
fly auth login
fly launch --no-deploy  # Answer prompts, don't deploy yet

# Create volume for uploads
fly volumes create hotelops_data --region iad --size 1

# Set secrets (replace with your values)
fly secrets set \
  DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" \
  DIRECT_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" \
  REDIS_URL="redis://:password@host:port" \
  JWT_SECRET=$(openssl rand -base64 32) \
  JWT_REFRESH_SECRET=$(openssl rand -base64 32) \
  CORS_ORIGIN="https://hotelops-web.vercel.app"

# Deploy
fly deploy

# Run migrations & seed
fly ssh console -C "npx prisma migrate deploy && npx prisma db seed"
```

### 5. Deploy Web to Vercel
1. Go to [vercel.com](https://vercel.com) → Add New Project
2. Import your GitHub repo
3. **Root Directory**: `apps/web`
4. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://hotelops-api.fly.dev/api/v1
   NEXT_PUBLIC_WS_URL=https://hotelops-api.fly.dev
   ```
5. Deploy

### 6. Update CORS
```bash
fly secrets set CORS_ORIGIN="https://your-vercel-url.vercel.app" --app hotelops-api
```

---

## 🔐 Required Secrets

### Fly.io (API)
| Secret | Value |
|--------|-------|
| `DATABASE_URL` | Neon connection string |
| `DIRECT_URL` | Same as DATABASE_URL |
| `REDIS_URL` | Upstash Redis URL (tcp://) |
| `JWT_SECRET` | 32+ char random (openssl rand -base64 32) |
| `JWT_REFRESH_SECRET` | 32+ char random |
| `CORS_ORIGIN` | Your Vercel URL |

### Vercel (Web)
| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://hotelops-api.fly.dev/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `https://hotelops-api.fly.dev` |

---

## ✅ Verification

| Check | Command/URL |
|-------|-------------|
| API Health | `curl https://hotelops-api.fly.dev/api/v1/health` |
| Swagger Docs | `https://hotelops-api.fly.dev/api/docs` |
| Frontend | `https://your-app.vercel.app` |
| Login Test | `frontdesk@hotelops.app` / `Demo123!` |

---

## 🌐 Custom Domain (Optional)

### Vercel (Frontend)
1. Vercel → Project → Settings → Domains
2. Add `app.yourdomain.com`
3. Add CNAME: `cname.vercel-dns.com`

### Fly.io (API)
```bash
fly ips allocate-v4
fly certs create api.yourdomain.com
# Add A record → Fly IP
```

### Caddy (Self-hosted)
Edit `Caddyfile` with your domain, then:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 🔄 Continuous Deployment

After initial setup, **just push to main**:
```bash
git add .
git commit -m "Feature: amazing update"
git push origin main
```

- **API** → Auto-deploys via `.github/workflows/deploy-api.yml`
- **Web** → Auto-deploys via Vercel Git integration

---

## 💰 Cost Breakdown

| Service | Free Tier | Monthly Cost |
|---------|-----------|--------------|
| Vercel | Unlimited personal | $0 |
| Neon | 3 GB, auto-suspend | $0 |
| Upstash | 10 MB, 10K cmds/day | $0 |
| Fly.io | 3 VMs × 256 MB, 3 GB vol | $0 |
| **Total** | | **$0/month** |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `DATABASE_URL` fails | Use pooled connection: `-pooler` endpoint from Neon |
| Redis connection fails | Use `redis://` not `rediss://` for BullMQ |
| CORS errors | Update `CORS_ORIGIN` in Fly.io to exact Vercel URL |
| Prisma not found | Ensure `.dockerignore` doesn't exclude `prisma/` |
| WebSocket fails | `NEXT_PUBLIC_WS_URL` must be `https://` (WSS) |
| Migration timeout | Run `fly ssh console -C "npx prisma migrate deploy"` manually |
| Build fails | Check Node version (20.x), clear cache |

---

## 📞 Support

- **Fly.io**: `flyctl logs --app hotelops-api`
- **Vercel**: Check deployment logs in dashboard
- **Neon**: Dashboard → Monitoring
- **Upstash**: Dashboard → Logs

---

## 🎉 You're Live!

| Component | URL |
|-----------|-----|
| Frontend | `https://your-app.vercel.app` |
| API | `https://hotelops-api.fly.dev/api/v1` |
| Swagger | `https://hotelops-api.fly.dev/api/docs` |
| Database | Neon Console |
| Redis | Upstash Console |

**Demo accounts**: `frontdesk@hotelops.app` / `Demo123!` (and others from seed)

Happy hotel managing! 🏨