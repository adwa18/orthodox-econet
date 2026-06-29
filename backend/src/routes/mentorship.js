// backend/src/routes/mentorship.js
// Mentor directory, match requests, and match management.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { createNotification, parsePagination, buildCursorPage } = require('../utils/helpers');
const botService = require('../services/botService');

// ─── GET /api/mentorship/mentors ──────────────────────────────────────────────

router.get('/mentors', requireAuth, requireVerified, async (req, res) => {
  try {
    const { field, q, limit: lim, cursor } = req.query;
    const { limit } = parsePagination({ limit: lim }, 20);

    const where = { isAccepting: true };
    if (field) where.field = field;
    if (q?.trim()) {
      where.OR = [
        { field:  { contains: q.trim(), mode: 'insensitive' } },
        { bio:    { contains: q.trim(), mode: 'insensitive' } },
        { skills: { has: q.trim().toLowerCase() } },
      ];
    }

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.mentorProfile.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const mentors = await prisma.mentorProfile.findMany({
      where:   { ...where, ...cursorCondition },
      orderBy: { matchesCount: 'desc' },
      take:    limit + 1,
      include: {
        user: {
          select: { id: true, fullName: true, telegramPhotoUrl: true, trustScore: true, badges: true },
        },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(mentors, limit);
    res.json({ mentors: items, nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

// ─── POST /api/mentorship/register ───────────────────────────────────────────
// Register as a mentor (create or update MentorProfile).

router.post('/register', requireAuth, requireVerified, async (req, res) => {
  try {
    const { field, skills, bio, availability, isAccepting = true } = req.body;
    if (!field?.trim()) return res.status(400).json({ error: 'Field/sector is required.' });

    const parsedSkills = Array.isArray(skills) ? skills : (skills || '').split(',').map((s) => s.trim()).filter(Boolean);

    const profile = await prisma.mentorProfile.upsert({
      where:  { userId: req.user.id },
      update: { field: field.trim(), skills: parsedSkills, bio: bio?.trim() || null, availability: availability?.trim() || null, isAccepting },
      create: { userId: req.user.id, field: field.trim(), skills: parsedSkills, bio: bio?.trim() || null, availability: availability?.trim() || null, isAccepting },
    });

    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to register as mentor' });
  }
});

// ─── POST /api/mentorship/request ─────────────────────────────────────────────
// Mentee sends a mentorship request to a mentor.

router.post('/request', requireAuth, requireVerified, async (req, res) => {
  try {
    const { mentorId, field, skills, requestMessage, preferredSchedule, goals } = req.body;
    if (!mentorId)         return res.status(400).json({ error: 'mentorId is required.' });
    if (!field?.trim())    return res.status(400).json({ error: 'Field is required.' });
    if (!requestMessage?.trim()) return res.status(400).json({ error: 'Request message is required.' });
    if (mentorId === req.user.id) return res.status(400).json({ error: 'You cannot request yourself as mentor.' });

    const mentor = await prisma.user.findUnique({
      where:   { id: mentorId },
      include: { mentorProfile: true },
    });
    if (!mentor || !mentor.mentorProfile?.isAccepting) {
      return res.status(404).json({ error: 'Mentor not found or not accepting requests.' });
    }

    // Check for existing active/pending match
    const existing = await prisma.mentorshipMatch.findFirst({
      where: { mentorId, menteeId: req.user.id, status: { in: ['pending', 'active'] } },
    });
    if (existing) return res.status(409).json({ error: 'You already have an active or pending request with this mentor.' });

    const parsedSkills = Array.isArray(skills) ? skills : (skills || '').split(',').map((s) => s.trim()).filter(Boolean);
    const parsedGoals  = Array.isArray(goals) ? goals : [];

    const match = await prisma.mentorshipMatch.create({
      data: {
        mentorId,
        menteeId:         req.user.id,
        mentorProfileId:  mentor.mentorProfile.id,
        field:            field.trim(),
        skills:           parsedSkills,
        requestMessage:   requestMessage.trim(),
        preferredSchedule: preferredSchedule?.trim() || null,
        goals:            parsedGoals,
        status:           'pending',
      },
    });

    const io = req.app.get('io');
    await createNotification({
      recipientId: mentorId, type: 'mentorship',
      title: 'New Mentorship Request',
      message: `${req.user.fullName} has sent you a mentorship request in ${field}.`,
      related: { userId: req.user.id }, actionUrl: '/mentorship', io,
    });

    botService.send(mentor.telegramId,
      `🤝 <b>New Mentorship Request</b>\n\n` +
      `<b>From:</b> ${req.user.fullName}\n<b>Field:</b> ${field}\n\n${requestMessage}\n\nOpen the app to respond.`
    ).catch(console.error);

    res.status(201).json(match);
  } catch (err) {
    console.error('[POST /api/mentorship/request]', err);
    res.status(500).json({ error: 'Request failed' });
  }
});

// ─── PUT /api/mentorship/matches/:id ─────────────────────────────────────────
// Mentor accepts/rejects, or updates match status.

router.put('/matches/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const { status, nextMeetingAt, feedback, mentorRating, menteeRating } = req.body;
    const VALID = ['active', 'completed', 'cancelled'];
    if (!VALID.includes(status)) return res.status(400).json({ error: `Status must be: ${VALID.join(', ')}` });

    const match = await prisma.mentorshipMatch.findUnique({
      where:   { id: req.params.id },
      include: {
        mentor: { select: { telegramId: true } },
        mentee: { select: { id: true, telegramId: true, fullName: true } },
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found.' });

    const isMentor = match.mentorId === req.user.id;
    const isMentee = match.menteeId === req.user.id;
    if (!isMentor && !isMentee) return res.status(403).json({ error: 'Not authorised.' });

    // Only mentor can activate
    if (status === 'active' && !isMentor) return res.status(403).json({ error: 'Only the mentor can accept requests.' });

    const data = { status };
    if (nextMeetingAt) data.nextMeetingAt = new Date(nextMeetingAt);
    if (status === 'completed') {
      if (isMentor && menteeRating)   data.menteeRating = parseInt(menteeRating);
      if (isMentee && mentorRating)   data.mentorRating = parseInt(mentorRating);
      if (feedback?.trim())           data.feedback     = feedback.trim();
    }
    if (status === 'active') {
      await prisma.mentorProfile.update({
        where: { userId: match.mentorId },
        data:  { matchesCount: { increment: 1 } },
      });
    }

    const updated = await prisma.mentorshipMatch.update({ where: { id: match.id }, data });

    const io = req.app.get('io');
    if (status === 'active') {
      await createNotification({
        recipientId: match.menteeId, type: 'mentorship',
        title: 'Mentorship Accepted!',
        message: `Your mentorship request has been accepted. / ጥያቄዎ ተቀብሏል!`,
        io,
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// ─── GET /api/mentorship/matches ──────────────────────────────────────────────

router.get('/matches', requireAuth, requireVerified, async (req, res) => {
  try {
    const { role = 'both' } = req.query;
    const where = {};
    if (role === 'mentor') where.mentorId = req.user.id;
    else if (role === 'mentee') where.menteeId = req.user.id;
    else where.OR = [{ mentorId: req.user.id }, { menteeId: req.user.id }];

    const matches = await prisma.mentorshipMatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        mentor: { select: { id: true, fullName: true, telegramPhotoUrl: true } },
        mentee: { select: { id: true, fullName: true, telegramPhotoUrl: true } },
      },
    });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

module.exports = router;
