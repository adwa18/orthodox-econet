// frontend/src/pages/admin/AdminDonations.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { adminAPI } from '../../utils/api';

export default function AdminDonations() {
  const { t }  = useTranslation();
  const qc     = useQueryClient();
  const [confirming, setConfirming] = useState(null);
  const [notes, setNotes]           = useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['admin-donations'],
    queryFn:  ({ pageParam }) => adminAPI.donations({ cursor: pageParam, limit: 20 }).then((r) => r.data),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, notes: n }) => adminAPI.confirmDonation(id, n),
    onSuccess:  () => { qc.invalidateQueries(['admin-donations']); setConfirming(null); setNotes(''); },
  });

  const STATUS_COLOR = { pending: 'var(--tg-warning)', completed: 'var(--tg-success)', failed: 'var(--tg-danger)' };
  const donations = (data?.pages || []).flatMap((p) => p.donations);

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-base font-bold" style={{ color: 'var(--tg-text)' }}>Donations</h1>
      </div>
      <div className="px-4 pb-6 space-y-3">
        {isLoading && [1,2,3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        {!isLoading && !donations.length && <div className="text-center py-12" style={{ color: 'var(--tg-hint)' }}><p className="text-sm">No donations yet</p></div>}
        {donations.map((d) => (
          <div key={d.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-base font-bold" style={{ color: 'var(--tg-text)' }}>{parseFloat(d.amount).toLocaleString()} {d.currency}</p>
                <p className="text-xs capitalize mt-0.5 am" style={{ color: 'var(--tg-hint)' }}>
                  {d.isAnonymous ? 'Anonymous' : d.donor?.fullName} · {d.method.replace('_', ' ')}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: `${STATUS_COLOR[d.status]}18`, color: STATUS_COLOR[d.status] }}>
                {d.status}
              </span>
            </div>
            {d.reference && <p className="text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Ref: {d.reference}</p>}
            {d.message && <p className="text-xs am mb-2" style={{ color: 'var(--tg-hint)' }}>"{d.message}"</p>}
            {d.screenshotUrl && (
              <a href={d.screenshotUrl} target="_blank" rel="noreferrer"
                 className="flex items-center gap-1 text-xs mb-2" style={{ color: 'var(--tg-link)' }}>
                <ExternalLink size={12} /> View Screenshot
              </a>
            )}
            <p className="text-[10px] mb-2" style={{ color: 'var(--tg-hint)' }}>{new Date(d.createdAt).toLocaleString()}</p>
            {d.status === 'pending' && (
              <button onClick={() => setConfirming(d)} className="btn-primary w-full text-sm">
                <CheckCircle size={14} /> {t('admin.confirmDonation')}
              </button>
            )}
          </div>
        ))}
        {hasNextPage && <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="w-full py-3 text-sm" style={{ color: 'var(--tg-hint)' }}>{isFetchingNextPage ? '...' : t('common.more')}</button>}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setConfirming(null)}>
          <div className="w-full rounded-t-2xl p-5 space-y-3 shadow-xl animate-fade-in"
               style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }}
               onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold" style={{ color: 'var(--tg-text)' }}>Confirm — {parseFloat(confirming.amount).toLocaleString()} ETB</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Admin notes (optional)" className="input" rows={2} />
            <div className="flex gap-2">
              <button onClick={() => setConfirming(null)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button onClick={() => confirmMutation.mutate({ id: confirming.id, notes })} disabled={confirmMutation.isPending} className="btn-primary flex-1 text-sm">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
