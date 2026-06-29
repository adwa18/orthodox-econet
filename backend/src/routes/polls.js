// backend/src/routes/polls.js
const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { requireModerator, hasRole } = require('../middleware/rbac');
const { parsePagination, buildCursorPage, createNotification } = require('../utils/helpers');

// GET /api/polls
router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { scope, sectionId, status = 'active', limit: lim, cursor } = req.query;
    const { limit } = parsePagination({ limit: lim }, 20);
    const where = { status };
    if (scope)     where.scope     = scope;
    if (sectionId) where.sectionId = sectionId;

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.poll.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const polls = await prisma.poll.findMany({
      where:   { ...where, flagged: false, ...cursorCondition },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      include: {
        createdBy: { select: { id: true, fullName: true, telegramPhotoUrl: true, role: true } },
        options:   { orderBy: { orderIdx: 'asc' }, include: { _count: { select: { votes: true } } } },
        _count:    { select: { options: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(polls, limit);

    // Attach user's own vote (without exposing all voters for anonymous polls)
    const enriched = await Promise.all(items.map(async (poll) => {
      const myVotes = await prisma.pollVote.findMany({
        where: { pollId: poll.id, userId: req.user.id }, select: { optionId: true },
      });
      return { ...poll, myVoteOptionIds: myVotes.map((v) => v.optionId) };
    }));

    res.json({ polls: enriched, nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

// POST /api/polls
router.post('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { title, description, options, isAnonymous, allowMultiple, endAt, scope = 'community', sectionId } = req.body;
    if (!title?.trim())       return res.status(400).json({ error: 'Title required.' });
    if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'At least 2 options required.' });
    if (options.length > 10)  return res.status(400).json({ error: 'Maximum 10 options.' });

    // Only admins can create community-wide polls
    const isAdmin = hasRole(req.user, 'MODERATOR');
    if (scope === 'community' && !isAdmin) return res.status(403).json({ error: 'Only admins can create community polls.' });

    const poll = await prisma.poll.create({
      data: {
        title: title.trim(), description: description?.trim() || null,
        createdById: req.user.id, isAnonymous: !!isAnonymous,
        allowMultiple: !!allowMultiple, endAt: endAt ? new Date(endAt) : null,
        scope, sectionId: sectionId || null, status: 'active',
        options: {
          create: options.map((text, idx) => ({ text: text.toString().trim(), orderIdx: idx })),
        },
      },
      include: { options: { orderBy: { orderIdx: 'asc' } }, createdBy: { select: { id: true, fullName: true } } },
    });

    res.status(201).json(poll);
  } catch (err) {
    console.error('[POST /api/polls]', err);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// POST /api/polls/:id/vote
router.post('/:id/vote', requireAuth, requireVerified, async (req, res) => {
  try {
    const { optionIds } = req.body; // array of option IDs
    const ids = Array.isArray(optionIds) ? optionIds : [optionIds];
    if (!ids.length) return res.status(400).json({ error: 'Select at least one option.' });

    const poll = await prisma.poll.findUnique({
      where:   { id: req.params.id },
      include: { options: { select: { id: true } } },
    });
    if (!poll || poll.status !== 'active') return res.status(404).json({ error: 'Poll not found or closed.' });
    if (poll.endAt && poll.endAt < new Date()) return res.status(400).json({ error: 'Poll has ended.' });
    if (!poll.allowMultiple && ids.length > 1) return res.status(400).json({ error: 'This poll allows only one choice.' });

    const validOptionIds = new Set(poll.options.map((o) => o.id));
    if (!ids.every((id) => validOptionIds.has(id))) return res.status(400).json({ error: 'Invalid option ID(s).' });

    // Remove existing votes and recast (allows changing vote)
    await prisma.pollVote.deleteMany({ where: { pollId: poll.id, userId: req.user.id } });
    await prisma.$transaction([
      ...ids.map((optionId) =>
        prisma.pollVote.create({ data: { pollId: poll.id, optionId, userId: req.user.id } })
      ),
      ...ids.map((optionId) =>
        prisma.pollOption.update({ where: { id: optionId }, data: { voteCount: { increment: 1 } } })
      ),
    ]);

    // Return updated poll with vote counts
    const updated = await prisma.poll.findUnique({
      where:   { id: poll.id },
      include: { options: { orderBy: { orderIdx: 'asc' }, include: { _count: { select: { votes: true } } } } },
    });
    res.json({ poll: updated, myVoteOptionIds: ids });
  } catch (err) {
    console.error('[POST /api/polls/:id/vote]', err);
    res.status(500).json({ error: 'Vote failed' });
  }
});

// DELETE /api/polls/:id (admin or creator)
router.delete('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id } });
    if (!poll) return res.status(404).json({ error: 'Poll not found.' });
    if (poll.createdById !== req.user.id && !hasRole(req.user, 'MODERATOR')) {
      return res.status(403).json({ error: 'Not authorised.' });
    }
    await prisma.poll.update({ where: { id: poll.id }, data: { status: 'cancelled' } });
    res.json({ message: 'Poll cancelled.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel poll' });
  }
});

module.exports = router;
