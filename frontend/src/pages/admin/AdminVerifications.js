// frontend/src/pages/admin/AdminVerifications.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, User } from 'lucide-react';
import { adminAPI } from '../../utils/api';

function DeclineModal({ user, onClose, onDecline }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full rounded-t-2xl p-5 space-y-3 shadow-xl animate-fade-in"
           style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }}
           onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold" style={{ color: 'var(--tg-text)' }}>Decline — {user.fullName}</h3>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for declining (sent to user via bot)..."
                  className="input" rows={3} />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={() => onDecline(reason)} disabled={!reason.trim()}
                  className="btn-danger flex-1 text-sm" style={{ opacity: !reason.trim() ? 0.5 : 1 }}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

function UserRow({ user, onVerify, onDecline }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card mb-3">
      <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setExpanded((v) => !v)}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
             style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-text)' }}>
          {user.fullName?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold am" style={{ color: 'var(--tg-text)' }}>{user.fullName}</p>
          <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>{user.baptismName} · {user.churchName}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--tg-hint)' }}>
            {new Date(user.registeredAt).toLocaleString()}
          </p>
        </div>
        {expanded ? <ChevronUp size={16} style={{ color: 'var(--tg-hint)' }} /> : <ChevronDown size={16} style={{ color: 'var(--tg-hint)' }} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--tg-border)' }}>
          <div className="pt-2 space-y-1 text-xs" style={{ color: 'var(--tg-hint)' }}>
            {[
              ['📞', user.phoneNumber],
              ['✉️', user.email],
              ['💬', user.telegramUsername ? `@${user.telegramUsername}` : 'No username'],
            ].map(([icon, val]) => (
              <div key={icon} className="flex items-center gap-2">
                <span>{icon}</span>
                <span className="am" style={{ color: 'var(--tg-text)' }}>{val}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => onVerify(user.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium"
                    style={{ background: '#1a7a4a18', color: 'var(--tg-success)' }}>
              <CheckCircle size={15} /> Verify
            </button>
            <button onClick={() => onDecline(user)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium"
                    style={{ background: '#d9302518', color: 'var(--tg-danger)' }}>
              <XCircle size={15} /> Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminVerifications() {
  const { t } = useTranslation();
  const qc    = useQueryClient();
  const [declining, setDeclining] = useState(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['admin-verifications'],
    queryFn:  ({ pageParam }) => adminAPI.verifications({ cursor: pageParam, limit: 20 }).then((r) => r.data),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const verifyMutation = useMutation({
    mutationFn: (id) => adminAPI.verify(id),
    onSuccess:  () => { qc.invalidateQueries(['admin-verifications']); qc.invalidateQueries(['admin-overview']); },
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }) => adminAPI.decline(id, reason),
    onSuccess:  () => { qc.invalidateQueries(['admin-verifications']); setDeclining(null); },
  });

  const users = (data?.pages || []).flatMap((p) => p.users);

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="text-base font-bold" style={{ color: 'var(--tg-text)' }}>Pending Verifications</h1>
        <span className="text-sm font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>
          {users.length}
        </span>
      </div>

      <div className="px-4 pb-6">
        {isLoading && [1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-xl mb-3" />)}
        {!isLoading && users.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--tg-hint)' }}>
            <CheckCircle size={40} className="mx-auto mb-2" strokeWidth={1.2} style={{ color: 'var(--tg-success)' }} />
            <p className="text-sm">No pending verifications</p>
          </div>
        )}
        {users.map((u) => (
          <UserRow key={u.id} user={u}
                   onVerify={(id) => verifyMutation.mutate(id)}
                   onDecline={(user) => setDeclining(user)} />
        ))}
        {hasNextPage && (
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                  className="w-full py-3 text-sm" style={{ color: 'var(--tg-hint)' }}>
            {isFetchingNextPage ? '...' : t('common.more')}
          </button>
        )}
      </div>

      {declining && (
        <DeclineModal
          user={declining}
          onClose={() => setDeclining(null)}
          onDecline={(reason) => declineMutation.mutate({ id: declining.id, reason })}
        />
      )}
    </div>
  );
}
