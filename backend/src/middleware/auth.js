// backend/src/middleware/auth.js
// JWT authentication middleware.
// Attaches req.user (full Prisma User object) on success.
// Handles ban expiry checks on every authenticated request.

const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');

/**
 * Middleware: require a valid JWT.
 * Attach the full user record to req.user.
 * If the user has an active temporary ban that has expired, lift it.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch the full user record
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        bansReceived: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check for unverified/declined status
    if (user.status === 'UNVERIFIED' || user.status === 'DECLINED') {
      return res.status(403).json({
        error: 'Account not verified',
        status: user.status,
        declineReason: user.declineReason,
      });
    }

    // Handle ban
    if (user.status === 'BANNED') {
      const activeBan = user.bansReceived[0];

      // Check if temporary ban has expired
      if (activeBan && !activeBan.isPermanent && activeBan.expiresAt && activeBan.expiresAt <= new Date()) {
        // Lift the expired ban
        await prisma.$transaction([
          prisma.ban.update({
            where: { id: activeBan.id },
            data:  { isActive: false, unbannedAt: new Date(), unbanReason: 'Automatic expiry' },
          }),
          prisma.user.update({
            where: { id: user.id },
            data:  { status: 'VERIFIED' },
          }),
        ]);
        // Re-fetch user without ban
        req.user = await prisma.user.findUnique({ where: { id: user.id } });
        return next();
      }

      return res.status(403).json({
        error:       'Account banned',
        reason:      activeBan?.reason,
        isPermanent: activeBan?.isPermanent,
        expiresAt:   activeBan?.expiresAt,
      });
    }

    // Update lastActiveAt (fire and forget)
    prisma.user.update({
      where: { id: user.id },
      data:  { lastActiveAt: new Date() },
    }).catch(() => {});

    req.user = user;
    next();

  } catch (err) {
    console.error('[auth] Unexpected error:', err);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware: require the user to be fully verified (status === VERIFIED).
 * Must be used after requireAuth.
 */
function requireVerified(req, res, next) {
  if (!req.user || req.user.status !== 'VERIFIED') {
    return res.status(403).json({ error: 'Verified account required' });
  }
  next();
}

/**
 * Generate a signed JWT for a user.
 * @param {string} userId
 * @returns {string} JWT token
 */
function signToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { requireAuth, requireVerified, signToken };
