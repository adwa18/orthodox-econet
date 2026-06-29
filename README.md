# ☦️ Orthodox Econet — Deployment Guide

**የኦርቶዶክስ ኢኮኖሚ ኔትወርክ** — Telegram Mini App for the Ethiopian Orthodox Christian business community.

---

## Architecture

```
Single Render Web Service (free tier)
├── Express API          → /api/*
├── Telegram bot webhook → /bot
├── Socket.io (WS)       → same port
└── React SPA            → /* (served from frontend/build/)

Database:  Neon PostgreSQL (free tier, serverless)
Storage:   Cloudinary (free tier, 25GB)
Bot:       Telegram Bot API (webhook mode)
```

---

## Prerequisites

| Service | Free Tier | Link |
|---------|-----------|------|
| Render  | 1 web service, 750h/month | render.com |
| Neon    | 0.5 GB PostgreSQL | neon.tech |
| Cloudinary | 25 GB storage | cloudinary.com |
| Telegram | BotFather | t.me/BotFather |

---

## Step 1 — Telegram Bot Setup

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` → follow prompts → copy the **Bot Token**
3. Send `/newapp` or `/setmenubutton` (after deployment — see Step 5)
4. Note your bot's username (e.g. `@OrthodoxEconetBot`)

---

## Step 2 — Neon Database

1. Sign up at [neon.tech](https://neon.tech) → create a project named `orthodox-econet`
2. From the Connection Details panel, copy:
   - **Pooled connection string** → `DATABASE_URL` (has `?pgbouncer=true`)
   - **Direct connection string** → `DIRECT_URL` (no pgbouncer, for migrations)
3. Both strings look like:
   ```
   postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/orthodox-econet?sslmode=require
   ```

---

## Step 3 — Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. From the Dashboard, copy:
   - Cloud Name
   - API Key
   - API Secret

---

## Step 4 — Deploy to Render

### 4a. Push code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/orthodox-econet.git
git push -u origin main
```

### 4b. Create Render Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `orthodox-econet` |
| **Region** | Oregon (US West) or Frankfurt |
| **Branch** | `main` |
| **Root Directory** | *(leave blank)* |
| **Runtime** | Node |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### 4c. Set Environment Variables

In Render → Environment tab, add **all** of these:

```env
NODE_ENV=production
PORT=10000

# Neon PostgreSQL
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/orthodox-econet?sslmode=require&pgbouncer=true&connect_timeout=15
DIRECT_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/orthodox-econet?sslmode=require

# Telegram
BOT_TOKEN=1234567890:ABCdef...
APP_URL=https://orthodox-econet.onrender.com
ADMIN_SUPPORT_USERNAME=OrthodoxEconetSupport
OWNER_CHAT_ID=123456789

# Auth
JWT_SECRET=generate-with-openssl-rand-base64-64
JWT_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret

# Donation payment defaults (editable via admin panel after deploy)
TELEBIRR_NUMBER=0941234567
BANK_NAME=Commercial Bank of Ethiopia
BANK_ACCOUNT_NAME=Orthodox Econet
BANK_ACCOUNT_NUMBER=1000123456789
BANK_BRANCH=Addis Ababa, Meskel Square
```

