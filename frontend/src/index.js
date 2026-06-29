// frontend/src/index.js
// App entry point. Initialises Telegram WebApp SDK, applies theme,
// sets up QueryClient, and renders the root.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n';       // Must import before App to init translations
import './index.css';
import App from './App';

// ─── Telegram WebApp SDK init ──────────────────────────────────────────────
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();     // Signal readiness — hides the loading indicator
  tg.expand();    // Expand to full viewport
  tg.enableClosingConfirmation(); // Prevent accidental close
}

// ─── Apply Telegram theme as CSS variables ─────────────────────────────────
// These cascade throughout the app via Tailwind's `tg-*` color tokens.
function applyTelegramTheme() {
  const params = tg?.themeParams || {};
  const root   = document.documentElement;

  root.style.setProperty('--tg-bg',           params.bg_color           || '#ffffff');
  root.style.setProperty('--tg-secondary-bg', params.secondary_bg_color || '#f0f0f0');
  root.style.setProperty('--tg-text',         params.text_color         || '#222222');
  root.style.setProperty('--tg-hint',         params.hint_color         || '#999999');
  root.style.setProperty('--tg-link',         params.link_color         || '#2678b6');
  root.style.setProperty('--tg-button',       params.button_color       || '#2678b6');
  root.style.setProperty('--tg-button-text',  params.button_text_color  || '#ffffff');
  root.style.setProperty('--tg-accent',       params.button_color       || '#2678b6');

  // Derived variables (not in Telegram API — computed for UI consistency)
  const isDark = params.bg_color && params.bg_color < '#888888';
  root.style.setProperty('--tg-border',  isDark ? '#3a3a3a' : '#e0e0e0');
  root.style.setProperty('--tg-card',    params.secondary_bg_color || '#ffffff');
  root.style.setProperty('--tg-danger',  '#d93025');
  root.style.setProperty('--tg-success', '#1a7a4a');
  root.style.setProperty('--tg-warning', '#b85c00');
}

applyTelegramTheme();

// Re-apply if the user changes Telegram theme mid-session
if (tg) {
  tg.onEvent('themeChanged', applyTelegramTheme);
}

// ─── TanStack Query client ─────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          30 * 1000,    // 30 seconds
      cacheTime:          5 * 60 * 1000, // 5 minutes
      retry:              2,
      refetchOnWindowFocus: false,       // Telegram WebView focus events are unreliable
    },
  },
});

// ─── Render ────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
