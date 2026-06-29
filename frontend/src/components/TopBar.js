// frontend/src/components/TopBar.js
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, ArrowLeft, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../context/authStore';
import { notificationsAPI } from '../utils/api';
import { getSectionById } from '../utils/sections';

// Profile overlay shown when user taps their avatar
function ProfileOverlay({ user, onClose, onLogout }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div
        className="mx-4 mt-16 rounded-2xl shadow-xl p-4 animate-fade-in"
        style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Avatar + name */}
        <div className="flex items-center gap-3 mb-4">
          {user?.telegramPhotoUrl ? (
            <img src={user.telegramPhotoUrl} alt={user.fullName} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
                 style={{ background: 'var(--tg-button)', color: 'var(--tg-button-text)' }}>
              {user?.fullName?.[0] || '?'}
            </div>
          )}
          <div>
            <p className="font-semibold text-sm am" style={{ color: 'var(--tg-text)' }}>{user?.fullName}</p>
            <p className="text-xs" style={{ color: 'var(--tg-hint)' }}>@{user?.telegramUsername || '—'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tg-hint)' }}>{user?.baptismName} • {user?.churchName}</p>
          </div>
        </div>

        <div className="space-y-1 text-sm" style={{ color: 'var(--tg-text)' }}>
          <div className="flex justify-between py-1">
            <span style={{ color: 'var(--tg-hint)' }}>📞</span>
            <span>{user?.phoneNumber}</span>
          </div>
          <div className="flex justify-between py-1">
            <span style={{ color: 'var(--tg-hint)' }}>✉️</span>
            <span className="text-xs">{user?.email}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={() => { navigate('/profile'); onClose(); }}
                  className="flex-1 btn-secondary text-xs">
            {t('profile.editProfile')}
          </button>
          <button onClick={onLogout} className="flex-1 btn-danger text-xs">
            {t('auth.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TopBar({ onMenuOpen }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const location = useNavigate();
  const nav = useNavigate();
  const loc = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);

  // Unread notification count (refreshes every 30s)
  const { data: countData } = useQuery({
    queryKey: ['unread-count'],
    queryFn:  () => notificationsAPI.unreadCount().then((r) => r.data),
    refetchInterval: 30000,
  });
  const unread = countData?.count || 0;

  // Determine page title from pathname
  const getTitle = () => {
    const p = loc.pathname;
    if (p === '/')            return '☦️ ' + t('app.name');
    if (p === '/feed')        return t('nav.feed');
    if (p === '/marketplace') return t('marketplace.title');
    if (p === '/notifications') return t('notifications.title');
    if (p === '/profile')     return t('profile.title');
    if (p === '/mentorship')  return t('mentorship.title');
    if (p === '/polls')       return t('polls.title');
    if (p === '/donate')      return t('donations.title');
    if (p === '/liveqa')      return 'Live Q&A';
    if (p === '/bookings')    return t('bookings?.title') || 'Bookings';
    if (p.startsWith('/section/')) {
      const id = p.split('/section/')[1];
      const sec = getSectionById(id);
      if (sec) return `${sec.emoji} ${i18n.language === 'am' ? sec.amharic : sec.english}`;
    }
    if (p.startsWith('/admin')) return '🛡 ' + t('admin.title');
    return t('app.name');
  };

  const canGoBack = loc.pathname !== '/';

  return (
    <>
      <header
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'var(--tg-bg)', borderBottom: '1px solid var(--tg-border)', minHeight: '56px' }}
      >
        {/* Hamburger / back button */}
        {canGoBack ? (
          <button onClick={() => nav(-1)} className="p-1 rounded-lg active:opacity-60" aria-label={t('common.back')}>
            <ArrowLeft size={22} style={{ color: 'var(--tg-text)' }} />
          </button>
        ) : (
          <button onClick={onMenuOpen} className="p-1 rounded-lg active:opacity-60" aria-label="Open menu">
            <Menu size={22} style={{ color: 'var(--tg-text)' }} />
          </button>
        )}

        {/* Title */}
        <h1 className="flex-1 text-sm font-semibold am truncate" style={{ color: 'var(--tg-text)' }}>
          {getTitle()}
        </h1>

        {/* Notification bell */}
        <button
          onClick={() => nav('/notifications')}
          className="relative p-1 rounded-lg active:opacity-60"
          aria-label={t('notifications.title')}
        >
          <Bell size={22} style={{ color: 'var(--tg-text)' }} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: 'var(--tg-danger)', color: '#fff' }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {/* User avatar */}
        <button onClick={() => setProfileOpen(true)} className="flex-shrink-0 active:opacity-60" aria-label="Profile">
          {user?.telegramPhotoUrl ? (
            <img src={user.telegramPhotoUrl} alt={user.fullName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                 style={{ background: 'var(--tg-button)', color: 'var(--tg-button-text)' }}>
              {user?.fullName?.[0] || '?'}
            </div>
          )}
        </button>
      </header>

      {profileOpen && (
        <ProfileOverlay user={user} onClose={() => setProfileOpen(false)} onLogout={() => { logout(); setProfileOpen(false); }} />
      )}
    </>
  );
}
