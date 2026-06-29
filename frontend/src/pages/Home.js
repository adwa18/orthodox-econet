// frontend/src/pages/Home.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../context/authStore';
import { broadcastAPI } from '../utils/api';
import { SECTIONS } from '../utils/sections';
import AnnouncementCard from '../components/AnnouncementCard';

function SectionGrid() {
  const { i18n } = useTranslation();
  const navigate  = useNavigate();
  return (
    <div className="grid grid-cols-4 gap-2 px-4 pb-4">
      {SECTIONS.map((sec) => (
        <button
          key={sec.id}
          onClick={() => navigate(`/section/${sec.id}`)}
          className="flex flex-col items-center gap-1 py-3 rounded-xl active:opacity-70 transition-opacity"
          style={{ background: 'var(--tg-secondary-bg)' }}
        >
          <span className="text-2xl" role="img" aria-hidden="true">{sec.emoji}</span>
          <span className="text-[9px] leading-tight text-center am line-clamp-2 px-1"
                style={{ color: 'var(--tg-hint)' }}>
            {i18n.language === 'am' ? sec.amharic.split(' ')[0] : sec.english.split(' ')[0]}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Redirect to welcome screen on first login
  useEffect(() => {
    if (user && !user.dontShowWelcome) {
      const seen = localStorage.getItem('welcome_seen');
      if (!seen) {
        localStorage.setItem('welcome_seen', '1');
        navigate('/welcome', { replace: true });
      }
    }
  }, [user, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', 'general'],
    queryFn:  () => broadcastAPI.list({ type: 'general', limit: 10 }).then((r) => r.data),
    staleTime: 60000,
  });

  const announcements = data?.announcements || [];
  const pinned  = announcements.filter((a) => a.isPinned);
  const rest    = announcements.filter((a) => !a.isPinned);

  return (
    <div className="page">
      {/* Pinned announcements */}
      {(pinned.length > 0 || isLoading) && (
        <section className="px-4 pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5"
              style={{ color: 'var(--tg-hint)' }}>
            📌 {t('home.announcements')}
          </h2>
          {isLoading
            ? [1,2].map((i) => <div key={i} className="skeleton h-24 mb-3 rounded-xl" />)
            : pinned.map((a) => <AnnouncementCard key={a.id} announcement={a} />)
          }
        </section>
      )}

      {/* Community sections quick-access */}
      <section className="px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--tg-hint)' }}>
          {t('sections.title')}
        </h2>
      </section>
      <SectionGrid />

      {/* Remaining announcements */}
      {rest.length > 0 && (
        <section className="px-4 pb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--tg-hint)' }}>
            {t('home.announcements')}
          </h2>
          {rest.map((a) => <AnnouncementCard key={a.id} announcement={a} />)}
        </section>
      )}

      {!isLoading && announcements.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'var(--tg-hint)' }}>
          <span className="text-4xl">📋</span>
          <p className="text-sm am">{t('home.noAnnouncements')}</p>
        </div>
      )}
    </div>
  );
}
