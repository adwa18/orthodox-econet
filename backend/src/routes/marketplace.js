// backend/src/routes/marketplace.js
// Structured product/service listings with search, offers, and admin moderation.

const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { requireModerator } = require('../middleware/rbac');
const { imageUpload, uploadFiles, handleUploadError } = require('../middleware/upload');
const { parsePagination, buildCursorPage, createNotification } = require('../utils/helpers');
const botService = require('../services/botService');

const VALID_CATEGORIES = ['products','services','real_estate','vehicles','electronics','food','books','clothing','other'];

// ─── GET /api/marketplace ─────────────────────────────────────────────────────

router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { category, q, minPrice, maxPrice, negotiable, limit: lim, cursor } = req.query;
    const { limit } = parsePagination({ limit: lim }, 20);

    const where = { status: 'active' };
    if (category && VALID_CATEGORIES.includes(category)) where.category = category;
    if (negotiable === 'true')  where.negotiable = true;
    if (negotiable === 'false') where.negotiable = false;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (q?.trim()) {
      where.OR = [
        { title:       { contains: q.trim(), mode: 'insensitive' } },
        { description: { contains: q.trim(), mode: 'insensitive' } },
        { tags:        { has: q.trim().toLowerCase() } },
      ];
    }

    let cursorCondition = {};
    if (cursor) {
      const c = await prisma.marketplaceListing.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (c) cursorCondition = { createdAt: { lt: c.createdAt } };
    }

    const listings = await prisma.marketplaceListing.findMany({
      where:   { ...where, ...cursorCondition },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      take:    limit + 1,
      include: {
        seller: { select: { id: true, fullName: true, telegramUsername: true, telegramPhotoUrl: true, badges: true } },
        _count: { select: { offers: true } },
      },
    });

    const { items, nextCursor, hasMore } = buildCursorPage(listings, limit);
    res.json({ listings: items, nextCursor, hasMore });
  } catch (err) {
    console.error('[GET /api/marketplace]', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// ─── GET /api/marketplace/:id ─────────────────────────────────────────────────

router.get('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where:   { id: req.params.id },
      include: {
        seller: { select: { id: true, fullName: true, telegramUsername: true, telegramPhotoUrl: true, badges: true, trustScore: true } },
        offers: {
          where:   { buyerId: req.user.id },
          orderBy: { createdAt: 'desc' }, take: 1,
        },
        _count: { select: { offers: true } },
      },
    });

    if (!listing || listing.status === 'archived') return res.status(404).json({ error: 'Listing not found.' });

    // Increment view count
    prisma.marketplaceListing.update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    res.json(listing);
  } catch (err) {
    console.error('[GET /api/marketplace/:id]', err);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// ─── POST /api/marketplace ────────────────────────────────────────────────────

router.post(
  '/',
  requireAuth, requireVerified,
  imageUpload.array('images', 5),
  async (req, res) => {
    try {
      const { title, description, category, subcategory, price, currency = 'ETB', negotiable, location, tags } = req.body;

      if (!title?.trim())       return res.status(400).json({ error: 'Title is required.' });
      if (!description?.trim()) return res.status(400).json({ error: 'Description is required.' });
      if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category.' });
      if (!price || isNaN(parseFloat(price))) return res.status(400).json({ error: 'Valid price is required.' });

      let images = [];
      if (req.files?.length) images = (await uploadFiles(req.files, 'marketplace')).map(({ url, publicId }) => ({ url, publicId }));

      const parsedTags = tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim().toLowerCase())) : [];

      const listing = await prisma.marketplaceListing.create({
        data: {
          sellerId:    req.user.id,
          title:       title.trim(),
          description: description.trim(),
          category,
          subcategory: subcategory?.trim() || null,
          price:       parseFloat(price),
          currency,
          negotiable:  negotiable !== 'false',
          location:    location?.trim() || null,
          images:      images.length ? images : undefined,
          tags:        parsedTags,
          status:      'active',
        },
        include: { seller: { select: { id: true, fullName: true } } },
      });

      res.status(201).json(listing);
    } catch (err) {
      console.error('[POST /api/marketplace]', err);
      res.status(500).json({ error: 'Failed to create listing' });
    }
  },
  handleUploadError,
);

