// frontend/src/pages/Notifications.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, MessageSquare, Megaphone, AlertTriangle, ShieldOff, Star, ShoppingBag, Calendar } from 'lucide-react';
import { notificationsAPI } from '../utils/api';

const TYPE_ICON = {
  reply:         MessageSquare,
  announcement:  Megaphone,
  warning:       AlertTriangle,
  ban:           ShieldOff,
  unban:         Star,
  endorsement:   Star,
  offer:         ShoppingBag,
  booking:       Calendar,
};
const TYPE_COLOR = {
  reply: 'var(--tg-button)', announcement: 'var(--tg-button)',
  warning: 'var(--tg-warning)', ban: 'var(--tg-danger)', unban: 'var(--tg-success)',
  endorsement: '#7B5EA7', offer: 'var(--tg-button)', booking: 'var(--tg-success)',
};

function NotifItem({ notif, onRead }) {
  const navigate = useNavigate();
  const Icon     = TYPE_ICON[notif.type] || Bell;
  const color    = TYPE_COLOR[notif.type] || 'var(--tg-hint)';

  const handleClick = () => {
    if (!notif.isRead) onRead(notif.id);
    if (notif.actionUrl) navigate(notif.actionUrl);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors active:opacity-70 border-b"
      style={{
        borderColor: 'var(--tg-border)',
        background:  notif.isRead ? 'transparent' : `${color}0a`,
      }}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
           style={{ background: `${color}18` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium am leading-snug" style={{ color: 'var(--tg-text)' }}>{notif.title}</p>
          {!notif.isRead && (
            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: 'var(--tg-button)' }} />
          )}
        </div>
        <p className="text-xs am mt-0.5 line-clamp-2" style={{ color: 'var(--tg-hint)' }}>{notif.message}</p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--tg-hint)' }}>
          {new Date(notif.createdAt).toLocaleString()}
        </p>
      </div>
    </button>
  );
}

export default function Notifications() {
  const { t } = useTranslation();
  const qc    = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn:  ({ pageParam }) => notificationsAPI.list({ cursor: pageParam, limit: 30 }).then((r) => r.data),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const markRead = useMutation({
    mutationFn: (id) => notificationsAPI.markRead(id),
    onSuccess:  () => { qc.invalidateQueries(['notifications']); qc.invalidateQueries(['unread-count']); },
  });

  const markAll = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess:  () => { qc.invalidateQueries(['notifications']); qc.invalidateQueries(['unread-count']); },
  });

  const notifs = (data?.pages || []).flatMap((p) => p.notifications);
  const hasUnread = notifs.some((n) => !n.isRead);

  return (
    <div className="page">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-base font-bold am" style={{ color: 'var(--tg-text)' }}>{t('notifications.title')}</h1>
        {hasUnread && (
          <button onClick={() => markAll.mutate()}
                  className="flex items-center gap-1 text-xs" style={{ color: 'var(--tg-button)' }}>
            <CheckCheck size={14} /> {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="px-4 space-y-3">
          {[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      )}

      {!isLoading && notifs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--tg-hint)' }}>
          <Bell size={40} strokeWidth={1.2} />
          <p className="text-sm am">{t('notifications.empty')}</p>
        </div>
      )}

      {notifs.map((n) => (
        <NotifItem key={n.id} notif={n} onRead={(id) => markRead.mutate(id)} />
      ))}

      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                className="w-full py-4 text-sm" style={{ color: 'var(--tg-hint)' }}>
          {isFetchingNextPage ? '...' : t('common.more')}
        </button>
      )}
    </div>
  );
}
