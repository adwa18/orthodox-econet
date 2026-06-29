// backend/src/routes/broadcast.js
// Admin-only announcements — general (home screen) and per-section, with pin support.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { requireModerator } = require('../middleware/rbac');
const { automodMiddleware } = require('../middleware/automod');
const { postUpload, uploadFiles, handleUploadError } = require('../middleware/upload');
const { logAdminAction, parsePagination, buildCursorPage, getClientIp, createNotification } = require('../utils/helpers');
const { emitAnnouncement } = require('../services/socketService');
const botService = require('../services/botService');

const auth = [requireAuth, requireVerified, requireModerator];

const VALID_SECTIONS = [
  'spiritual-life','business-directory','import-export','education-training',
  'logistics-supply','jobs-careers','it-software','health-wellness',
  'marketplace-b2c','banking-finance','tenders-bids','engineering-architecture',
  'legal-property','trust-safety','business-development','healthcare-community',
];

// ─── GET /api/broadcast ───────────────────────────────────────────────────────
// Fetch announcements — all verified users can read; filter by type or sectionId.

router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { type, sectionId, pinned, limit: lim, cursor } = req.query;
    const { limit } = parsePagination({ limit: lim }, 20);

    const where = { status: 'active' };
    if (type)      where.type      = type;
    if (sectionId) where.sectionId = sectionId;
    if (pinned === 'true') where.isPinned = true;

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.announcement.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const announcements = await prisma.announcement.findMany({
      where:   { ...where, ...cursorCondition },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take:    limit + 1,
      include: {
        author: { select: { id: true, fullName: true, telegramPhotoUrl: true, role: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(announcements, limit);
    res.json({ announcements: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /api/broadcast]', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// ─── POST /api/broadcast ──────────────────────────────────────────────────────
// Create an announcement. type=general → shown on home. type=section → shown in section.

router.post(
  '/',
  ...auth,
  postUpload.array('attachments', 3),
  automodMiddleware,
  async (req, res) => {
    try {
      const { title, content, type, sectionId, isPinned } = req.body;

      if (!title?.trim())   return res.status(400).json({ error: 'Title is required.' });
      if (!content?.trim()) return res.status(400).json({ error: 'Content is required.' });
      if (!['general', 'section'].includes(type)) {
        return res.status(400).json({ error: 'type must be "general" or "section".' });
      }
      if (type === 'section') {
        if (!sectionId) return res.status(400).json({ error: 'sectionId required for section announcements.' });
        if (!VALID_SECTIONS.includes(sectionId)) return res.status(400).json({ error: 'Invalid sectionId.' });
      }

      let attachments = [];
      if (req.files?.length) attachments = await uploadFiles(req.files, 'announcement');

      const pinBool = isPinned === 'true' || isPinned === true;

      const announcement = await prisma.announcement.create({
        data: {
          title:       title.trim(),
          content:     content.trim(),
          authorId:    req.user.id,
          type,
          sectionId:   type === 'section' ? sectionId : null,
          isPinned:    pinBool,
          pinnedAt:    pinBool ? new Date() : null,
          attachments: attachments.length ? attachments : undefined,
          status:      'active',
        },
        include: {
          author: { select: { id: true, fullName: true, telegramPhotoUrl: true, role: true } },
        },
      });

      await logAdminAction({
        adminId: req.user.id, action: 'CREATE_ANNOUNCEMENT',
        targetAnnouncementId: announcement.id,
        details: { type, sectionId: sectionId || null, isPinned: pinBool },
        ipAddress: getClientIp(req),
      });

      // Real-time broadcast via Socket.io
      emitAnnouncement(announcement, type === 'section' ? sectionId : null);

      // Push bot notifications to all verified users for general pinned announcements
      if (type === 'general' && pinBool) {
        _notifyAllVerified(announcement, req.app.get('io')).catch(console.error);
      }

      res.status(201).json(announcement);
    } catch (err) {
      console.error('[POST /api/broadcast]', err);
      res.status(500).json({ error: 'Failed to create announcement' });
    }
  },
  handleUploadError,
);

// ─── PUT /api/broadcast/:id/pin ───────────────────────────────────────────────

router.put('/:id/pin', ...auth, async (req, res) => {
  try {
    const { pin = true } = req.body;
    const pinBool = pin === true || pin === 'true';

    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!announcement || announcement.status === 'archived') {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    const updated = await prisma.announcement.update({
      where: { id: announcement.id },
      data:  { isPinned: pinBool, pinnedAt: pinBool ? new Date() : null },
    });

    await logAdminAction({
      adminId: req.user.id, action: pinBool ? 'PIN_ANNOUNCEMENT' : 'UNPIN_ANNOUNCEMENT',
      targetAnnouncementId: announcement.id, ipAddress: getClientIp(req),
    });

    res.json(updated);
  } catch (err) {
    console.error('[PUT /api/broadcast/:id/pin]', err);
    res.status(500).json({ error: 'Pin toggle failed' });
  }
});

// ─── PUT /api/broadcast/:id ───────────────────────────────────────────────────
// Edit announcement text/title.

router.put('/:id', ...auth, automodMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!announcement || announcement.status === 'archived') {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    const updated = await prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        ...(title?.trim()   && { title: title.trim() }),
        ...(content?.trim() && { content: content.trim() }),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Edit failed' });
  }
});

// ─── DELETE /api/broadcast/:id ────────────────────────────────────────────────
// Archive (soft-delete) an announcement.

router.delete('/:id', ...auth, async (req, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!announcement) return res.status(404).json({ error: 'Announcement not found.' });

    await prisma.announcement.update({
      where: { id: announcement.id },
      data:  { status: 'archived', isPinned: false },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'ARCHIVE_ANNOUNCEMENT',
      targetAnnouncementId: announcement.id, ipAddress: getClientIp(req),
    });

    res.json({ message: 'Announcement archived.' });
  } catch (err) {
    console.error('[DELETE /api/broadcast/:id]', err);
    res.status(500).json({ error: 'Archive failed' });
  }
});

// ─── Internal: notify all verified users via bot ──────────────────────────────
async function _notifyAllVerified(announcement, io) {
  const users = await prisma.user.findMany({
    where:  { status: 'VERIFIED' },
    select: { id: true, telegramId: true },
  });

  for (const user of users) {
    // In-app notification
    createNotification({
      recipientId: user.id,
      type:        'announcement',
      title:       announcement.title,
      message:     announcement.content.slice(0, 150),
      related:     { announcementId: announcement.id },
      actionUrl:   '/',
      io,
    }).catch(() => {});

    // Bot push (staggered to avoid Telegram rate limits)
    await new Promise((r) => setTimeout(r, 50));
    botService.sendAnnouncementNotification(
      user.telegramId, announcement.title, announcement.content,
    ).catch(() => {});
  }
}

module.exports = router;
