// backend/src/routes/users.js
// User profile, endorsements, and engagement stats.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { sanitizeUser, createNotification } = require('../utils/helpers');
const botService = require('../services/botService');

// ─── GET /api/users/me ────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:   { id: req.user.id },
      include: {
        badges:              true,
        professionalProfile: true,
        endorsements: {
          include: { fromUser: { select: { id: true, fullName: true, telegramPhotoUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take:    10,
        },
      },
    });
    res.json(sanitizeUser(user));
  } catch (err) {
    console.error('[GET /api/users/me]', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── PUT /api/users/me ────────────────────────────────────────────────────────
// Update own preferences and non-sensitive profile fields.

router.put('/me', requireAuth, async (req, res) => {
  try {
    const allowed = ['preferredLanguage', 'dontShowWelcome', 'phoneNumber', 'email', 'churchName'];
    const data    = {};

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        data[field] = typeof req.body[field] === 'string'
          ? req.body[field].trim()
          : req.body[field];
      }
    }

    // Validate language code
    if (data.preferredLanguage && !['am', 'en', 'om', 'ti'].includes(data.preferredLanguage)) {
      return res.status(400).json({ error: 'Invalid language code. Use am, en, om, or ti.' });
    }

    // Sensitive fields (email, phone) require 2FA — check twoFactorEnabled
    const sensitiveFields = ['email', 'phoneNumber'];
    const changingSensitive = sensitiveFields.some((f) => data[f] !== undefined);
    if (changingSensitive && req.user.twoFactorEnabled) {
      // Require 2FA token header for sensitive changes
      const twoFaVerified = req.headers['x-2fa-verified'] === 'true';
      if (!twoFaVerified) {
        return res.status(403).json({ error: '2fa_required', message: 'Verify your identity via 2FA before changing sensitive data.' });
      }
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    const updated = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json(sanitizeUser(updated));

  } catch (err) {
    console.error('[PUT /api/users/me]', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// ─── GET /api/users/me/stats ──────────────────────────────────────────────────
// Personal engagement dashboard.

router.get('/me/stats', requireAuth, requireVerified, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      postsCount,
      reactionsReceived,
      endorsementsReceived,
      sectionsActive,
      recentPosts,
    ] = await Promise.all([
      prisma.post.count({ where: { authorId: userId, status: 'ACTIVE' } }),
      prisma.reaction.count({ where: { post: { authorId: userId } } }),
      prisma.endorsement.count({ where: { toUserId: userId } }),
      // Unique sections the user has posted in
      prisma.post.findMany({
        where:    { authorId: userId, status: 'ACTIVE' },
        select:   { sectionId: true },
        distinct: ['sectionId'],
      }),
      // Last 5 posts
      prisma.post.findMany({
        where:   { authorId: userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take:    5,
        select:  { id: true, sectionId: true, content: true, createdAt: true },
      }),
    ]);

    res.json({
      postsCount,
      reactionsReceived,
      endorsementsReceived,
      sectionsActiveCount: sectionsActive.length,
      sectionsActive:      sectionsActive.map((p) => p.sectionId),
      recentPosts,
      trustScore:          req.user.trustScore,
    });
  } catch (err) {
    console.error('[GET /api/users/me/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
// Public profile — badges, endorsements, professional info.

router.get('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.params.id },
      select: {
        id:               true,
        fullName:         true,
        baptismName:      true,
        churchName:       true,
        telegramUsername: true,
        telegramPhotoUrl: true,
        role:             true,
        status:           true,
        trustScore:       true,
        verifiedAt:       true,
        lastActiveAt:     true,
        postsCount:       true,
        badges:           true,
        endorsements: {
          include: {
            fromUser: { select: { id: true, fullName: true, telegramPhotoUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        professionalProfile: {
          select: {
            field: true, credentials: true, experienceYears: true,
            isVerified: true, consultationFee: true, currency: true,
            availableHours: true, verifiedAt: true,
          },
        },
        _count: {
          select: { posts: true, givenEndorsements: true },
        },
      },
    });

    if (!user || user.status === 'BANNED') {
      return res.status(404).json({ error: 'User not found' });
    }

    // Has the current user already endorsed this person?
    const alreadyEndorsed = await prisma.endorsement.findUnique({
      where: { toUserId_fromUserId: { toUserId: req.params.id, fromUserId: req.user.id } },
    });

    res.json({ ...user, alreadyEndorsed: !!alreadyEndorsed });
  } catch (err) {
    console.error('[GET /api/users/:id]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── POST /api/users/:id/endorse ─────────────────────────────────────────────
// Publicly endorse another verified member.

router.post('/:id/endorse', requireAuth, requireVerified, async (req, res) => {
  try {
    const targetId = req.params.id;
    const { text }  = req.body;

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot endorse yourself.' });
    }

    if (!text?.trim() || text.trim().length < 10) {
      return res.status(400).json({ error: 'Endorsement text must be at least 10 characters.' });
    }

    if (text.trim().length > 500) {
      return res.status(400).json({ error: 'Endorsement text must not exceed 500 characters.' });
    }

    // Check target exists and is verified
    const target = await prisma.user.findUnique({
      where:  { id: targetId },
      select: { id: true, status: true, fullName: true, telegramId: true },
    });
    if (!target || target.status !== 'VERIFIED') {
      return res.status(404).json({ error: 'User not found or not verified.' });
    }

    // Upsert — update text if they endorse again, otherwise create
    const endorsement = await prisma.endorsement.upsert({
      where: { toUserId_fromUserId: { toUserId: targetId, fromUserId: req.user.id } },
      update: { text: text.trim() },
      create: { toUserId: targetId, fromUserId: req.user.id, text: text.trim() },
    });

    // Increment trust score (+1 per unique endorser)
    await prisma.user.update({
      where: { id: targetId },
      data:  { trustScore: { increment: 1 } },
    });

    // In-app notification + bot notification
    const io = req.app.get('io');
    await createNotification({
      recipientId: targetId,
      type:        'endorsement',
      title:       'New Endorsement',
      message:     `${req.user.fullName} endorsed you: "${text.trim().slice(0, 80)}…"`,
      related:     { userId: req.user.id },
      actionUrl:   `/profile/${req.user.id}`,
      io,
    });

    botService.sendEndorsementNotification(target.telegramId, req.user.fullName).catch(console.error);

    res.status(201).json(endorsement);
  } catch (err) {
    console.error('[POST /api/users/:id/endorse]', err);
    res.status(500).json({ error: 'Endorsement failed' });
  }
});

// ─── DELETE /api/users/:id/endorse ───────────────────────────────────────────
// Withdraw an endorsement.

router.delete('/:id/endorse', requireAuth, requireVerified, async (req, res) => {
  try {
    const targetId = req.params.id;

    const existing = await prisma.endorsement.findUnique({
      where: { toUserId_fromUserId: { toUserId: targetId, fromUserId: req.user.id } },
    });
    if (!existing) return res.status(404).json({ error: 'Endorsement not found.' });

    await prisma.endorsement.delete({
      where: { toUserId_fromUserId: { toUserId: targetId, fromUserId: req.user.id } },
    });

    // Decrement trust score (floor at 0)
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { trustScore: true } });
    if (target && target.trustScore > 0) {
      await prisma.user.update({
        where: { id: targetId },
        data:  { trustScore: { decrement: 1 } },
      });
    }

    res.json({ message: 'Endorsement withdrawn.' });
  } catch (err) {
    console.error('[DELETE /api/users/:id/endorse]', err);
    res.status(500).json({ error: 'Failed to withdraw endorsement' });
  }
});

module.exports = router;
