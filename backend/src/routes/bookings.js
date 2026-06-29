// backend/src/routes/bookings.js
const router = require('express').Router();
const { prisma } = require('../config/db');
const { requireAuth, requireVerified } = require('../middleware/auth');
const { createNotification } = require('../utils/helpers');
const botService = require('../services/botService');

router.post('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { professionalId, serviceType, description, preferredTime } = req.body;
    if (!professionalId || !serviceType?.trim() || !preferredTime?.trim())
      return res.status(400).json({ error: 'professionalId, serviceType, and preferredTime are required.' });
    if (professionalId === req.user.id) return res.status(400).json({ error: 'Cannot book yourself.' });

    const pro = await prisma.user.findUnique({
      where: { id: professionalId },
      include: { professionalProfile: true },
    });
    if (!pro || !pro.professionalProfile?.isVerified)
      return res.status(404).json({ error: 'Verified professional not found.' });

    const booking = await prisma.booking.create({
      data: {
        clientId:       req.user.id,
        professionalId, profileId: pro.professionalProfile.id,
        serviceType:    serviceType.trim(),
        description:    description?.trim() || null,
        preferredTime:  preferredTime.trim(),
        status:         'pending',
        fee:            pro.professionalProfile.consultationFee || null,
        currency:       pro.professionalProfile.currency || 'ETB',
      },
    });

    const io = req.app.get('io');
    await createNotification({
      recipientId: professionalId, type: 'booking',
      title: 'New Consultation Request',
      message: `${req.user.fullName} requested a ${serviceType} consultation.`,
      related: { bookingId: booking.id }, actionUrl: '/bookings', io,
    });

    botService.send(pro.telegramId,
      `📅 <b>New Consultation Request</b>\n\n<b>From:</b> ${req.user.fullName}\n<b>Service:</b> ${serviceType}\n<b>Preferred Time:</b> ${preferredTime}\n\nOpen the app to confirm.`
    ).catch(console.error);

    res.status(201).json(booking);
  } catch (err) {
    console.error('[POST /api/bookings]', err);
    res.status(500).json({ error: 'Booking failed' });
  }
});

router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { role = 'both', status } = req.query;
    const where = {};
    if (status) where.status = status;
    if (role === 'client')       where.clientId       = req.user.id;
    else if (role === 'pro')     where.professionalId  = req.user.id;
    else where.OR = [{ clientId: req.user.id }, { professionalId: req.user.id }];

    const bookings = await prisma.booking.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: {
        client:       { select: { id: true, fullName: true, telegramPhotoUrl: true, telegramUsername: true } },
        professional: { select: { id: true, fullName: true, telegramPhotoUrl: true, telegramUsername: true } },
        profile:      { select: { field: true, consultationFee: true, availableHours: true } },
      },
    });
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch bookings' }); }
});

router.put('/:id/status', requireAuth, requireVerified, async (req, res) => {
  try {
    const { status, professionalNotes } = req.body;
    const VALID = ['confirmed', 'completed', 'cancelled'];
    if (!VALID.includes(status)) return res.status(400).json({ error: `Status must be: ${VALID.join(', ')}` });

    const booking = await prisma.booking.findUnique({
      where:   { id: req.params.id },
      include: { client: { select: { id: true, telegramId: true } }, professional: { select: { id: true } } },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const isPro    = booking.professionalId === req.user.id;
    const isClient = booking.clientId       === req.user.id;
    if (!isPro && !isClient) return res.status(403).json({ error: 'Not authorised.' });
    if (!isPro && ['confirmed', 'completed'].includes(status)) return res.status(403).json({ error: 'Only the professional can confirm or complete.' });

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data:  { status, professionalNotes: professionalNotes?.trim() || booking.professionalNotes },
    });

    const io = req.app.get('io');
    await createNotification({
      recipientId: booking.clientId, type: 'booking',
      title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your booking has been ${status}.`,
      related: { bookingId: booking.id }, io,
    });

    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Status update failed' }); }
});

module.exports = router;