> **How to get OWNER_CHAT_ID**: Message [@userinfobot](https://t.me/userinfobot) on Telegram — it replies with your numeric ID.

> **Generate JWT_SECRET**:
> ```bash
> openssl rand -base64 64
> ```

### 4d. Add build memory fix

In Render → Environment, also add:
```
NODE_OPTIONS=--max-old-space-size=460
GENERATE_SOURCEMAP=false
```

This prevents OOM kills on Render's 512MB free tier during the React build.

---

## Step 5 — Post-Deploy Setup (do this after first successful deploy)

### 5a. Set bot webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://orthodox-econet.onrender.com/bot"
```

Expected response:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 5b. Configure BotFather Menu Button

1. Open [@BotFather](https://t.me/BotFather)
2. `/mybots` → select your bot → **Bot Settings → Menu Button**
3. Set button text: `☦️ Open Econet`
4. Set URL: `https://orthodox-econet.onrender.com`

### 5c. Set the first Owner account

The system needs at least one Owner. After your first login via Telegram:

1. Get your Telegram ID from [@userinfobot](https://t.me/userinfobot)
2. In Neon's SQL Editor, run:
   ```sql
   UPDATE "User"
   SET    status = 'VERIFIED', role = 'OWNER', "verifiedAt" = NOW()
   WHERE  "telegramId" = YOUR_TELEGRAM_ID;
   ```

### 5d. Keep service warm (prevent cold starts)

Render free tier sleeps after 15 minutes of inactivity. Sign up at [UptimeRobot](https://uptimerobot.com) (free) and create a monitor:
- **Monitor type**: HTTP(s)
- **URL**: `https://orthodox-econet.onrender.com/health`
- **Interval**: Every 14 minutes

This keeps the service warm so users never see a 30–60s blank screen.

---

## Step 6 — Run Database Migrations

Migrations run automatically on every server startup via `prisma migrate deploy`. To run manually:

```bash
# From your local machine with DATABASE_URL set
npx prisma migrate deploy
```

---

## Development Setup

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/orthodox-econet.git
cd orthodox-econet
cp .env.example .env
# Fill in .env values

# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Run migrations
cd ../backend && npx prisma migrate dev

# Start backend (port 10000)
npm run dev

# Start frontend (port 3000, proxies /api to 10000)
cd ../frontend && npm start
```

For local bot testing, use [ngrok](https://ngrok.com):
```bash
ngrok http 10000
# Then set webhook to: https://YOUR_NGROK_URL/bot
```

---

## Project Structure

```
orthodox-econet/
├── package.json              # Root — build + start scripts
├── .env.example
├── prisma/
│   └── schema.prisma         # Complete DB schema (24 models)
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js         # Express + Socket.io + bot entry point
│       ├── config/           # db.js, cloudinary.js, telegram.js
│       ├── middleware/       # auth, rbac, automod, rateLimit, upload
│       ├── routes/           # 14 route files (all API endpoints)
│       ├── services/         # botService.js, socketService.js
│       └── utils/            # helpers.js
└── frontend/
    ├── package.json
    ├── tailwind.config.js
    ├── public/
    │   ├── index.html        # Telegram WebApp SDK script tag
    │   ├── manifest.json
    │   └── sw.js             # Service Worker (offline support)
    └── src/
        ├── App.js            # Router + auth guards
        ├── index.js          # SDK init + theme + QueryClient
        ├── i18n.js           # 4-language setup
        ├── locales/          # am, en, om, ti JSON files
        ├── context/          # authStore.js (Zustand)
        ├── utils/            # api.js, socket.js, sections.js
        ├── components/       # Layout, Sidebar, TopBar, BottomNav, PostCard, etc.
        └── pages/            # All screens + admin/ sub-folder
```

---

## The 16 Community Sections

| ID | Emoji | Amharic | English |
|----|-------|---------|---------|
| `spiritual-life` | ☦️ | መንፈሳዊ ሕይወት | Spiritual Life |
| `business-directory` | 🛒 | የነጋዴዎች መድረክ | Business Directory |
| `import-export` | 🚢 | አስመጭዎች እና ላኪዎች | Import & Export |
| `education-training` | 👩‍🏫 | ትምህርት እና ስልጠና | Education & Training |
| `logistics-supply` | 🚛 | ትራንስፖርት | Logistics & Supply |
| `jobs-careers` | 💼 | የስራ ዕድል | Jobs & Careers |
| `it-software` | 💻 | ቴክኖሎጂ | IT & Software |
| `health-wellness` | 🏥 | ጤና | Health & Wellness |
| `marketplace-b2c` | 🤝 | ገዢና ሻጭ | Marketplace / B2C |
| `banking-finance` | 💵 | ባንክ እና ፋይናንስ | Banking & Finance |
| `tenders-bids` | 📄 | ጨረታ | Tenders & Bids |
| `engineering-arch` | 📐 | ምህንድስና | Engineering & Architecture |
| `legal-property` | ⚖️ | ሕግ | Legal & Property Rights |
| `trust-safety` | 🛡️ | ታማኝነት | Trust & Safety |
| `business-development` | 📈 | የንግድ ጥናት | Business & Development |
| `healthcare-community` | 🩺 | ጤና እና ማህበራዊ | Healthcare & Community |

---

## Admin Role Hierarchy

| Role | Permissions |
|------|-------------|
| `USER` | Post, react, endorse, report, vote, book |
| `MODERATOR` | + Delete/move/edit posts, view reports |
| `SENIOR_ADMIN` | + Ban/warn users, verify/decline registrations, verify professionals, manage donations |
| `OWNER` | + Promote/demote admins, update settings, all above |

---

## Security Notes

- **No external links** allowed in posts — regex blocks `http://`, `https://`, `www.`, common TLDs
- **Faith declaration** validated server-side on registration
- **Telegram initData** HMAC-SHA256 validated on every auth request; rejects if older than 24h
- **JWT** 7-day expiry, refreshed on activity
- **Banned users** blocked at middleware level before any route handler runs
- **Rate limiting**: 100 req/15min general, 10 auth/hour, 10 posts/min
- **File uploads**: MIME whitelist, 50MB limit, streamed directly to Cloudinary (no disk writes)
- **All admin actions** logged in `AdminAction` table with IP and timestamp

---

## Environment Variable Reference

See `.env.example` for the complete list with descriptions.

---

*Built with ☦️ for the Ethiopian Orthodox Christian business community.*