// ─── PUT /api/marketplace/:id ─────────────────────────────────────────────────

router.put('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    if (listing.sellerId !== req.user.id) return res.status(403).json({ error: 'You can only edit your own listings.' });

    const { title, description, price, status, negotiable, location, tags } = req.body;
    const data = {};
    if (title)       data.title       = title.trim();
    if (description) data.description = description.trim();
    if (price)       data.price       = parseFloat(price);
    if (status && ['active','sold','reserved','archived'].includes(status)) data.status = status;
    if (negotiable !== undefined) data.negotiable = negotiable !== 'false';
    if (location)    data.location    = location.trim();
    if (tags)        data.tags        = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());

    const updated = await prisma.marketplaceListing.update({ where: { id: listing.id }, data });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// ─── POST /api/marketplace/:id/offer ─────────────────────────────────────────
// Buyer submits an offer. Seller gets a bot notification.

router.post('/:id/offer', requireAuth, requireVerified, async (req, res) => {
  try {
    const { amount, message } = req.body;
    if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ error: 'Valid offer amount required.' });

    const listing = await prisma.marketplaceListing.findUnique({
      where:   { id: req.params.id },
      include: { seller: { select: { id: true, telegramId: true, fullName: true, telegramFirstName: true } } },
    });
    if (!listing || listing.status !== 'active') return res.status(404).json({ error: 'Listing not available.' });
    if (listing.sellerId === req.user.id) return res.status(400).json({ error: 'Cannot make an offer on your own listing.' });

    const offer = await prisma.offer.create({
      data: {
        listingId: listing.id,
        buyerId:   req.user.id,
        amount:    parseFloat(amount),
        message:   message?.trim() || null,
        status:    'pending',
      },
    });

    // Notify seller in-app and via bot
    const io = req.app.get('io');
    await createNotification({
      recipientId: listing.sellerId,
      type:        'offer',
      title:       'New Offer Received',
      message:     `${req.user.fullName} made an offer of ${amount} ${listing.currency} on "${listing.title}"`,
      related:     { listingId: listing.id },
      actionUrl:   `/marketplace/${listing.id}`,
      io,
    });

    botService.send(
      listing.seller.telegramId,
      `🛒 <b>New Offer on "${listing.title}"</b>\n\n` +
      `<b>From:</b> ${req.user.fullName}\n` +
      `<b>Amount:</b> ${amount} ${listing.currency}\n` +
      `${message ? `<b>Message:</b> ${message}\n` : ''}` +
      `\nTo respond, open the app.`
    ).catch(console.error);

    res.status(201).json(offer);
  } catch (err) {
    console.error('[POST /api/marketplace/:id/offer]', err);
    res.status(500).json({ error: 'Offer failed' });
  }
});

// ─── PUT /api/marketplace/offers/:offerId ─────────────────────────────────────
// Seller accepts or rejects an offer.

router.put('/offers/:offerId', requireAuth, requireVerified, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be accepted or rejected.' });

    const offer = await prisma.offer.findUnique({
      where:   { id: req.params.offerId },
      include: { listing: { select: { sellerId: true, title: true } }, buyer: { select: { id: true, telegramId: true, telegramFirstName: true } } },
    });
    if (!offer) return res.status(404).json({ error: 'Offer not found.' });
    if (offer.listing.sellerId !== req.user.id) return res.status(403).json({ error: 'Only the seller can respond to offers.' });

    const updated = await prisma.offer.update({ where: { id: offer.id }, data: { status } });

    // Notify buyer
    const io = req.app.get('io');
    await createNotification({
      recipientId: offer.buyerId,
      type:        'offer',
      title:       status === 'accepted' ? 'Offer Accepted!' : 'Offer Declined',
      message:     `Your offer on "${offer.listing.title}" was ${status}.`,
      related:     { listingId: offer.listingId },
      io,
    });

    if (status === 'accepted') {
      botService.send(
        offer.buyer.telegramId,
        `✅ <b>Offer Accepted!</b>\n\nYour offer on <b>"${offer.listing.title}"</b> was accepted.\n` +
        `The seller will contact you to arrange the transaction.`
      ).catch(console.error);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Offer response failed' });
  }
});

module.exports = router;
