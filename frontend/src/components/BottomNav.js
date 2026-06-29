// frontend/src/components/BottomNav.js
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Rss, ShoppingBag, Bell, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { notificationsAPI } from '../utils/api';

const TABS = [
  { path: '/',             icon: Home,        labelKey: 'nav.home'          },
  { path: '/feed',         icon: Rss,         labelKey: 'nav.feed'          },
  { path: '/marketplace',  icon: ShoppingBag, labelKey: 'nav.marketplace'   },
  { path: '/notifications',icon: Bell,        labelKey: 'nav.notifications', badge: true },
  { path: '/profile',      icon: User,        labelKey: 'nav.profile'       },
];

export default function BottomNav() {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { data } = useQuery({
    queryKey: ['unread-count'],
    queryFn:  () => notificationsAPI.unreadCount().then((r) => r.data),
    refetchInterval: 30000,
    staleTime: 20000,
  });
  const unread = data?.count || 0;

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav
      className="bottom-nav flex-shrink-0 flex items-center border-t"
      style={{ background: 'var(--tg-bg)', borderColor: 'var(--tg-border)' }}
      aria-label="Bottom navigation"
    >
      {TABS.map(({ path, icon: Icon, labelKey, badge }) => {
        const active  = isActive(path);
        const color   = active ? 'var(--tg-button)' : 'var(--tg-hint)';
        const showBadge = badge && unread > 0;

        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-opacity active:opacity-60 min-h-touch"
            style={{ color }}
            aria-label={t(labelKey)}
            aria-current={active ? 'page' : undefined}
          >
            <div className="relative">
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {showBadge && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: 'var(--tg-danger)', color: '#fff' }}
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-tight">{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
