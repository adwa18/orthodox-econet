// backend/src/routes/liveqa.js
// Scheduled AMA sessions — questions, upvotes, admin answers.
const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { requireModerator, hasRole } = require('../middleware/rbac');
const { createNotification, parsePagination, buildCursorPage } = require('../utils/helpers');
const { emitQAQuestion, emitQAAnswer } = require('../services/socketService');

router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { status, limit: lim, cursor } = req.query;
    const { limit } = parsePagination({ limit: lim }, 20);
    const where = status ? { status } : {};
    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.liveQA.findUnique({ where: { id: cursor }, select: { scheduledAt: true } });
      if (c) cursorCondition = { scheduledAt: { lt: c.scheduledAt } };
    }
    const qas = await prisma.liveQA.findMany({
      where: { ...where, ...cursorCondition },
      orderBy: { scheduledAt: 'desc' }, take: limit + 1,
      include: { host: { select: { id: true, fullName: true, telegramPhotoUrl: true, badges: true } }, _count: { select: { questions: true } } },
    });
    const { items, nextCursor, hasMore } = buildCursorPage(qas, limit);
    res.json({ qas: items, nextCursor, hasMore });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch Q&A sessions' }); }
});

router.post('/', requireAuth, requireVerified, requireModerator, async (req, res) => {
  try {
    const { title, description, scheduledAt, durationMins = 60, field, sectionId } = req.body;
    if (!title?.trim() || !scheduledAt || !field?.trim()) return res.status(400).json({ error: 'title, scheduledAt, and field are required.' });
    const qa = await prisma.liveQA.create({
      data: { title: title.trim(), description: description?.trim() || null, hostId: req.user.id, scheduledAt: new Date(scheduledAt), durationMins: parseInt(durationMins), field: field.trim(), sectionId: sectionId || null, status: 'scheduled' },
      include: { host: { select: { id: true, fullName: true } } },
    });
    res.status(201).json(qa);
  } catch (err) { res.status(500).json({ error: 'Failed to create Q&A session' }); }
});

router.get('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const qa = await prisma.liveQA.findUnique({
      where: { id: req.params.id },
      include: { host: { select: { id: true, fullName: true, telegramPhotoUrl: true } },
        questions: { orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'asc' }], include: { asker: { select: { id: true, fullName: true, telegramPhotoUrl: true } } } } },
    });
    if (!qa) return res.status(404).json({ error: 'Session not found.' });
    await prisma.liveQA.update({ where: { id: qa.id }, data: { attendeeCount: { increment: 1 } } }).catch(() => {});
    res.json(qa);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch session' }); }
});

router.post('/:id/questions', requireAuth, requireVerified, async (req, res) => {
  try {
    const { text, isAnonymous = false } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Question text required.' });
    const qa = await prisma.liveQA.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!qa || qa.status === 'ended' || qa.status === 'cancelled') return res.status(400).json({ error: 'Session is not accepting questions.' });
    const question = await prisma.qAQuestion.create({
      data: { qaId: qa.id, askerId: req.user.id, text: text.trim(), isAnonymous: !!isAnonymous, upvotes: [] },
      include: { asker: { select: { id: true, fullName: true, telegramPhotoUrl: true } } },
    });
    emitQAQuestion(qa.id, isAnonymous ? { ...question, asker: null } : question);
    res.status(201).json(question);
  } catch (err) { res.status(500).json({ error: 'Failed to submit question' }); }
});

router.post('/:id/questions/:qid/upvote', requireAuth, requireVerified, async (req, res) => {
  try {
    const question = await prisma.qAQuestion.findUnique({ where: { id: req.params.qid } });
    if (!question) return res.status(404).json({ error: 'Question not found.' });
    const upvotes = Array.isArray(question.upvotes) ? question.upvotes : [];
    const already = upvotes.includes(req.user.id);
    const newUpvotes = already ? upvotes.filter((id) => id !== req.user.id) : [...upvotes, req.user.id];
    const updated = await prisma.qAQuestion.update({ where: { id: question.id }, data: { upvotes: newUpvotes, upvoteCount: newUpvotes.length } });
    res.json({ upvoteCount: updated.upvoteCount, upvoted: !already });
  } catch (err) { res.status(500).json({ error: 'Upvote failed' }); }
});

router.put('/:id/questions/:qid/answer', requireAuth, requireVerified, requireModerator, async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ error: 'Answer required.' });
    const updated = await prisma.qAQuestion.update({
      where: { id: req.params.qid },
      data:  { answer: answer.trim(), answered: true, answeredAt: new Date() },
    });
    emitQAAnswer(req.params.id, req.params.qid, answer.trim());
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Answer failed' }); }
});

router.put('/:id/status', requireAuth, requireVerified, requireModerator, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['live','ended','cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const updated = await prisma.liveQA.update({ where: { id: req.params.id }, data: { status } });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Status update failed' }); }
});

module.exports = router;
