// backend/src/utils/helpers.js
// Shared utility functions used across multiple route files.

const { prisma } = require('../config/db');

// ─── User serialization ───────────────────────────────────────────────────────

/**
 * Strip sensitive fields from a user object before sending to client.
 * Converts BigInt telegramId to string (JSON.stringify can't handle BigInt).
 * @param {object} user - Prisma User record
 * @returns {object} Safe user object
 */
function sanitizeUser(user) {
  if (!user) return null;
  const {
    twoFactorCode, twoFactorExpiry,
    recoveryCode,  recoveryCodeExpiry,
    ...safe
  } = user;
  return {
    ...safe,
    telegramId: user.telegramId?.toString(),
  };
}

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * Create an in-app notification and emit it via Socket.io.
 * @param {object} params
 * @param {string}  params.recipientId
 * @param {string}  params.type           - notification type enum string
 * @param {string}  params.title
 * @param {string}  params.message
 * @param {object}  [params.related]      - { postId, userId, listingId, announcementId, qaId, pollId, bookingId }
 * @param {string}  [params.actionUrl]    - Frontend path for deep link
 * @param {import('socket.io').Server} [params.io] - Socket.io server instance
 * @returns {Promise<object>} Created notification record
 */
async function createNotification({
  recipientId, type, title, message,
  related = {}, actionUrl, io,
}) {
  const notification = await prisma.notification.create({
    data: {
      recipientId,
      type,
      title,
      message,
      relatedPostId:         related.postId         || null,
      relatedUserId:         related.userId         || null,
      relatedListingId:      related.listingId      || null,
      relatedAnnouncementId: related.announcementId || null,
      relatedQaId:           related.qaId           || null,
      relatedPollId:         related.pollId         || null,
      relatedBookingId:      related.bookingId      || null,
      actionUrl:             actionUrl              || null,
    },
  });

  // Real-time push via Socket.io (fire-and-forget)
  if (io) {
    io.to(`user:${recipientId}`).emit('notification', notification);
  }

  return notification;
}

// ─── Admin audit log ──────────────────────────────────────────────────────────

/**
 * Write an entry to the AdminAction audit log.
 * @param {object} params
 * @param {string}  params.adminId
 * @param {string}  params.action        - e.g. 'BAN_USER', 'DELETE_POST'
 * @param {string}  [params.targetUserId]
 * @param {string}  [params.targetPostId]
 * @param {string}  [params.targetAnnouncementId]
 * @param {object}  [params.details]     - Action-specific JSON payload
 * @param {string}  [params.ipAddress]
 */
async function logAdminAction({
  adminId, action,
  targetUserId, targetPostId, targetAnnouncementId,
  details, ipAddress,
}) {
  try {
    await prisma.adminAction.create({
      data: {
        adminId,
        action,
        targetUserId:         targetUserId         || null,
        targetPostId:         targetPostId         || null,
        targetAnnouncementId: targetAnnouncementId || null,
        details:              details              || null,
        ipAddress:            ipAddress            || null,
      },
    });
  } catch (err) {
    // Non-fatal — log but don't crash the request
    console.error('[logAdminAction] Failed:', err.message);
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────

/**
 * Parse cursor-based pagination params from query string.
 * @param {object} query - req.query
 * @param {number} [defaultLimit=20]
 * @returns {{ limit: number, cursor: string|null }}
 */
function parsePagination(query, defaultLimit = 20) {
  const limit  = Math.min(parseInt(query.limit  || defaultLimit, 10), 50);
  const cursor = query.cursor || null;
  return { limit, cursor };
}

/**
 * Build a cursor-based response object.
 * @param {Array}   items     - Items returned from DB (length = limit + 1)
 * @param {number}  limit     - Requested limit
 * @param {string}  cursorKey - Field to use as cursor (default: 'id')
 * @returns {{ items: Array, nextCursor: string|null, hasMore: boolean }}
 */
function buildCursorPage(items, limit, cursorKey = 'id') {
  const hasMore = items.length > limit;
  const page    = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? page[page.length - 1][cursorKey] : null;
  return { items: page, nextCursor, hasMore };
}

// ─── IP extraction ────────────────────────────────────────────────────────────

/**
 * Extract the real client IP, respecting Render's proxy.
 * @param {import('express').Request} req
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

module.exports = {
  sanitizeUser,
  createNotification,
  logAdminAction,
  parsePagination,
  buildCursorPage,
  getClientIp,
};
