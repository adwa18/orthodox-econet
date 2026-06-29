// frontend/src/context/authStore.js
// Zustand global store for authentication state.
// Token is persisted to localStorage; user is rehydrated from /api/users/me on startup.

import { create } from 'zustand';
import api, { authAPI, usersAPI } from '../utils/api';
import { connectSocket, disconnectSocket } from '../utils/socket';

const useAuthStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────
  user:        null,
  token:       null,
  status:      'idle',  // 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'banned' | 'unverified' | 'declined'
  banInfo:     null,    // { reason, isPermanent, expiresAt }
  isLoading:   true,    // true during initial rehydration

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Called on app mount. Restores session from localStorage if token exists.
   * Validates by calling GET /api/users/me.
   */
  async rehydrate() {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false, status: 'unauthenticated' });
      return;
    }

    set({ token, isLoading: true });

    try {
      const res = await usersAPI.me();
      const user = res.data;
      set({ user, token, status: 'authenticated', isLoading: false });
      connectSocket(user.id);
    } catch (err) {
      // Token invalid or expired
      localStorage.removeItem('token');
      set({ user: null, token: null, status: 'unauthenticated', isLoading: false });
    }
  },

  /**
   * Authenticate with Telegram initData. Called on every Mini App open.
   * @param {string} initData - window.Telegram.WebApp.initData
   */
  async login(initData) {
    set({ isLoading: true });
    try {
      const res = await authAPI.login(initData);
      const { status, token, user, reason, isPermanent, expiresAt } = res.data;

      if (status === 'VERIFIED' && token) {
        localStorage.setItem('token', token);
        set({ user, token, status: 'authenticated', isLoading: false, banInfo: null });
        connectSocket(user.id);
        return { status: 'authenticated' };
      }

      if (status === 'BANNED') {
        set({ status: 'banned', banInfo: { reason, isPermanent, expiresAt }, isLoading: false });
        return { status: 'banned' };
      }

      set({ status: status?.toLowerCase() || 'unauthenticated', isLoading: false });
      return { status: status?.toLowerCase() };

    } catch (err) {
      set({ status: 'unauthenticated', isLoading: false });
      return { status: 'error', error: err.message };
    }
  },

  /** Update user object after profile edits */
  setUser(user) {
    set({ user });
  },

  /** Logout — clear everything */
  logout() {
    localStorage.removeItem('token');
    disconnectSocket();
    set({ user: null, token: null, status: 'unauthenticated', banInfo: null, isLoading: false });
  },

  /** Convenience getters */
  get isAuthenticated() { return get().status === 'authenticated'; },
  get isAdmin()  { return ['MODERATOR','SENIOR_ADMIN','OWNER'].includes(get().user?.role); },
  get isOwner()  { return get().user?.role === 'OWNER'; },
}));

// Listen for token expiry events from Axios interceptor
window.addEventListener('auth:expired', () => {
  useAuthStore.getState().logout();
});

export default useAuthStore;
