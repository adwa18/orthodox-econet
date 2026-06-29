// frontend/src/pages/Bookings.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { bookingsAPI } from '../utils/api';

export default function Bookings() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn:  () => bookingsAPI.list({ role: 'both' }).then((r) => r.data),
  });

  const STATUS_COLOR = { pending: 'var(--tg-warning)', confirmed: 'var(--tg-button)', completed: 'var(--tg-success)', cancelled: 'var(--tg-hint)' };

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-base font-bold am" style={{ color: 'var(--tg-text)' }}>Bookings</h1>
      </div>
      <div className="px-4 pb-6 space-y-3">
        {isLoading && [1,2,3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        {!isLoading && !data?.length && (
          <div className="text-center py-16" style={{ color: 'var(--tg-hint)' }}>
            <Calendar size={40} className="mx-auto mb-2" strokeWidth={1.2} />
            <p className="text-sm am">{t('common.empty')}</p>
          </div>
        )}
        {(data || []).map((b) => (
          <div key={b.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold am" style={{ color: 'var(--tg-text)' }}>{b.serviceType}</p>
                <p className="text-xs am mt-0.5" style={{ color: 'var(--tg-hint)' }}>
                  {b.client?.fullName} → {b.professional?.fullName}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                    style={{ background: `${STATUS_COLOR[b.status]}18`, color: STATUS_COLOR[b.status] }}>
                {b.status}
              </span>
            </div>
            <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>🕐 {b.preferredTime}</p>
            {b.fee && <p className="text-xs mt-1" style={{ color: 'var(--tg-hint)' }}>Fee: {b.fee} {b.currency}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
