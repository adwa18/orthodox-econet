// backend/src/routes/posts.js
// Section chat posts — create, read, react, reply, report.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { automodMiddleware } = require('../middleware/automod');
const { postUpload, uploadFiles, handleUploadError } = require('../middleware/upload');
const { postLimiter, uploadLimiter } = require('../middleware/rateLimit');
const { createNotification, parsePagination, buildCursorPage } = require('../utils/helpers');
const { emitNewPost, emitNewReply } = require('../services/socketService');
const botService = require('../services/botService');

// Valid section IDs — matches frontend/src/utils/sections.js
const VALID_SECTIONS = new Set([
  'spiritual-life', 'business-directory', 'import-export',
  'education-training', 'logistics-supply', 'jobs-careers',
  'it-software', 'health-wellness', 'marketplace-b2c',
  'banking-finance', 'tenders-bids', 'engineering-architecture',
  'legal-property', 'trust-safety', 'business-development',
  'healthcare-community',
]);

// Reaction types allowed
const VALID_REACTIONS = new Set(['like', 'pray', 'agree', 'celebrate']);

// Post edit window: 15 minutes for regular users
const EDIT_WINDOW_MS = 15 * 60 * 1000;

// ─── GET /api/posts/:sectionId ────────────────────────────────────────────────
// Cursor-based paginated posts for a section (oldest first for chat UX).

