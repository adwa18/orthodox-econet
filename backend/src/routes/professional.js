// backend/src/routes/professional.js
const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { imageUpload, uploadFiles, handleUploadError } = require('../middleware/upload');

router.post(
  '/apply',
  requireAuth, requireVerified,
  imageUpload.single('verificationDoc'),
  async (req, res) => {
    try {
      const { field, credentials, experienceYears, consultationFee, currency = 'ETB', availableHours } = req.body;
      if (!field?.trim() || !credentials?.trim() || !experienceYears)
        return res.status(400).json({ error: 'field, credentials, and experienceYears are required.' });

      let verificationDoc = null;
      if (req.file) {
        const [uploaded] = await uploadFiles([req.file], 'professional');
        verificationDoc = uploaded.url;
      }

      const profile = await prisma.professionalProfile.upsert({
        where:  { userId: req.user.id },
        update: { field: field.trim(), credentials: credentials.trim(), experienceYears: parseInt(experienceYears), verificationDoc, consultationFee: consultationFee ? parseFloat(consultationFee) : null, currency, availableHours: availableHours?.trim() || null, appliedAt: new Date() },
        create: { userId: req.user.id, field: field.trim(), credentials: credentials.trim(), experienceYears: parseInt(experienceYears), verificationDoc, consultationFee: consultationFee ? parseFloat(consultationFee) : null, currency, availableHours: availableHours?.trim() || null },
      });

      res.status(201).json({ message: 'Application submitted for review.', profile });
    } catch (err) {
      console.error('[POST /api/professional/apply]', err);
      res.status(500).json({ error: 'Application failed' });
    }
  },
  handleUploadError,
);

router.get('/directory', requireAuth, requireVerified, async (req, res) => {
  try {
    const { field, q } = req.query;
    const where = { isVerified: true };
    if (field) where.field = field;
    const profiles = await prisma.professionalProfile.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, telegramPhotoUrl: true, badges: true, trustScore: true } } },
      orderBy: { verifiedAt: 'desc' },
    });
    const filtered = q?.trim()
      ? profiles.filter((p) => p.field.toLowerCase().includes(q.toLowerCase()) || p.credentials.toLowerCase().includes(q.toLowerCase()))
      : profiles;
    res.json(filtered);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch directory' }); }
});

router.get('/me', requireAuth, requireVerified, async (req, res) => {
  try {
    const profile = await prisma.professionalProfile.findUnique({ where: { userId: req.user.id } });
    res.json(profile || null);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch profile' }); }
});

module.exports = router;
