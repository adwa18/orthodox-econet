// backend/src/middleware/rateLimit.js
// Layered rate limiting using express-rate-limit.
// Applied at the route level for fine-grained control.

const rateLimit = require('express-rate-limit');

/**
 * Standard JSON response for rate limit hits.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function rateLimitHandler(req, res) {
  res.status(429).json({
    error:   'too_many_requests',
    message: 'Too many requests. Please wait and try again. / እባክዎ ትንሽ ቆይተው እንደገና ይሞክሩ።',
    retryAfter: Math.ceil(res.getHeader('Retry-After') || 60),
  });
}

/** General API: 100 requests per 15 minutes per IP */
const generalLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,
  max:               100,
  standardHeaders:   true,
  legacyHeaders:     false,
  handler:           rateLimitHandler,
  skip:              (req) => req.path === '/health',
});

/** Auth endpoints: 10 requests per hour per IP (prevents brute force) */
const authLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

/** Post creation: 10 posts per minute per IP */
const postLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

/** File upload: 20 uploads per 10 minutes per IP */
const uploadLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

/** Registration: 3 attempts per hour per IP */
const registrationLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             3,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         rateLimitHandler,
});

module.exports = {
  generalLimiter,
  authLimiter,
  postLimiter,
  uploadLimiter,
  registrationLimiter,
};
