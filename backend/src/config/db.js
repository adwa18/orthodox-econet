// backend/src/config/db.js
// Prisma Client singleton.
// Neon free tier auto-suspends after 5 min of idle — the pooled connection
// URL (pgbouncer=true) handles reconnects transparently.

const { PrismaClient } = require('@prisma/client');

/** @type {PrismaClient} */
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  // In development, reuse the client across hot-reloads to avoid
  // exhausting Neon's connection limit.
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.__prisma;
}

/**
 * Seed default Settings rows into the database on first boot.
 * Safe to call on every startup — uses upsert so it never overwrites
 * values the Owner has already changed via the admin UI.
 */
async function seedDefaultSettings() {
  const defaults = [
    { key: 'support_username',   value: process.env.ADMIN_SUPPORT_USERNAME || 'OrthodoxEconetSupport', label: 'Support Telegram Username', group: 'general' },
    { key: 'telebirr_number',    value: process.env.TELEBIRR_NUMBER || '0941234567',                   label: 'Telebirr Payment Number',   group: 'payment' },
    { key: 'bank_name',          value: process.env.BANK_NAME || 'Commercial Bank of Ethiopia',         label: 'Bank Name',                 group: 'payment' },
    { key: 'bank_account_name',  value: process.env.BANK_ACCOUNT_NAME || 'Orthodox Econet',             label: 'Bank Account Name',         group: 'payment' },
    { key: 'bank_account_number',value: process.env.BANK_ACCOUNT_NUMBER || '1000123456789',             label: 'Bank Account Number',       group: 'payment' },
    { key: 'bank_branch',        value: process.env.BANK_BRANCH || 'Addis Ababa, Meskel Square',        label: 'Bank Branch',               group: 'payment' },
    { key: 'banned_words',       value: JSON.stringify([]),                                              label: 'Banned Words (JSON array)', group: 'moderation' },
    { key: 'max_post_length',    value: '2000',                                                          label: 'Max Post Length (chars)',   group: 'moderation' },
  ];

  for (const setting of defaults) {
    await prisma.setting.upsert({
      where:  { key: setting.key },
      update: {},          // Never overwrite — admin changes are authoritative
      create: setting,
    });
  }
}

module.exports = { prisma, seedDefaultSettings };
