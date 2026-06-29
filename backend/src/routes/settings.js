// backend/src/routes/settings.js
// Owner-only admin settings — key-value store for payment info, support handle, moderation config.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { requireSeniorAdmin, requireOwner } = require('../middleware/rbac');
const { logAdminAction, getClientIp } = require('../utils/helpers');
const { invalidateBannedWordsCache } = require('../middleware/automod');

// Read-only keys any senior admin can see; write requires Owner
const PUBLIC_SETTING_KEYS = [
  'support_username','telebirr_number','bank_name',
  'bank_account_name','bank_account_number','bank_branch',
];

// GET /api/settings — all settings grouped
router.get('/', requireAuth, requireVerified, requireSeniorAdmin, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
    const grouped  = settings.reduce((acc, s) => {
      (acc[s.group] = acc[s.group] || []).push(s);
      return acc;
    }, {});
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings/:key — update a single setting (Owner only)
router.put('/:key', requireAuth, requireVerified, requireOwner, async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined || value === null) return res.status(400).json({ error: 'Value is required.' });

    // Special validation for banned_words — must be a valid JSON array
    if (req.params.key === 'banned_words') {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) throw new Error();
      } catch {
        return res.status(400).json({ error: 'banned_words must be a JSON array of strings.' });
      }
      invalidateBannedWordsCache(); // Force reload on next post
    }

    const updated = await prisma.setting.upsert({
      where:  { key: req.params.key },
      update: { value: String(value), updatedBy: req.user.id },
      create: { key: req.params.key, value: String(value), updatedBy: req.user.id },
    });

    await logAdminAction({
      adminId: req.user.id, action: 'UPDATE_SETTING',
      details: { key: req.params.key }, ipAddress: getClientIp(req),
    });

    res.json(updated);
  } catch (err) {
    console.error('[PUT /api/settings/:key]', err);
    res.status(500).json({ error: 'Setting update failed' });
  }
});

module.exports = router;
