// backend/src/middleware/automod.js
// Content moderation for posts and announcements.
//
// URL rule:       HARD REJECT — return 400, user sees the error immediately.
// Banned words:   FLAG only — post is saved with status FLAGGED for moderator review.
// Spam patterns:  FLAG only — same as above.
//
// This keeps the UX friendly while routing bad content to the admin queue.

const { prisma } = require('../config/db');

/** Regex that catches http(s) links, www., and bare TLD patterns */
const URL_REGEX = /https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|me|app|co|biz|info|xyz|gov|edu|eth|online|site|shop)/gi;

/** Repeated character spam: 4+ of the same char in a row */
const SPAM_REPEAT_REGEX = /(.)\1{4,}/;

/**
 * Load the current banned words list from the Settings table.
 * Cached for 5 minutes to avoid hitting the DB on every post.
 */
let bannedWordsCache = [];
let cacheExpiresAt   = 0;

async function getBannedWords() {
  if (Date.now() < cacheExpiresAt) return bannedWordsCache;
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'banned_words' } });
    bannedWordsCache = setting ? JSON.parse(setting.value) : [];
    cacheExpiresAt   = Date.now() + 5 * 60 * 1000; // 5 min
  } catch {
    bannedWordsCache = [];
  }
  return bannedWordsCache;
}

/**
 * Invalidate the banned words cache (call after admin updates the list).
 */
function invalidateBannedWordsCache() {
  cacheExpiresAt = 0;
}

/**
 * Analyse text content and return an array of automod flags.
 * @param {string} text
 * @returns {Promise<Array<{type: string, match: string}>>}
 */
async function analyseContent(text) {
  if (!text || typeof text !== 'string') return [];

  const flags = [];
  const lower = text.toLowerCase();

  // 1. Hard-reject URLs (checked separately in middleware, but kept here for reuse)
  const urlMatches = text.match(URL_REGEX);
  if (urlMatches) {
    flags.push({ type: 'url', match: urlMatches[0] });
  }

  // 2. Banned words
  const bannedWords = await getBannedWords();
  for (const word of bannedWords) {
    if (word && lower.includes(word.toLowerCase())) {
      flags.push({ type: 'banned_word', match: word });
    }
  }

  // 3. Spam patterns
  if (SPAM_REPEAT_REGEX.test(text)) {
    const match = text.match(SPAM_REPEAT_REGEX);
    flags.push({ type: 'spam_repeat', match: match ? match[0] : '?' });
  }

  // 4. Excessively long message (use DB setting if available)
  if (text.length > 2000) {
    flags.push({ type: 'too_long', match: `${text.length} chars` });
  }

  return flags;
}

/**
 * Express middleware: block posts containing URLs (hard reject).
 * Attach automod flags to req.automodFlags for the route handler to save.
 *
 * Attach this to POST /api/posts and POST /api/broadcast.
 */
async function automodMiddleware(req, res, next) {
  const text = req.body?.content || req.body?.message || '';

  // Hard reject: URLs are never allowed in user content
  if (URL_REGEX.test(text)) {
    URL_REGEX.lastIndex = 0; // Reset stateful regex
    return res.status(400).json({
      error: 'external_links_not_allowed',
      message: 'ውጫዊ ሊንኮችን ማካተት አይፈቀድም። / External links are not allowed in posts.',
    });
  }
  URL_REGEX.lastIndex = 0;

  // Soft flags: banned words, spam — route handler saves them
  const flags = await analyseContent(text);
  req.automodFlags = flags.length > 0 ? flags : null;
  req.automodStatus = flags.length > 0 ? 'FLAGGED' : 'ACTIVE';

  next();
}

module.exports = {
  automodMiddleware,
  analyseContent,
  invalidateBannedWordsCache,
  URL_REGEX,
};
