// backend/src/config/telegram.js
// Telegram Mini App initData validation.
// Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// The initData string is URL-encoded and sent by the Telegram client.
// We verify it by:
//   1. Parsing the key=value pairs
//   2. Removing the "hash" key
//   3. Sorting the remaining pairs alphabetically
//   4. Joining with "\n"
//   5. Signing with HMAC-SHA256 using key = HMAC-SHA256("WebAppData", BOT_TOKEN)
//   6. Comparing to the provided hash

const crypto = require('crypto');

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Validate Telegram initData and extract the user object.
 *
 * @param {string} initData - Raw initData string from window.Telegram.WebApp.initData
 * @returns {{ valid: boolean, user: object|null, error: string|null }}
 */
function validateInitData(initData) {
  if (!initData) {
    return { valid: false, user: null, error: 'No initData provided' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false, user: null, error: 'Missing hash in initData' };
    }

    // Check auth_date freshness
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > MAX_AUTH_AGE_SECONDS) {
      return { valid: false, user: null, error: 'initData expired (older than 24h)' };
    }

    // Build the data-check string (all params except hash, sorted)
    params.delete('hash');
    const dataCheckArr = [];
    params.forEach((value, key) => {
      dataCheckArr.push(`${key}=${value}`);
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    // Derive the secret key: HMAC-SHA256(BOT_TOKEN, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    // Compute expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) {
      return { valid: false, user: null, error: 'Invalid hash — data tampered' };
    }

    // Parse the user JSON
    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : null;

    return { valid: true, user, error: null };

  } catch (err) {
    return { valid: false, user: null, error: `Validation error: ${err.message}` };
  }
}

/**
 * Normalize Telegram user data from initData into a flat object.
 * @param {object} tgUser - Parsed user object from initData
 */
function normalizeTelegramUser(tgUser) {
  return {
    telegramId:        BigInt(tgUser.id),
    telegramUsername:  tgUser.username   || null,
    telegramFirstName: tgUser.first_name || null,
    telegramLastName:  tgUser.last_name  || null,
    telegramPhotoUrl:  tgUser.photo_url  || null,
  };
}

module.exports = { validateInitData, normalizeTelegramUser };
