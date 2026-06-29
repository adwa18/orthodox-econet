// backend/src/services/botService.js
// Centralised Telegram bot notification service.
// All messages the bot sends to users live here.
// The bot instance is passed in at startup (from server.js).

/** @type {import('node-telegram-bot-api')} */
let bot;

/**
 * Initialise the bot service with the bot instance.
 * Called once from server.js after the bot is created.
 * @param {import('node-telegram-bot-api')} botInstance
 */
function initBot(botInstance) {
  bot = botInstance;
}

/**
 * Send a message via the bot. Fire-and-forget with error logging.
 * @param {string|number} chatId  - Telegram chat ID (= user's telegramId)
 * @param {string}        text    - Message text (HTML parse mode)
 * @param {object}        [extra] - Extra options for sendMessage
 */
async function send(chatId, text, extra = {}) {
  if (!bot) {
    console.warn('[botService] Bot not initialised — skipping message to', chatId);
    return;
  }
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
  } catch (err) {
    // Common cause: user has blocked the bot — non-fatal
    console.error(`[botService] Failed to send to ${chatId}:`, err.message);
  }
}

// ─── Notification senders ─────────────────────────────────────────────────────

/**
 * Welcome message after admin verifies a new user.
 * @param {BigInt|string} telegramId
 * @param {string} firstName
 */
async function sendWelcome(telegramId, firstName) {
  const name = firstName || 'Member';
  await send(telegramId,
    `☦️ <b>እንኳን ደስ አለዎት, ${name}!</b>\n\n` +
    `የእርስዎ ምዝገባ ተቀብሎ ተረጋግጧል። አሁን ወደ <b>ኦርቶዶክስ ኢኮኖሚ ኔትወርክ</b> ለመግባት ዝግጁ ናቸው።\n\n` +
    `<b>You are now a verified member of Orthodox Econet!</b>\n` +
    `Tap the button below to open the community.`,
    {
      reply_markup: {
        inline_keyboard: [[{
          text: '☦️ Open Orthodox Econet',
          web_app: { url: process.env.APP_URL },
        }]],
      },
    }
  );
}

/**
 * Registration declined notification with reason and dispute instructions.
 * @param {BigInt|string} telegramId
 * @param {string} firstName
 * @param {string} reason  - Admin-written decline reason
 */
async function sendDeclined(telegramId, firstName, reason) {
  const name = firstName || 'Applicant';
  const supportUser = process.env.ADMIN_SUPPORT_USERNAME || 'OrthodoxEconetSupport';
  await send(telegramId,
    `☦️ <b>Dear ${name},</b>\n\n` +
    `ይቅርታ፣ የእርስዎ ምዝገባ አልተቀበለም።\n` +
    `<b>Your registration has not been approved.</b>\n\n` +
    `<b>Reason / ምክንያት:</b>\n${reason}\n\n` +
    `ይህን ውሳኔ ለመቃወም ወይም ለማጣራት፣ እባክዎ የድጋፍ ቡድናችንን ያናግሩ:\n` +
    `To dispute this decision, please contact our support team at @${supportUser}`
  );
}

/**
 * Admin warning message.
 * @param {BigInt|string} telegramId
 * @param {string} firstName
 * @param {string} warningMessage
 */
async function sendWarning(telegramId, firstName, warningMessage) {
  const name = firstName || 'Member';
  await send(telegramId,
    `⚠️ <b>Official Warning — ${name}</b>\n\n` +
    `<b>ማስጠንቀቂያ ከ Orthodox Econet አስተዳዳሪዎች:</b>\n` +
    `${warningMessage}\n\n` +
    `<i>Repeated violations may result in a ban. / ድጋሚ ጥሰቶች ሊያስከትሉ ይችላሉ።</i>`
  );
}

/**
 * Ban notification.
 * @param {BigInt|string} telegramId
 * @param {string} firstName
 * @param {string} reason
 * @param {boolean} isPermanent
 * @param {Date|null} expiresAt
 */
async function sendBanned(telegramId, firstName, reason, isPermanent, expiresAt) {
  const name = firstName || 'Member';
  const supportUser = process.env.ADMIN_SUPPORT_USERNAME || 'OrthodoxEconetSupport';

  let durationText;
  if (isPermanent) {
    durationText = '🔴 <b>Permanent ban / ቋሚ እገዳ</b>';
  } else {
    const expiryStr = expiresAt
      ? expiresAt.toLocaleString('am-ET', { timeZone: 'Africa/Addis_Ababa' })
      : 'Unknown';
    durationText = `⏱ <b>Temporary ban expires / ጊዜያዊ እገዳ ያበቃል:</b> ${expiryStr}`;
  }

  await send(telegramId,
    `🚫 <b>Account Banned — ${name}</b>\n\n` +
    `የእርስዎ Orthodox Econet መለያ ታግዷል።\n\n` +
    `<b>Reason / ምክንያት:</b>\n${reason}\n\n` +
    `${durationText}\n\n` +
    `For appeal, contact @${supportUser}`
  );
}

