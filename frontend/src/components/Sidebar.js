// frontend/src/components/Sidebar.js
import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Shield, BarChart2, Gift, Users } from 'lucide-react';
import useAuthStore from '../context/authStore';
import { SECTIONS } from '../utils/sections';
import { setLanguage, SUPPORTED_LANGUAGES } from '../i18n';

export default function Sidebar({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();
  const navigate     = useNavigate();
  const location     = useLocation();
  const { user }     = useAuthStore();
  const sidebarRef   = useRef(null);

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (sidebarRef.current && !sidebarRef.current.contains(e.target)) onClose();
  };

  // Trap focus while open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else        document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const goTo = (path) => { navigate(path); onClose(); };
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isAdmin  = ['MODERATOR', 'SENIOR_ADMIN', 'OWNER'].includes(user?.role);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={handleBackdropClick} aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop" />

      {/* Panel */}
      <div
        ref={sidebarRef}
        className="relative z-10 flex flex-col w-72 max-w-[85vw] h-full animate-slide-in-left shadow-2xl"
        style={{ background: 'var(--tg-bg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'var(--tg-border)' }}>
          <div>
            <p className="font-semibold text-sm am" style={{ color: 'var(--tg-text)' }}>☦️ {t('app.name')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tg-hint)' }}>@{user?.telegramUsername || user?.fullName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-opacity active:opacity-60"
            style={{ color: 'var(--tg-hint)' }}
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable section list */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Community sections">
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--tg-hint)' }}>
            {t('sections.title')}
          </p>

          {SECTIONS.map((section) => {
            const path   = `/section/${section.id}`;
            const active = isActive(path);
            return (
              <button
                key={section.id}
                onClick={() => goTo(path)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{
                  background: active ? `${section.color}18` : 'transparent',
                  borderLeft: active ? `3px solid ${section.color}` : '3px solid transparent',
                }}
                aria-current={active ? 'page' : undefined}
              >
                <span className="text-lg flex-shrink-0" role="img" aria-hidden="true">{section.emoji}</span>
                <span
                  className="text-sm leading-tight am"
                  style={{ color: active ? section.color : 'var(--tg-text)' }}
                >
                  {i18n.language === 'am' ? section.amharic : section.english}
                </span>
              </button>
            );
          })}

          {/* Extra links */}
          <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--tg-border)' }}>
            {[
              { path: '/mentorship', icon: Users,    label: { am: 'አማካሪ ፈልግ',  en: 'Mentorship'  } },
              { path: '/polls',      icon: BarChart2, label: { am: 'ድምጽ',        en: 'Polls'       } },
              { path: '/donate',     icon: Gift,      label: { am: 'ድጋፍ',        en: 'Donations'   } },
            ].map(({ path, icon: Icon, label }) => (
              <button
                key={path}
                onClick={() => goTo(path)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{
                  background: isActive(path) ? 'var(--tg-secondary-bg)' : 'transparent',
                  color: 'var(--tg-text)',
                }}
              >
                <Icon size={18} style={{ color: 'var(--tg-hint)' }} />
                <span className="text-sm am">
                  {i18n.language === 'am' ? label.am : label.en}
                </span>
              </button>
            ))}
          </div>

          {/* Admin link */}
          {isAdmin && (
            <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--tg-border)' }}>
              <button
                onClick={() => goTo('/admin')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={{
                  background: isActive('/admin') ? '#d9302518' : 'transparent',
                  borderLeft: isActive('/admin') ? '3px solid var(--tg-danger)' : '3px solid transparent',
                  color: 'var(--tg-danger)',
                }}
              >
                <Shield size={18} />
                <span className="text-sm font-medium">{t('nav.admin')}</span>
              </button>
            </div>
          )}
        </nav>

        {/* Language switcher */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--tg-border)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--tg-hint)' }}>{t('profile.language')}</p>
          <div className="grid grid-cols-4 gap-1">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className="py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: i18n.language === lang.code ? 'var(--tg-button)' : 'var(--tg-secondary-bg)',
                  color: i18n.language === lang.code ? 'var(--tg-button-text)' : 'var(--tg-hint)',
                }}
              >
                {lang.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
