// frontend/src/pages/admin/AdminReports.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle } from 'lucide-react';
import { adminAPI } from '../../utils/api';

export default function AdminReports() {
  const { t } = useTranslation();
  const qc    = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [resolving, setResolving] = useState(null);
  const [resolution, setResolution] = useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['admin-reports', filter],
    queryFn:  ({ pageParam }) => adminAPI.reports({ status: filter, cursor: pageParam, limit: 20 }).then((r) => r.data),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const refresh = () => qc.invalidateQueries(['admin-reports']);
  const resolveMutation = useMutation({ mutationFn: ({ id, resolution: res }) => adminAPI.resolveReport(id, res), onSuccess: () => { refresh(); setResolving(null); setResolution(''); } });
  const dismissMutation = useMutation({ mutationFn: (id) => adminAPI.dismissReport(id), onSuccess: refresh });

  const reports = (data?.pages || []).flatMap((p) => p.reports);
  const FILTERS = ['pending','under_review','resolved','dismissed'];

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-base font-bold mb-3" style={{ color: 'var(--tg-text)' }}>Reports</h1>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium capitalize"
                    style={{ background: filter === f ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: filter === f ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-6 space-y-3">
        {isLoading && [1,2,3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        {!isLoading && !reports.length && <div className="text-center py-12" style={{ color: 'var(--tg-hint)' }}><p className="text-sm">No {filter} reports</p></div>}
        {reports.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-full" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>{r.reason}</span>
                <p className="text-xs mt-1.5 am" style={{ color: 'var(--tg-hint)' }}>
                  By: {r.reporter?.fullName} · {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>{r.targetType}</span>
            </div>
            {r.targetPost && (
              <p className="text-xs am p-2 rounded-lg line-clamp-2 mb-2" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-text)' }}>
                "{r.targetPost.content}"
              </p>
            )}
            {r.targetUser && (
              <p className="text-xs am mb-2" style={{ color: 'var(--tg-hint)' }}>User: {r.targetUser.fullName}</p>
            )}
            {r.details && <p className="text-xs am mb-2" style={{ color: 'var(--tg-hint)' }}>Details: {r.details}</p>}
            {r.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => setResolving(r)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs" style={{ background: '#1a7a4a18', color: 'var(--tg-success)' }}>
                  <CheckCircle size={13} /> Resolve
                </button>
                <button onClick={() => dismissMutation.mutate(r.id)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>
                  <XCircle size={13} /> Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
        {hasNextPage && <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="w-full py-3 text-sm" style={{ color: 'var(--tg-hint)' }}>{isFetchingNextPage ? '...' : t('common.more')}</button>}
      </div>

      {resolving && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setResolving(null)}>
          <div className="w-full rounded-t-2xl p-5 space-y-3 shadow-xl animate-fade-in"
               style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }}
               onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold" style={{ color: 'var(--tg-text)' }}>Resolve Report</p>
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution note..." className="input" rows={3} />
            <div className="flex gap-2">
              <button onClick={() => setResolving(null)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button onClick={() => resolveMutation.mutate({ id: resolving.id, resolution })} disabled={!resolution.trim()} className="btn-primary flex-1 text-sm" style={{ opacity: !resolution.trim() ? 0.5 : 1 }}>Resolve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
