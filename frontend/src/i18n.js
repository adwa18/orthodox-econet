// frontend/src/i18n.js
// Internationalisation: Amharic (default), English, Afaan Oromo, Tigrinya.
// Language is detected from:
//   1. User's saved preference (localStorage)
//   2. Telegram client language (window.Telegram.WebApp.initDataUnsafe?.user?.language_code)
//   3. Browser language
//   4. Falls back to Amharic

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import am from './locales/am.json';
import en from './locales/en.json';
import om from './locales/om.json';
import ti from './locales/ti.json';

/** Map Telegram language codes to our supported locales */
const TELEGRAM_LANG_MAP = {
  'am': 'am', 'en': 'en', 'en-US': 'en', 'en-GB': 'en',
  'om': 'om', 'ti': 'ti',
};

/** Detect language from Telegram WebApp */
function detectTelegramLang() {
  try {
    const tgLang = window?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (tgLang && TELEGRAM_LANG_MAP[tgLang]) return TELEGRAM_LANG_MAP[tgLang];
  } catch { /* ignore */ }
  return null;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      am: { translation: am },
      en: { translation: en },
      om: { translation: om },
      ti: { translation: ti },
    },
    lng:         detectTelegramLang() || localStorage.getItem('preferredLanguage') || 'am',
    fallbackLng: 'am',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'preferredLanguage',
    },
  });

/** Change language and persist */
export function setLanguage(lang) {
  i18n.changeLanguage(lang);
  localStorage.setItem('preferredLanguage', lang);
}

export const SUPPORTED_LANGUAGES = [
  { code: 'am', label: 'አማርኛ',    nativeName: 'Amharic'      },
  { code: 'en', label: 'English',   nativeName: 'English'      },
  { code: 'om', label: 'Oromiffaa', nativeName: 'Afaan Oromo'  },
  { code: 'ti', label: 'ትግርኛ',     nativeName: 'Tigrinya'     },
];

export default i18n;