router.get('/:sectionId', requireAuth, requireVerified, async (req, res) => {
  try {
    const { sectionId } = req.params;
    if (!VALID_SECTIONS.has(sectionId)) {
      return res.status(400).json({ error: 'Invalid section ID' });
    }

    const { limit, cursor } = parsePagination(req.query, 30);

    // Resolve cursor to a timestamp for stable pagination
    let cursorCondition = {};
    if (cursor) {
      const cursorPost = await prisma.post.findUnique({
        where:  { id: cursor },
        select: { createdAt: true },
      });
      if (cursorPost) {
        // Load posts older than cursor (scrolling up = loading history)
        cursorCondition = { createdAt: { lt: cursorPost.createdAt } };
      }
    }

    const posts = await prisma.post.findMany({
      where: {
        sectionId,
        status:    'ACTIVE',
        replyToId: null,          // Top-level posts only; replies fetched separately
        ...cursorCondition,
      },
      orderBy: { createdAt: 'desc' }, // Newest first from DB, client reverses
      take:    limit + 1,
      include: {
        author: {
          select: {
            id: true, fullName: true, telegramUsername: true,
            telegramPhotoUrl: true, role: true, badges: true,
          },
        },
        reactions: {
          select: { userId: true, type: true },
        },
        _count: { select: { replies: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(posts, limit);

    // Attach reaction summary grouped by type
    const enriched = items.map((post) => {
      const reactionMap = {};
      for (const r of post.reactions) {
        reactionMap[r.type] = (reactionMap[r.type] || 0) + 1;
      }
      const myReactions = post.reactions
        .filter((r) => r.userId === req.user.id)
        .map((r) => r.type);

      const { reactions: _r, ...rest } = post;
      return { ...rest, reactionCounts: reactionMap, myReactions };
    });

    res.json({ posts: enriched.reverse(), nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /api/posts/:sectionId]', err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// ─── POST /api/posts ──────────────────────────────────────────────────────────
// Create a post (or reply). Runs through automod before saving.

router.post(
  '/',
  requireAuth,
  requireVerified,
  postLimiter,
  postUpload.array('attachments', 5),
  automodMiddleware,
  async (req, res) => {
    try {
      const { sectionId, content, replyToId } = req.body;

      if (!VALID_SECTIONS.has(sectionId)) {
        return res.status(400).json({ error: 'Invalid section ID' });
      }
      if (!content?.trim() && (!req.files || req.files.length === 0)) {
        return res.status(400).json({ error: 'Post must have content or an attachment.' });
      }

      // Validate reply target exists
      if (replyToId) {
        const parent = await prisma.post.findUnique({
          where:  { id: replyToId },
          select: { id: true, sectionId: true, authorId: true, author: { select: { telegramId: true, fullName: true } } },
        });
        if (!parent || parent.status === 'DELETED') {
          return res.status(404).json({ error: 'Parent post not found.' });
        }
        if (parent.sectionId !== sectionId) {
          return res.status(400).json({ error: 'Reply must be in the same section as the parent post.' });
        }
      }

      // Upload attachments to Cloudinary
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = await uploadFiles(req.files, 'post');
      }

      const post = await prisma.post.create({
        data: {
          authorId:    req.user.id,
          sectionId,
          content:     content?.trim() || '',
          attachments: attachments.length > 0 ? attachments : undefined,
          replyToId:   replyToId || null,
          status:      req.automodStatus || 'ACTIVE',
          automodFlags: req.automodFlags || undefined,
        },
        include: {
          author: {
            select: {
              id: true, fullName: true, telegramUsername: true,
              telegramPhotoUrl: true, role: true, badges: true,
            },
          },
        },
      });

      // Increment user post count
      prisma.user.update({
        where: { id: req.user.id },
        data:  { postsCount: { increment: 1 } },
      }).catch(() => {});

      const io = req.app.get('io');

      // Real-time broadcast
      if (replyToId) {
        emitNewReply(sectionId, replyToId, { ...post, reactionCounts: {}, myReactions: [] });

        // Notify original post author (if not replying to yourself)
        const parent = await prisma.post.findUnique({
          where:  { id: replyToId },
          select: { authorId: true, author: { select: { telegramId: true } } },
        });
        if (parent && parent.authorId !== req.user.id) {
          const sectionLabel = sectionId.replace(/-/g, ' ');
          await createNotification({
            recipientId: parent.authorId,
            type:        'reply',
            title:       'New Reply',
            message:     `${req.user.fullName} replied to your post in ${sectionLabel}`,
            related:     { postId: post.id },
            actionUrl:   `/section/${sectionId}`,
            io,
          });
          botService.sendReplyNotification(
            parent.author.telegramId,
            req.user.fullName,
            req.user.fullName,
            sectionLabel,
            post.id,
          ).catch(console.error);
        }
      } else {
        emitNewPost(sectionId, { ...post, reactionCounts: {}, myReactions: [], _count: { replies: 0 } });
      }

      res.status(201).json({ ...post, reactionCounts: {}, myReactions: [] });
    } catch (err) {
      console.error('[POST /api/posts]', err);
      res.status(500).json({ error: 'Failed to create post' });
    }
  },
  handleUploadError,
);

// ─── PUT /api/posts/:id ───────────────────────────────────────────────────────
// Edit own post text (15-min window for users; unlimited for admin/moderator).

router.put('/:id', requireAuth, requireVerified, automodMiddleware, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where:   { id: req.params.id },
      include: { author: { select: { id: true } } },
    });

    if (!post || post.status === 'DELETED') {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const isAdmin = ['MODERATOR', 'SENIOR_ADMIN', 'OWNER'].includes(req.user.role);
    const isOwner = post.authorId === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You can only edit your own posts.' });
    }

    // Enforce edit window for regular users
    if (!isAdmin && isOwner) {
      const age = Date.now() - new Date(post.createdAt).getTime();
      if (age > EDIT_WINDOW_MS) {
        return res.status(403).json({ error: 'Posts can only be edited within 15 minutes of creation.' });
      }
    }

    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content cannot be empty.' });
    }

    const updated = await prisma.post.update({
      where: { id: post.id },
      data:  {
        content:     content.trim(),
        status:      req.automodStatus === 'FLAGGED' ? 'FLAGGED' : post.status,
        automodFlags: req.automodFlags || post.automodFlags,
        updatedAt:   new Date(),
      },
      include: { author: { select: { id: true, fullName: true, telegramPhotoUrl: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error('[PUT /api/posts/:id]', err);
    res.status(500).json({ error: 'Failed to edit post' });
  }
});

// ─── POST /api/posts/:id/react ────────────────────────────────────────────────
// Toggle a reaction. Adds if not present, removes if already reacted with same type.

router.post('/:id/react', requireAuth, requireVerified, async (req, res) => {
  try {
    const { type = 'like' } = req.body;
    if (!VALID_REACTIONS.has(type)) {
      return res.status(400).json({ error: `Invalid reaction type. Use: ${[...VALID_REACTIONS].join(', ')}` });
    }

    const post = await prisma.post.findUnique({
      where:  { id: req.params.id },
      select: { id: true, status: true, authorId: true },
    });
    if (!post || post.status === 'DELETED') {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const existing = await prisma.reaction.findUnique({
      where: { postId_userId_type: { postId: post.id, userId: req.user.id, type } },
    });

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.reaction.create({
        data: { postId: post.id, userId: req.user.id, type },
      });
    }

    // Return updated reaction counts
    const reactions = await prisma.reaction.findMany({
      where:  { postId: post.id },
      select: { userId: true, type: true },
    });

    const reactionCounts = {};
    for (const r of reactions) {
      reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
    }
    const myReactions = reactions
      .filter((r) => r.userId === req.user.id)
      .map((r) => r.type);

    res.json({ reactionCounts, myReactions, toggled: existing ? 'removed' : 'added', type });
  } catch (err) {
    console.error('[POST /api/posts/:id/react]', err);
    res.status(500).json({ error: 'Failed to react' });
  }
});

// ─── GET /api/posts/:id/replies ───────────────────────────────────────────────

router.get('/:id/replies', requireAuth, requireVerified, async (req, res) => {
  try {
    const { limit, cursor } = parsePagination(req.query, 20);

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.post.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { gt: c.createdAt } };
    }

    const replies = await prisma.post.findMany({
      where: {
        replyToId: req.params.id,
        status:    'ACTIVE',
        ...cursorCondition,
      },
      orderBy: { createdAt: 'asc' },
      take:    limit + 1,
      include: {
        author: {
          select: {
            id: true, fullName: true, telegramUsername: true,
            telegramPhotoUrl: true, role: true, badges: true,
          },
        },
        reactions: { select: { userId: true, type: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(replies, limit);

    const enriched = items.map((r) => {
      const reactionCounts = {};
      for (const rx of r.reactions) reactionCounts[rx.type] = (reactionCounts[rx.type] || 0) + 1;
      const myReactions = r.reactions.filter((rx) => rx.userId === req.user.id).map((rx) => rx.type);
      const { reactions: _r, ...rest } = r;
      return { ...rest, reactionCounts, myReactions };
    });

    res.json({ replies: enriched, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /api/posts/:id/replies]', err);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

// ─── POST /api/posts/:id/report ───────────────────────────────────────────────

const VALID_REASONS = ['spam', 'offensive', 'misinformation', 'inappropriate', 'other'];

router.post('/:id/report', requireAuth, requireVerified, async (req, res) => {
  try {
    const { reason, details } = req.body;

    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: `Reason must be one of: ${VALID_REASONS.join(', ')}` });
    }

    const post = await prisma.post.findUnique({
      where:  { id: req.params.id },
      select: { id: true, status: true, authorId: true },
    });
    if (!post || post.status === 'DELETED') {
      return res.status(404).json({ error: 'Post not found.' });
    }
    if (post.authorId === req.user.id) {
      return res.status(400).json({ error: 'You cannot report your own post.' });
    }

    // Prevent duplicate report from same user
    const existing = await prisma.report.findFirst({
      where: { reporterId: req.user.id, targetPostId: post.id, status: 'pending' },
    });
    if (existing) {
      return res.status(409).json({ error: 'You have already reported this post.' });
    }

    await prisma.report.create({
      data: {
        reporterId:  req.user.id,
        targetType:  'post',
        targetPostId: post.id,
        reason,
        details:     details?.trim() || null,
        status:      'pending',
      },
    });

    res.status(201).json({ message: 'Report submitted. Our moderation team will review it.' });
  } catch (err) {
    console.error('[POST /api/posts/:id/report]', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ─── POST /api/posts/:id/view ─────────────────────────────────────────────────
// Increment view count (fire-and-forget from client).

router.post('/:id/view', requireAuth, async (req, res) => {
  prisma.post.update({
    where: { id: req.params.id },
    data:  { viewCount: { increment: 1 } },
  }).catch(() => {});
  res.sendStatus(204);
});

module.exports = router;
