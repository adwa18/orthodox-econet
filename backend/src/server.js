// backend/src/server.js
// Orthodox Econet — Single Render Web Service entry point.
//
// This ONE file starts:
//   • Express HTTP server
//   • Socket.io (WebSocket, same port)
//   • Telegram bot webhook handler
//   • Static file serving of the React build (production)
//
// All routes hit this single service on Render free tier.

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express    = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const cors       = require('cors');
const helmet     = require('helmet');
const compression = require('compression');
const { execSync } = require('child_process');

const TelegramBot = require('node-telegram-bot-api');

const { prisma, seedDefaultSettings } = require('./config/db');
const { initBot }    = require('./services/botService');
const { initSocket } = require('./services/socketService');
const { validateInitData } = require('./config/telegram');
const { generalLimiter } = require('./middleware/rateLimit');

// ─── App & HTTP server ────────────────────────────────────────────────────────

const app        = express();
const httpServer = createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin:  process.env.NODE_ENV === 'production' ? process.env.APP_URL : '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout:  60000,
  pingInterval: 25000,
});

initSocket(io);

// ─── Telegram Bot ─────────────────────────────────────────────────────────────

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  // Webhook mode — no polling (polling conflicts with webhook and costs resources)
  webHook: false,
});

initBot(bot);

// Bot /start command handler
bot.onText(/\/start/, async (msg) => {
  const chatId    = msg.chat.id;
  const firstName = msg.from?.first_name || 'Friend';

  // Check if user is already registered
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(msg.from.id) },
    });

    if (user?.status === 'VERIFIED') {
      await bot.sendMessage(chatId,
        `☦️ <b>Welcome back, ${firstName}!</b>\n\n` +
        `You are a verified member of Orthodox Econet.\n` +
        `ወደ ኦርቶዶክስ ኢኮኖሚ ኔትወርክ እንኳን ደስ አለዎ!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{
              text: '☦️ Open Orthodox Econet',
              web_app: { url: process.env.APP_URL },
            }]],
          },
        }
      );
      return;
    }

    if (user?.status === 'UNVERIFIED') {
      await bot.sendMessage(chatId,
        `☦️ <b>Hi ${firstName},</b>\n\n` +
        `Your registration is pending admin verification. You will be notified soon.\n\n` +
        `<i>ምዝገባዎ ለአስተዳዳሪ ግምገማ ቀርቧል።</i>`,
        { parse_mode: 'HTML' }
      );
      return;
    }
  } catch (err) {
    console.error('[bot] /start DB error:', err.message);
  }

  // New user — show registration button
  await bot.sendMessage(chatId,
    `☦️ <b>Welcome to Orthodox Econet!</b>\n` +
    `<b>ወደ ኦርቶዶክስ ኢኮኖሚ ኔትወርክ እንኳን መጡ!</b>\n\n` +
    `ይህ ለኢትዮጵያ ኦርቶዶክስ ክርስቲያን ንግድ ማህበረሰብ የተዘጋጀ የኔትወርክ መድረክ ነው።\n\n` +
    `This is a verified community platform for the Ethiopian Orthodox Christian business community.\n\n` +
    `Tap below to register and join us.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{
          text: '📋 Register / ይመዝገቡ',
          web_app: { url: `${process.env.APP_URL}/register` },
        }]],
      },
    }
  );
});

// ─── Core Middleware ──────────────────────────────────────────────────────────

app.set('trust proxy', 1); // Render sits behind a proxy

app.use(helmet({
  contentSecurityPolicy: false,  // Telegram Mini App needs inline scripts
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.APP_URL, 'https://web.telegram.org']
    : '*',
  credentials: true,
}));

// Bot webhook — must be before express.json() for raw body
app.post('/bot', express.json(), (req, res) => {
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('[bot webhook]', err.message);
    res.sendStatus(200); // Always return 200 to Telegram to avoid retries
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting on all /api routes
app.use('/api/', generalLimiter);

// ─── Health check (keep-alive target for UptimeRobot) ────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    ok:     true,
    time:   new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/posts',        require('./routes/posts'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/broadcast',    require('./routes/broadcast'));
app.use('/api/marketplace',  require('./routes/marketplace'));
app.use('/api/mentorship',   require('./routes/mentorship'));
app.use('/api/liveqa',       require('./routes/liveqa'));
app.use('/api/polls',        require('./routes/polls'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/bookings',     require('./routes/bookings'));
app.use('/api/professional', require('./routes/professional'));
app.use('/api/donations',    require('./routes/donations'));
app.use('/api/settings',     require('./routes/settings'));

// Make io available to route handlers via req.app.get('io')
app.set('io', io);

// ─── Serve React build in production ─────────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../../frontend/build');
  app.use(express.static(buildPath));
  // SPA fallback — any non-API route serves index.html
  app.get('*', (req, res) => {
    // Don't catch /api or /bot
    if (req.path.startsWith('/api') || req.path === '/bot' || req.path === '/health') return;
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '10000', 10);

async function start() {
  try {
    // Run Prisma migrations on startup (not at build time — no DB at build)
    console.log('[startup] Running Prisma migrations…');
    execSync('npx prisma migrate deploy', {
      cwd:   path.join(__dirname, '../'),
      stdio: 'inherit',
      env:   { ...process.env },
    });
    console.log('[startup] Migrations complete.');

    // Seed default settings (idempotent)
    await seedDefaultSettings();
    console.log('[startup] Default settings seeded.');

    // Register bot webhook (only in production)
    if (process.env.NODE_ENV === 'production' && process.env.APP_URL) {
      const webhookUrl = `${process.env.APP_URL}/bot`;
      await bot.setWebHook(webhookUrl);
      console.log(`[startup] Bot webhook set: ${webhookUrl}`);
    }

    httpServer.listen(PORT, () => {
      console.log(`[startup] Orthodox Econet running on port ${PORT}`);
      console.log(`[startup] Environment: ${process.env.NODE_ENV}`);
    });

  } catch (err) {
    console.error('[startup] Fatal error:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[shutdown] SIGTERM received — closing connections…');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('[shutdown] Server closed.');
    process.exit(0);
  });
});

start();