/**
 * Unban notification.
 * @param {BigInt|string} telegramId
 * @param {string} firstName
 */
async function sendUnbanned(telegramId, firstName) {
  const name = firstName || 'Member';
  await send(telegramId,
    `✅ <b>Account Restored — ${name}</b>\n\n` +
    `የእርስዎ Orthodox Econet መለያ ገደቡ ተነስቷል። ዳግም ወደ ማህበረሰቡ ለመመለስ ሙቀት ሞቅ ብሎ ይጠብቅዎታል።\n\n` +
    `<b>Your account has been unbanned.</b> Welcome back!`,
    {
      reply_markup: {
        inline_keyboard: [[{
          text: '☦️ Open Orthodox Econet',
          web_app: { url: process.env.APP_URL },
        }]],
      },
    }
  );
}

/**
 * Reply notification — someone replied to the user's post.
 * @param {BigInt|string} telegramId
 * @param {string} firstName
 * @param {string} replierName   - Display name of the person who replied
 * @param {string} sectionName   - Section where the reply happened
 * @param {string} postId        - ID of the replied-to post (for deep link)
 */
async function sendReplyNotification(telegramId, firstName, replierName, sectionName, postId) {
  await send(telegramId,
    `💬 <b>${replierName}</b> replied to your post in <b>${sectionName}</b>\n\n` +
    `<i>Open the app to read the reply.</i>`,
    {
      reply_markup: {
        inline_keyboard: [[{
          text: '📖 View Reply',
          web_app: { url: `${process.env.APP_URL}/section/${postId}` },
        }]],
      },
    }
  );
}

/**
 * General announcement notification.
 * @param {BigInt|string} telegramId
 * @param {string} title
 * @param {string} content  - First 200 chars of the announcement
 */
async function sendAnnouncementNotification(telegramId, title, content) {
  const preview = content.length > 200 ? content.slice(0, 197) + '…' : content;
  await send(telegramId,
    `📢 <b>New Announcement:</b> ${title}\n\n${preview}`,
    {
      reply_markup: {
        inline_keyboard: [[{
          text: '📖 Open App',
          web_app: { url: process.env.APP_URL },
        }]],
      },
    }
  );
}

/**
 * 2FA code for sensitive profile changes.
 * @param {BigInt|string} telegramId
 * @param {string} code  - 6-digit plain-text code (before hashing)
 */
async function send2FACode(telegramId, code) {
  await send(telegramId,
    `🔐 <b>Orthodox Econet — Verification Code</b>\n\n` +
    `Your 2FA code is:\n\n<code>${code}</code>\n\n` +
    `<i>Valid for 10 minutes. Do not share this code. / ከ10 ደቂቃ ውስጥ ያልፋል።</i>`
  );
}

/**
 * Account recovery code.
 * @param {BigInt|string} telegramId
 * @param {string} code
 */
async function sendRecoveryCode(telegramId, code) {
  await send(telegramId,
    `🔑 <b>Orthodox Econet — Account Recovery</b>\n\n` +
    `Your account recovery code is:\n\n<code>${code}</code>\n\n` +
    `<i>Valid for 30 minutes. / ከ30 ደቂቃ ውስጥ ያልፋል።</i>`
  );
}

/**
 * Notify owner/admin of a new registration.
 * @param {string|number} ownerChatId
 * @param {object} userData  - { fullName, baptismName, churchName, telegramUsername }
 */
async function notifyAdminNewRegistration(ownerChatId, userData) {
  await send(ownerChatId,
    `🆕 <b>New Registration Pending</b>\n\n` +
    `<b>Full Name:</b> ${userData.fullName}\n` +
    `<b>Baptism Name:</b> ${userData.baptismName}\n` +
    `<b>Church:</b> ${userData.churchName}\n` +
    `<b>Telegram:</b> @${userData.telegramUsername || 'N/A'}\n\n` +
    `<i>Review in Admin Panel → Verifications</i>`,
    {
      reply_markup: {
        inline_keyboard: [[{
          text: '🔍 Open Admin Panel',
          web_app: { url: `${process.env.APP_URL}/admin/verifications` },
        }]],
      },
    }
  );
}

/**
 * Endorsement received notification.
 * @param {BigInt|string} telegramId
 * @param {string} endorserName
 */
async function sendEndorsementNotification(telegramId, endorserName) {
  await send(telegramId,
    `🏅 <b>${endorserName}</b> has endorsed you on Orthodox Econet!\n\n` +
    `<i>View your profile to see the endorsement.</i>`
  );
}

module.exports = {
  initBot,
  send,
  sendWelcome,
  sendDeclined,
  sendWarning,
  sendBanned,
  sendUnbanned,
  sendReplyNotification,
  sendAnnouncementNotification,
  send2FACode,
  sendRecoveryCode,
  notifyAdminNewRegistration,
  sendEndorsementNotification,
};
