// backend/src/routes/notifications.js
// In-app notification management for verified users.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { parsePagination, buildCursorPage } = require('../utils/helpers');

// ─── GET /api/notifications ───────────────────────────────────────────────────

router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { limit, cursor } = parsePagination(req.query, 30);
    const { unreadOnly } = req.query;

    const where = { recipientId: req.user.id };
    if (unreadOnly === 'true') where.isRead = false;

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.notification.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const notifications = await prisma.notification.findMany({
      where:   { ...where, ...cursorCondition },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
    });

    const { items, nextCursor, hasMore } = buildCursorPage(notifications, limit);
    res.json({ notifications: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /api/notifications]', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ─── GET /api/notifications/unread-count ─────────────────────────────────────

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { recipientId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

// ─── PUT /api/notifications/:id/read ─────────────────────────────────────────

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.recipientId !== req.user.id) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data:  { isRead: true, readAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ─── PUT /api/notifications/read-all ─────────────────────────────────────────

router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { recipientId: req.user.id, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.recipientId !== req.user.id) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    await prisma.notification.delete({ where: { id: notification.id } });
    res.json({ message: 'Notification deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
