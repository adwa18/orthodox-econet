// backend/src/routes/admin.js
// All admin operations: verifications, post moderation, user management,
// audit log, overview stats, reports, badges, professional apps, donations.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { requireModerator, requireSeniorAdmin, requireOwner, hasRole } = require('../middleware/rbac');
const { invalidateBannedWordsCache } = require('../middleware/automod');
const { createNotification, logAdminAction, parsePagination, buildCursorPage, getClientIp } = require('../utils/helpers');
const botService = require('../services/botService');
const { emitPostModerated } = require('../services/socketService');

const auth = [requireAuth, requireVerified];
const mod  = [...auth, requireModerator];
const sa   = [...auth, requireSeniorAdmin];
const own  = [...auth, requireOwner];

// ─── VERIFICATIONS ────────────────────────────────────────────────────────────

// GET /api/admin/verifications
router.get('/verifications', ...mod, async (req, res) => {
  try {
    const { limit, cursor } = parsePagination(req.query, 20);
    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.user.findUnique({ where: { id: cursor }, select: { registeredAt: true } });
      if (c) cursorCondition = { registeredAt: { lt: c.registeredAt } };
    }

    const users = await prisma.user.findMany({
      where:   { status: 'UNVERIFIED', ...cursorCondition },
      orderBy: { registeredAt: 'desc' },
      take:    limit + 1,
      select:  {
        id: true, fullName: true, baptismName: true, churchName: true,
        phoneNumber: true, email: true, telegramUsername: true,
        telegramFirstName: true, telegramLastName: true, registeredAt: true,
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(users, limit);
    res.json({ users: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /admin/verifications]', err);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// PUT /api/admin/verifications/:userId/verify
router.put('/verifications/:userId/verify', ...sa, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.status !== 'UNVERIFIED') return res.status(400).json({ error: 'User is not pending verification' });

    await prisma.user.update({
      where: { id: user.id },
      data:  { status: 'VERIFIED', verifiedAt: new Date() },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'VERIFY_USER',
      targetUserId: user.id, ipAddress: getClientIp(req),
    });

    botService.sendWelcome(user.telegramId, user.telegramFirstName).catch(console.error);
    res.json({ message: 'User verified.' });
  } catch (err) {
    console.error('[PUT /admin/verifications/:userId/verify]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// PUT /api/admin/verifications/:userId/decline
router.put('/verifications/:userId/decline', ...sa, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Decline reason is required.' });

    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.user.update({
      where: { id: user.id },
      data:  { status: 'DECLINED', declineReason: reason.trim() },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'DECLINE_USER',
      targetUserId: user.id, details: { reason }, ipAddress: getClientIp(req),
    });

    botService.sendDeclined(user.telegramId, user.telegramFirstName, reason.trim()).catch(console.error);
    res.json({ message: 'User declined.' });
  } catch (err) {
    console.error('[PUT /admin/verifications/:userId/decline]', err);
    res.status(500).json({ error: 'Decline failed' });
  }
});

// ─── POST MODERATION ──────────────────────────────────────────────────────────

// GET /api/admin/posts — all posts across all sections
router.get('/posts', ...mod, async (req, res) => {
  try {
    const { limit, cursor } = parsePagination(req.query, 30);
    const { sectionId, status, flagged } = req.query;

    const where = {};
    if (sectionId) where.sectionId = sectionId;
    if (status)    where.status    = status;
    if (flagged === 'true') where.status = 'FLAGGED';

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.post.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const posts = await prisma.post.findMany({
      where:   { ...where, ...cursorCondition },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      include: {
        author:  { select: { id: true, fullName: true, telegramUsername: true, telegramPhotoUrl: true } },
        reports: { where: { status: 'pending' }, select: { id: true } },
        _count:  { select: { reactions: true, replies: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(posts, limit);
    res.json({ posts: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /admin/posts]', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// PUT /api/admin/posts/:id — edit text content
router.put('/posts/:id', ...mod, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content cannot be empty.' });

    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const updated = await prisma.post.update({
      where: { id: post.id },
      data:  { content: content.trim(), status: post.status === 'FLAGGED' ? 'ACTIVE' : post.status },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'EDIT_POST',
      targetPostId: post.id, details: { previousContent: post.content }, ipAddress: getClientIp(req),
    });

    res.json(updated);
  } catch (err) {
    console.error('[PUT /admin/posts/:id]', err);
    res.status(500).json({ error: 'Edit failed' });
  }
});

// DELETE /api/admin/posts/:id — soft delete
router.delete('/posts/:id', ...mod, async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post || post.status === 'DELETED') return res.status(404).json({ error: 'Post not found.' });

    await prisma.post.update({
      where: { id: post.id },
      data:  { status: 'DELETED', deletedAt: new Date(), deletedById: req.user.id, deleteReason: reason || null },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'DELETE_POST',
      targetPostId: post.id, details: { reason, sectionId: post.sectionId }, ipAddress: getClientIp(req),
    });

    emitPostModerated(post.sectionId, post.id, 'deleted');
    res.json({ message: 'Post deleted.' });
  } catch (err) {
    console.error('[DELETE /admin/posts/:id]', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// PUT /api/admin/posts/:id/restore — undo soft delete
router.put('/posts/:id/restore', ...mod, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post || post.status !== 'DELETED') return res.status(404).json({ error: 'Post is not deleted.' });

    const restored = await prisma.post.update({
      where: { id: post.id },
      data:  { status: 'ACTIVE', deletedAt: null, deletedById: null, deleteReason: null },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'RESTORE_POST',
      targetPostId: post.id, ipAddress: getClientIp(req),
    });

    res.json(restored);
  } catch (err) {
    console.error('[PUT /admin/posts/:id/restore]', err);
    res.status(500).json({ error: 'Restore failed' });
  }
});

// PUT /api/admin/posts/:id/move — reassign to different section
router.put('/posts/:id/move', ...mod, async (req, res) => {
  try {
    const { targetSectionId } = req.body;
    const VALID_SECTIONS = [
      'spiritual-life','business-directory','import-export','education-training',
      'logistics-supply','jobs-careers','it-software','health-wellness',
      'marketplace-b2c','banking-finance','tenders-bids','engineering-architecture',
      'legal-property','trust-safety','business-development','healthcare-community',
    ];
    if (!VALID_SECTIONS.includes(targetSectionId)) {
      return res.status(400).json({ error: 'Invalid target section ID.' });
    }

    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post || post.status === 'DELETED') return res.status(404).json({ error: 'Post not found.' });

    const updated = await prisma.post.update({
      where: { id: post.id },
      data:  {
        sectionId:       targetSectionId,
        originalSection: post.originalSection || post.sectionId,
        movedAt:         new Date(),
        movedById:       req.user.id,
      },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'MOVE_POST', targetPostId: post.id,
      details: { fromSection: post.sectionId, toSection: targetSectionId }, ipAddress: getClientIp(req),
    });

    emitPostModerated(post.sectionId, post.id, 'moved', { newSectionId: targetSectionId });
    res.json(updated);
  } catch (err) {
    console.error('[PUT /admin/posts/:id/move]', err);
    res.status(500).json({ error: 'Move failed' });
  }
});

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

// GET /api/admin/users — search users
router.get('/users', ...mod, async (req, res) => {
  try {
    const { q, status, role, limit: lim, cursor } = req.query;
    const { limit } = parsePagination({ limit: lim }, 20);

    const where = {};
    if (status) where.status = status;
    if (role)   where.role   = role;
    if (q?.trim()) {
      where.OR = [
        { fullName:        { contains: q.trim(), mode: 'insensitive' } },
        { telegramUsername:{ contains: q.trim(), mode: 'insensitive' } },
        { phoneNumber:     { contains: q.trim() } },
        { email:           { contains: q.trim(), mode: 'insensitive' } },
      ];
    }

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.user.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const users = await prisma.user.findMany({
      where:   { ...where, ...cursorCondition },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      select:  {
        id: true, fullName: true, baptismName: true, email: true,
        phoneNumber: true, telegramUsername: true, telegramPhotoUrl: true,
        status: true, role: true, trustScore: true, postsCount: true,
        registeredAt: true, verifiedAt: true, lastActiveAt: true,
        badges: true,
        bansReceived: { where: { isActive: true }, take: 1 },
        _count: { select: { warnings: true, bansReceived: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(users, limit);
    res.json({ users: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /admin/users]', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:id/warn
router.post('/users/:id/warn', ...sa, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Warning message is required.' });

    const target = await prisma.user.findUnique({
      where: { id: req.params.id }, select: { id: true, telegramId: true, telegramFirstName: true, status: true },
    });
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (!hasRole(req.user, 'SENIOR_ADMIN') && target.role !== 'USER') {
      return res.status(403).json({ error: 'You can only warn regular users.' });
    }

    await prisma.warning.create({
      data: { userId: target.id, issuedById: req.user.id, message: message.trim() },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'WARN_USER',
      targetUserId: target.id, details: { message }, ipAddress: getClientIp(req),
    });

    const io = req.app.get('io');
    await createNotification({
      recipientId: target.id, type: 'warning',
      title: 'Official Warning', message: message.trim(), io,
    });

    botService.sendWarning(target.telegramId, target.telegramFirstName, message.trim()).catch(console.error);
    res.json({ message: 'Warning issued.' });
  } catch (err) {
    console.error('[POST /admin/users/:id/warn]', err);
    res.status(500).json({ error: 'Warning failed' });
  }
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', ...sa, async (req, res) => {
  try {
    const { reason, isPermanent = false, durationHours } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'Ban reason is required.' });

    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: true, telegramId: true, telegramFirstName: true, status: true },
    });
    if (!target) return res.status(404).json({ error: 'User not found.' });

    // Only OWNER can ban other admins
    if (['SENIOR_ADMIN', 'OWNER'].includes(target.role) && !hasRole(req.user, 'OWNER')) {
      return res.status(403).json({ error: 'Only the Owner can ban admin-level users.' });
    }

    // Deactivate existing bans first
    await prisma.ban.updateMany({ where: { userId: target.id, isActive: true }, data: { isActive: false } });

    const expiresAt = !isPermanent && durationHours
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
      : null;

    await prisma.$transaction([
      prisma.ban.create({
        data: {
          userId: target.id, bannedById: req.user.id,
          reason: reason.trim(), isPermanent: !!isPermanent,
          durationHours: durationHours || null, expiresAt,
          isActive: true,
        },
      }),
      prisma.user.update({ where: { id: target.id }, data: { status: 'BANNED' } }),
    ]);

    await logAdminAction({
      adminId: req.user.id, action: 'BAN_USER', targetUserId: target.id,
      details: { reason, isPermanent, durationHours }, ipAddress: getClientIp(req),
    });

    botService.sendBanned(target.telegramId, target.telegramFirstName, reason.trim(), !!isPermanent, expiresAt)
      .catch(console.error);

    res.json({ message: `User banned ${isPermanent ? 'permanently' : `for ${durationHours}h`}.` });
  } catch (err) {
    console.error('[POST /admin/users/:id/ban]', err);
    res.status(500).json({ error: 'Ban failed' });
  }
});

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', ...sa, async (req, res) => {
  try {
    const { reason } = req.body;
    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, telegramId: true, telegramFirstName: true },
    });
    if (!target || target.status !== 'BANNED') {
      return res.status(404).json({ error: 'No active ban found for this user.' });
    }

    await prisma.$transaction([
      prisma.ban.updateMany({
        where: { userId: target.id, isActive: true },
        data:  { isActive: false, unbannedAt: new Date(), unbannedById: req.user.id, unbanReason: reason || null },
      }),
      prisma.user.update({ where: { id: target.id }, data: { status: 'VERIFIED' } }),
    ]);

    await logAdminAction({
      adminId: req.user.id, action: 'UNBAN_USER',
      targetUserId: target.id, details: { reason }, ipAddress: getClientIp(req),
    });

    botService.sendUnbanned(target.telegramId, target.telegramFirstName).catch(console.error);
    res.json({ message: 'User unbanned.' });
  } catch (err) {
    console.error('[POST /admin/users/:id/unban]', err);
    res.status(500).json({ error: 'Unban failed' });
  }
});

// GET /api/admin/users/:id/ban-history
router.get('/users/:id/ban-history', ...mod, async (req, res) => {
  try {
    const bans = await prisma.ban.findMany({
      where:   { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: { bannedBy: { select: { id: true, fullName: true } } },
    });
    res.json(bans);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ban history' });
  }
});

// ─── ADMIN MANAGEMENT (Owner only) ───────────────────────────────────────────

// POST /api/admin/admins — promote user to admin/moderator
router.post('/admins', ...own, async (req, res) => {
  try {
    const { userId, role } = req.body;
    const PROMOTABLE = ['MODERATOR', 'SENIOR_ADMIN'];
    if (!PROMOTABLE.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${PROMOTABLE.join(', ')}` });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId }, select: { id: true, fullName: true, role: true, status: true },
    });
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.status !== 'VERIFIED') return res.status(400).json({ error: 'User must be verified.' });
    if (target.role === 'OWNER') return res.status(400).json({ error: 'Cannot change Owner role.' });

    await prisma.user.update({ where: { id: userId }, data: { role } });

    await logAdminAction({
      adminId: req.user.id, action: 'ADD_ADMIN', targetUserId: userId,
      details: { newRole: role }, ipAddress: getClientIp(req),
    });

    res.json({ message: `${target.fullName} is now ${role}.` });
  } catch (err) {
    console.error('[POST /admin/admins]', err);
    res.status(500).json({ error: 'Promotion failed' });
  }
});

// DELETE /api/admin/admins/:id — demote admin back to USER
router.delete('/admins/:id', ...own, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({
      where: { id: req.params.id }, select: { id: true, role: true, fullName: true },
    });
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'OWNER') return res.status(400).json({ error: 'Cannot remove Owner.' });

    const previousRole = target.role;
    await prisma.user.update({ where: { id: target.id }, data: { role: 'USER' } });

    await logAdminAction({
      adminId: req.user.id, action: 'REMOVE_ADMIN', targetUserId: target.id,
      details: { previousRole }, ipAddress: getClientIp(req),
    });

    res.json({ message: `${target.fullName} demoted to USER.` });
  } catch (err) {
    console.error('[DELETE /admin/admins/:id]', err);
    res.status(500).json({ error: 'Demotion failed' });
  }
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

router.get('/audit-log', ...sa, async (req, res) => {
  try {
    const { limit, cursor } = parsePagination(req.query, 30);
    const { adminId, action } = req.query;

    const where = {};
    if (adminId) where.adminId = adminId;
    if (action)  where.action  = action;

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.adminAction.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const actions = await prisma.adminAction.findMany({
      where:   { ...where, ...cursorCondition },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      include: {
        admin:      { select: { id: true, fullName: true } },
        targetUser: { select: { id: true, fullName: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(actions, limit);
    res.json({ actions: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /admin/audit-log]', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ─── OVERVIEW / STATISTICS ────────────────────────────────────────────────────

router.get('/overview', ...mod, async (req, res) => {
  try {
    const now       = new Date();
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

    const SECTIONS = [
      'spiritual-life','business-directory','import-export','education-training',
      'logistics-supply','jobs-careers','it-software','health-wellness',
      'marketplace-b2c','banking-finance','tenders-bids','engineering-architecture',
      'legal-property','trust-safety','business-development','healthcare-community',
    ];

    const [
      totalRegistered, totalVerified, totalBanned, totalUnverified, totalDeclined,
      postsToday, postsWeek, postsMonth, totalPosts,
      pendingReports, sectionCounts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'VERIFIED' } }),
      prisma.user.count({ where: { status: 'BANNED' } }),
      prisma.user.count({ where: { status: 'UNVERIFIED' } }),
      prisma.user.count({ where: { status: 'DECLINED' } }),
      prisma.post.count({ where: { status: 'ACTIVE', createdAt: { gte: todayStart } } }),
      prisma.post.count({ where: { status: 'ACTIVE', createdAt: { gte: weekStart } } }),
      prisma.post.count({ where: { status: 'ACTIVE', createdAt: { gte: monthStart } } }),
      prisma.post.count({ where: { status: 'ACTIVE' } }),
      prisma.report.count({ where: { status: 'pending' } }),
      // Total post count per section
      Promise.all(
        SECTIONS.map(async (sectionId) => ({
          sectionId,
          postCount: await prisma.post.count({ where: { sectionId, status: 'ACTIVE' } }),
        }))
      ),
    ]);

    res.json({
      users: { totalRegistered, totalVerified, totalBanned, totalUnverified, totalDeclined },
      posts: { today: postsToday, thisWeek: postsWeek, thisMonth: postsMonth, total: totalPosts },
      moderation: { pendingReports },
      sections: sectionCounts,
    });
  } catch (err) {
    console.error('[GET /admin/overview]', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────

router.get('/reports', ...mod, async (req, res) => {
  try {
    const { status, targetType, limit: lim, cursor } = req.query;
    const { limit } = parsePagination({ limit: lim }, 20);

    const where = {};
    if (status)     where.status     = status;
    if (targetType) where.targetType = targetType;

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.report.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const reports = await prisma.report.findMany({
      where: { ...where, ...cursorCondition },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        reporter:   { select: { id: true, fullName: true, telegramUsername: true } },
        targetPost: { select: { id: true, content: true, sectionId: true, authorId: true } },
        targetUser: { select: { id: true, fullName: true, telegramUsername: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(reports, limit);
    res.json({ reports: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /admin/reports]', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.put('/reports/:id/resolve', ...mod, async (req, res) => {
  try {
    const { resolution } = req.body;
    if (!resolution?.trim()) return res.status(400).json({ error: 'Resolution note required.' });

    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    await prisma.report.update({
      where: { id: report.id },
      data:  { status: 'resolved', resolvedById: req.user.id, resolution: resolution.trim(), resolvedAt: new Date() },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'RESOLVE_REPORT',
      details: { reportId: report.id, resolution }, ipAddress: getClientIp(req),
    });

    res.json({ message: 'Report resolved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

router.put('/reports/:id/dismiss', ...mod, async (req, res) => {
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    await prisma.report.update({
      where: { id: report.id },
      data:  { status: 'dismissed', resolvedById: req.user.id, resolvedAt: new Date() },
    });
    res.json({ message: 'Report dismissed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss report' });
  }
});

// ─── BADGES ───────────────────────────────────────────────────────────────────

router.post('/badges', ...sa, async (req, res) => {
  try {
    const { userId, type, note } = req.body;
    const VALID_TYPES = ['VERIFIED_MEMBER','ACTIVE_CONTRIBUTOR','ELDER_MENTOR','VERIFIED_PROFESSIONAL','TOP_TRADER','COMMUNITY_BUILDER'];
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid badge type.' });

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!target || target.status !== 'VERIFIED') return res.status(404).json({ error: 'User not found or not verified.' });

    const badge = await prisma.badge.upsert({
      where:  { userId_type: { userId, type } },
      update: { assignedBy: req.user.id, note: note || null, assignedAt: new Date() },
      create: { userId, type, assignedBy: req.user.id, note: note || null },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'ASSIGN_BADGE',
      targetUserId: userId, details: { type, note }, ipAddress: getClientIp(req),
    });

    res.status(201).json(badge);
  } catch (err) {
    console.error('[POST /admin/badges]', err);
    res.status(500).json({ error: 'Badge assignment failed' });
  }
});

router.delete('/badges/:id', ...sa, async (req, res) => {
  try {
    const badge = await prisma.badge.findUnique({ where: { id: req.params.id } });
    if (!badge) return res.status(404).json({ error: 'Badge not found.' });

    await prisma.badge.delete({ where: { id: badge.id } });

    await logAdminAction({
      adminId: req.user.id, action: 'REMOVE_BADGE',
      targetUserId: badge.userId, details: { type: badge.type }, ipAddress: getClientIp(req),
    });

    res.json({ message: 'Badge removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Badge removal failed' });
  }
});

// ─── PROFESSIONAL APPLICATIONS ────────────────────────────────────────────────

router.get('/professional-apps', ...mod, async (req, res) => {
  try {
    const { verified } = req.query;
    const where = {};
    if (verified === 'true')  where.isVerified = true;
    if (verified === 'false') where.isVerified = false;

    const apps = await prisma.professionalProfile.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      include: { user: { select: { id: true, fullName: true, telegramUsername: true, telegramPhotoUrl: true } } },
    });
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch professional applications' });
  }
});

router.put('/professional-apps/:id/verify', ...sa, async (req, res) => {
  try {
    const profile = await prisma.professionalProfile.findUnique({
      where: { id: req.params.id }, include: { user: { select: { id: true, fullName: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    await prisma.professionalProfile.update({
      where: { id: profile.id },
      data:  { isVerified: true, verifiedAt: new Date(), verifiedById: req.user.id },
    });

    // Assign VERIFIED_PROFESSIONAL badge
    await prisma.badge.upsert({
      where:  { userId_type: { userId: profile.userId, type: 'VERIFIED_PROFESSIONAL' } },
      update: { assignedBy: req.user.id, assignedAt: new Date() },
      create: { userId: profile.userId, type: 'VERIFIED_PROFESSIONAL', assignedBy: req.user.id },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'VERIFY_PROFESSIONAL',
      targetUserId: profile.userId, details: { field: profile.field }, ipAddress: getClientIp(req),
    });

    res.json({ message: 'Professional verified.' });
  } catch (err) {
    console.error('[PUT /admin/professional-apps/:id/verify]', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── DONATIONS ────────────────────────────────────────────────────────────────

router.get('/donations', ...sa, async (req, res) => {
  try {
    const { status, method, limit: lim, cursor } = req.query;
    const { limit } = parsePagination({ limit: lim }, 30);
    const where = {};
    if (status) where.status = status;
    if (method) where.method = method;

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.donation.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const donations = await prisma.donation.findMany({
      where: { ...where, ...cursorCondition },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        donor: { select: { id: true, fullName: true, telegramUsername: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(donations, limit);
    res.json({ donations: items, nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

router.put('/donations/:id/confirm', ...sa, async (req, res) => {
  try {
    const { notes } = req.body;
    const donation = await prisma.donation.findUnique({ where: { id: req.params.id } });
    if (!donation) return res.status(404).json({ error: 'Donation not found.' });

    await prisma.donation.update({
      where: { id: donation.id },
      data:  { status: 'completed', confirmedAt: new Date(), confirmedById: req.user.id, adminNotes: notes || null },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'CONFIRM_DONATION',
      details: { donationId: donation.id, amount: donation.amount, method: donation.method },
      ipAddress: getClientIp(req),
    });

    res.json({ message: 'Donation confirmed.' });
  } catch (err) {
    res.status(500).json({ error: 'Confirmation failed' });
  }
});

// GET /api/admin/donations/export — CSV export
router.get('/donations/export', ...sa, async (req, res) => {
  try {
    const donations = await prisma.donation.findMany({
      orderBy: { createdAt: 'desc' },
      include: { donor: { select: { fullName: true, telegramUsername: true } } },
    });

    const header = 'ID,Donor,Amount,Currency,Method,Status,Reference,Date\n';
    const rows   = donations.map((d) => [
      d.id,
      d.isAnonymous ? 'Anonymous' : (d.donor?.fullName || 'Unknown'),
      d.amount,
      d.currency,
      d.method,
      d.status,
      d.reference || '',
      new Date(d.createdAt).toISOString(),
    ].join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/admin/users/export — CSV export of all users
router.get('/users/export', ...sa, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { registeredAt: 'desc' },
      select: {
        id: true, fullName: true, baptismName: true, churchName: true,
        email: true, phoneNumber: true, telegramUsername: true,
        status: true, role: true, registeredAt: true, verifiedAt: true, postsCount: true,
      },
    });

    const header = 'ID,Full Name,Baptism Name,Church,Email,Phone,Telegram,Status,Role,Registered,Verified,Posts\n';
    const rows   = users.map((u) => [
      u.id, `"${u.fullName}"`, `"${u.baptismName}"`, `"${u.churchName}"`,
      u.email, u.phoneNumber, u.telegramUsername || '',
      u.status, u.role,
      new Date(u.registeredAt).toISOString(),
      u.verifiedAt ? new Date(u.verifiedAt).toISOString() : '',
      u.postsCount,
    ].join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
