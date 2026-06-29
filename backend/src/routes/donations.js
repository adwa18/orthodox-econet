// backend/src/routes/donations.js
// Donation submissions from users (Telebirr, bank transfer, cash).
// Admin confirmation is handled in admin.js.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { imageUpload, uploadFiles, handleUploadError } = require('../middleware/upload');

// ─── GET /api/donations/payment-info ─────────────────────────────────────────
// Return current payment info from Settings table (public to verified users).

router.get('/payment-info', requireAuth, requireVerified, async (req, res) => {
  try {
    const keys = ['telebirr_number','bank_name','bank_account_name','bank_account_number','bank_branch'];
    const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
    const info = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment info' });
  }
});

// ─── POST /api/donations ──────────────────────────────────────────────────────
// User submits a donation record after making the payment externally.

router.post(
  '/',
  requireAuth,
  requireVerified,
  imageUpload.single('screenshot'),
  async (req, res) => {
    try {
      const { amount, currency = 'ETB', method, reference, message, isAnonymous } = req.body;

      if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ error: 'Valid amount is required.' });
      if (!['telebirr', 'bank_transfer', 'cash'].includes(method)) {
        return res.status(400).json({ error: 'method must be telebirr, bank_transfer, or cash.' });
      }

      let screenshotUrl = null;
      if (req.file) {
        const [uploaded] = await uploadFiles([req.file], 'donation');
        screenshotUrl = uploaded.url;
      }

      const donation = await prisma.donation.create({
        data: {
          donorId:      isAnonymous === 'true' ? null : req.user.id,
          amount:       parseFloat(amount),
          currency,
          method,
          status:       'pending',
          reference:    reference?.trim() || null,
          screenshotUrl,
          message:      message?.trim() || null,
          isAnonymous:  isAnonymous === 'true',
        },
      });

      res.status(201).json({ message: 'Donation submitted. Admin will confirm receipt.', id: donation.id });
    } catch (err) {
      console.error('[POST /api/donations]', err);
      res.status(500).json({ error: 'Donation submission failed' });
    }
  },
  handleUploadError,
);

// ─── GET /api/donations/mine ──────────────────────────────────────────────────

router.get('/mine', requireAuth, requireVerified, async (req, res) => {
  try {
    const donations = await prisma.donation.findMany({
      where:   { donorId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your donations' });
  }
});

module.exports = router;
