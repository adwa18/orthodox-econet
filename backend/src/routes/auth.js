// backend/src/routes/auth.js
// Auth routes: initData validation, registration, 2FA, account recovery.

const router  = require('express').Router();
const crypto  = require('crypto');
const { prisma } = require('../config/db');
const { validateInitData, normalizeTelegramUser } = require('../config/telegram');
const { signToken, requireAuth } = require('../middleware/auth');
const { registrationLimiter, authLimiter } = require('../middleware/rateLimit');
const botService = require('../services/botService');
const { sanitizeUser } = require('../utils/helpers');

// The exact Amharic faith declaration the user must retype
const CREED_PHRASE =
  'በሥላሴ ሦስትነት እና አንድነት አምናለው፣ የኢየሱስ ክርስቶስን የባህርይ አምላክነት በፍጹም ልቤ አምናለው፣ ' +
  'የድንግል ማርያም ጻድቃን መላዕክት ሰማዕታት አማላጅነት አምናለው።';

/** Normalize whitespace for creed comparison */
const normalizeCreed = (s) => (s || '').trim().replace(/\s+/g, ' ');

// ─── POST /api/auth ───────────────────────────────────────────────────────────
// Validate initData → return JWT + user status.
// Called every time the Mini App opens.

router.post('/', authLimiter, async (req, res) => {
  try {
    const { initData } = req.body;
    const { valid, user: tgUser, error } = validateInitData(initData);
    if (!valid) return res.status(401).json({ error: 'Invalid Telegram auth', details: error });

    const tgData = normalizeTelegramUser(tgUser);

    const user = await prisma.user.findUnique({
      where:   { telegramId: tgData.telegramId },
      include: {
        bansReceived: {
          where:   { isActive: true },
          orderBy: { createdAt: 'desc' },
          take:    1,
        },
        badges: true,
      },
    });

    if (!user) {
      return res.json({ status: 'NOT_REGISTERED', telegramUser: tgUser });
    }

    // Refresh Telegram metadata silently
    prisma.user.update({
      where: { id: user.id },
      data:  {
        telegramUsername:  tgData.telegramUsername,
        telegramFirstName: tgData.telegramFirstName,
        telegramLastName:  tgData.telegramLastName,
        telegramPhotoUrl:  tgData.telegramPhotoUrl,
        lastLoginAt:       new Date(),
      },
    }).catch(() => {});

    if (user.status === 'BANNED') {
      const ban = user.bansReceived[0];
      // Check if temporary ban expired
      if (ban && !ban.isPermanent && ban.expiresAt && ban.expiresAt <= new Date()) {
        await prisma.$transaction([
          prisma.ban.update({ where: { id: ban.id }, data: { isActive: false, unbannedAt: new Date(), unbanReason: 'Automatic expiry' } }),
          prisma.user.update({ where: { id: user.id }, data: { status: 'VERIFIED' } }),
        ]);
        const token = signToken(user.id);
        return res.json({ status: 'VERIFIED', token, user: sanitizeUser(user) });
      }
      return res.status(403).json({
        status:      'BANNED',
        reason:      ban?.reason,
        isPermanent: ban?.isPermanent,
        expiresAt:   ban?.expiresAt,
      });
    }

    if (user.status === 'UNVERIFIED') return res.json({ status: 'UNVERIFIED' });
    if (user.status === 'DECLINED')   return res.json({ status: 'DECLINED', reason: user.declineReason });

    const token = signToken(user.id);
    return res.json({ status: 'VERIFIED', token, user: sanitizeUser(user) });

  } catch (err) {
    console.error('[POST /api/auth]', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Create an UNVERIFIED user record. Admin must verify before they can log in.

router.post('/register', registrationLimiter, async (req, res) => {
  try {
    const { initData, fullName, baptismName, churchName, phoneNumber, email, creedPhrase } = req.body;

    // 1. Validate Telegram identity
    const { valid, user: tgUser, error } = validateInitData(initData);
    if (!valid) return res.status(401).json({ error: 'Invalid Telegram auth', details: error });

    // 2. Required field check
    const required = { fullName, baptismName, churchName, phoneNumber, email };
    const missing  = Object.entries(required)
      .filter(([, v]) => !v?.trim())
      .map(([k]) => k);
    if (missing.length) {
      return res.status(400).json({ error: 'missing_fields', fields: missing });
    }

    // 3. Creed phrase validation (the most important check)
    if (normalizeCreed(creedPhrase) !== normalizeCreed(CREED_PHRASE)) {
      return res.status(400).json({
        error:   'creed_mismatch',
        message: 'Please retype the faith declaration exactly as shown. / የሃይማኖት ቃሉን ትክክለኛ ይጻፉ።',
      });
    }

    // 4. Email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    const tgData = normalizeTelegramUser(tgUser);

    // 5. Duplicate check
    const existing = await prisma.user.findUnique({ where: { telegramId: tgData.telegramId } });
    if (existing) {
      return res.status(409).json({
        error:  'already_registered',
        status: existing.status,
        message: existing.status === 'DECLINED'
          ? 'Your previous registration was declined. Contact support to reapply.'
          : 'You are already registered.',
      });
    }

    // 6. Create user
    const user = await prisma.user.create({
      data: {
        ...tgData,
        fullName:    fullName.trim(),
        baptismName: baptismName.trim(),
        churchName:  churchName.trim(),
        phoneNumber: phoneNumber.trim(),
        email:       email.trim().toLowerCase(),
        creedAccepted: true,
        status:        'UNVERIFIED',
      },
    });

    // 7. Notify owner (fire-and-forget)
    if (process.env.OWNER_CHAT_ID) {
      botService.notifyAdminNewRegistration(process.env.OWNER_CHAT_ID, {
        fullName:        user.fullName,
        baptismName:     user.baptismName,
        churchName:      user.churchName,
        telegramUsername: user.telegramUsername,
      }).catch(console.error);
    }

    return res.status(201).json({
      status:  'UNVERIFIED',
      message: 'Registration submitted. You will be notified when verified. / ምዝገባዎ ቀርቧል።',
    });

  } catch (err) {
    console.error('[POST /api/auth/register]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /api/auth/2fa/request ───────────────────────────────────────────────
// Generate a 6-digit 2FA code, hash it, send via bot.

router.post('/2fa/request', requireAuth, async (req, res) => {
  try {
    const code    = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed  = crypto.createHash('sha256').update(code).digest('hex');
    const expiry  = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.user.update({
      where: { id: req.user.id },
      data:  { twoFactorCode: hashed, twoFactorExpiry: expiry },
    });

    await botService.send2FACode(req.user.telegramId, code);

    res.json({ message: '2FA code sent via Telegram.' });
  } catch (err) {
    console.error('[POST /api/auth/2fa/request]', err);
    res.status(500).json({ error: 'Failed to send 2FA code' });
  }
});

// ─── POST /api/auth/2fa/verify ────────────────────────────────────────────────

router.post('/2fa/verify', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.twoFactorCode || !user.twoFactorExpiry || user.twoFactorExpiry < new Date()) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }

    const hashed = crypto.createHash('sha256').update(code.trim()).digest('hex');
    if (hashed !== user.twoFactorCode) {
      return res.status(400).json({ error: 'Invalid code.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { twoFactorCode: null, twoFactorExpiry: null, twoFactorEnabled: true },
    });

    res.json({ verified: true });
  } catch (err) {
    console.error('[POST /api/auth/2fa/verify]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── POST /api/auth/recovery/request ─────────────────────────────────────────
// Step 1 of 3: User provides email/phone/username → bot sends code to OLD Telegram.

router.post('/recovery/request', authLimiter, async (req, res) => {
  try {
    const { email, phoneNumber, telegramUsername } = req.body;

    if (!email && !phoneNumber && !telegramUsername) {
      return res.status(400).json({ error: 'Provide email, phone, or Telegram username' });
    }

    const orClauses = [];
    if (email)           orClauses.push({ email: email.trim().toLowerCase() });
    if (phoneNumber)     orClauses.push({ phoneNumber: phoneNumber.trim() });
    if (telegramUsername) orClauses.push({ telegramUsername: telegramUsername.trim() });

    const user = await prisma.user.findFirst({ where: { OR: orClauses } });

    // Always return 200 to prevent user enumeration
    if (user) {
      const code   = Math.floor(100000 + Math.random() * 900000).toString();
      const hashed = crypto.createHash('sha256').update(code).digest('hex');
      const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min

      await prisma.user.update({
        where: { id: user.id },
        data:  { recoveryCode: hashed, recoveryCodeExpiry: expiry },
      });

      await botService.sendRecoveryCode(user.telegramId, code).catch(console.error);
    }

    res.json({
      message: 'If an account matches, a recovery code has been sent to your Telegram.',
      // Return userId only if found — needed for step 2
      userId: user?.id || null,
    });
  } catch (err) {
    console.error('[POST /api/auth/recovery/request]', err);
    res.status(500).json({ error: 'Recovery request failed' });
  }
});

// ─── POST /api/auth/recovery/verify ──────────────────────────────────────────
// Step 2: Verify code + reassign telegramId to new account → return new JWT.

router.post('/recovery/verify', authLimiter, async (req, res) => {
  try {
    const { userId, code, newTelegramInitData } = req.body;

    if (!userId || !code || !newTelegramInitData) {
      return res.status(400).json({ error: 'userId, code, and newTelegramInitData are required' });
    }

    // Validate the NEW Telegram identity
    const { valid, user: newTgUser, error } = validateInitData(newTelegramInitData);
    if (!valid) return res.status(401).json({ error: 'Invalid new Telegram identity', details: error });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Account not found' });

    if (!user.recoveryCode || !user.recoveryCodeExpiry || user.recoveryCodeExpiry < new Date()) {
      return res.status(400).json({ error: 'Recovery code expired. Please restart the process.' });
    }

    const hashed = crypto.createHash('sha256').update(code.trim()).digest('hex');
    if (hashed !== user.recoveryCode) {
      return res.status(400).json({ error: 'Invalid recovery code.' });
    }

    const newTgData = normalizeTelegramUser(newTgUser);

    // Check the new Telegram ID isn't already taken
    const conflict = await prisma.user.findUnique({ where: { telegramId: newTgData.telegramId } });
    if (conflict && conflict.id !== userId) {
      return res.status(409).json({ error: 'This Telegram account is linked to another profile.' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data:  {
        telegramId:        newTgData.telegramId,
        telegramUsername:  newTgData.telegramUsername,
        telegramFirstName: newTgData.telegramFirstName,
        telegramLastName:  newTgData.telegramLastName,
        recoveryCode:      null,
        recoveryCodeExpiry: null,
      },
    });

    const token = signToken(updated.id);
    res.json({ token, message: 'Account recovered. / መለያዎ ተመልሷል።' });

  } catch (err) {
    console.error('[POST /api/auth/recovery/verify]', err);
    res.status(500).json({ error: 'Recovery failed' });
  }
});

module.exports = router;
