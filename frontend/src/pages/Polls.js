// frontend/src/pages/Polls.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart2, Plus, Lock } from 'lucide-react';
import { pollsAPI } from '../utils/api';
import useAuthStore from '../context/authStore';

function PollCard({ poll, onVote }) {
  const { t }    = useTranslation();
  const { user } = useAuthStore();
  const totalVotes = poll.options.reduce((s, o) => s + (o._count?.votes || o.voteCount || 0), 0);
  const hasVoted   = poll.myVoteOptionIds?.length > 0;
  const ended      = poll.status !== 'active' || (poll.endAt && new Date(poll.endAt) < new Date());

  return (
    <div className="card p-4 mb-3">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm font-semibold am" style={{ color: 'var(--tg-text)' }}>{poll.title}</p>
          {poll.description && <p className="text-xs am mt-0.5" style={{ color: 'var(--tg-hint)' }}>{poll.description}</p>}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {poll.isAnonymous && <Lock size={12} style={{ color: 'var(--tg-hint)' }} />}
          {ended && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>{t('polls.ended')}</span>}
        </div>
      </div>
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const count   = opt._count?.votes || opt.voteCount || 0;
          const pct     = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const selected = poll.myVoteOptionIds?.includes(opt.id);
          return (
            <button key={opt.id} onClick={() => !ended && !hasVoted && onVote(poll.id, [opt.id])}
                    disabled={ended || hasVoted}
                    className="w-full text-left relative overflow-hidden rounded-xl transition-all"
                    style={{ background: 'var(--tg-secondary-bg)', border: selected ? '1.5px solid var(--tg-button)' : '1.5px solid transparent' }}>
              {(hasVoted || ended) && (
                <div className="absolute inset-y-0 left-0 rounded-xl transition-all" style={{ width: `${pct}%`, background: selected ? 'var(--tg-button)' : 'var(--tg-border)', opacity: 0.3 }} />
              )}
              <div className="relative flex items-center justify-between px-3 py-2.5">
                <span className="text-sm am" style={{ color: selected ? 'var(--tg-button)' : 'var(--tg-text)' }}>{opt.text}</span>
                {(hasVoted || ended) && <span className="text-xs font-medium" style={{ color: 'var(--tg-hint)' }}>{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: 'var(--tg-border)' }}>
        <p className="text-xs" style={{ color: 'var(--tg-hint)' }}>{totalVotes} {t('polls.votes')}</p>
        <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>{poll.createdBy?.fullName}</p>
      </div>
    </div>
  );
}

export default function Polls() {
  const { t }    = useTranslation();
  const { user } = useAuthStore();
  const qc       = useQueryClient();
  const isAdmin  = ['MODERATOR','SENIOR_ADMIN','OWNER'].includes(user?.role);
  const [creating, setCreating] = useState(false);
  const [title, setTitle]       = useState('');
  const [opts, setOpts]         = useState(['', '']);

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ['polls'],
    queryFn:  ({ pageParam }) => pollsAPI.list({ cursor: pageParam, limit: 20 }).then((r) => r.data),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionIds }) => pollsAPI.vote(pollId, optionIds),
    onSuccess:  () => qc.invalidateQueries(['polls']),
  });

  const createMutation = useMutation({
    mutationFn: (d) => pollsAPI.create(d),
    onSuccess:  () => { qc.invalidateQueries(['polls']); setCreating(false); setTitle(''); setOpts(['','']); },
  });

  const polls = (data?.pages || []).flatMap((p) => p.polls);

  return (
    <div className="page">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-base font-bold am" style={{ color: 'var(--tg-text)' }}>{t('polls.title')}</h1>
        {isAdmin && (
          <button onClick={() => setCreating((v) => !v)} className="flex items-center gap-1 text-sm" style={{ color: 'var(--tg-button)' }}>
            <Plus size={16} /> {t('polls.create')}
          </button>
        )}
      </div>

      {creating && (
        <div className="mx-4 mb-4 card p-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="የድምጽ ርዕስ" className="input am" />
          {opts.map((o, i) => (
            <input key={i} value={o} onChange={(e) => setOpts((prev) => prev.map((v, j) => j === i ? e.target.value : v))}
                   placeholder={`ምርጫ ${i + 1}`} className="input am" />
          ))}
          <button onClick={() => setOpts((prev) => [...prev, ''])}
                  className="text-xs" style={{ color: 'var(--tg-hint)' }}>+ ምርጫ ጨምር</button>
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} className="btn-secondary flex-1 text-sm">{t('common.cancel')}</button>
            <button onClick={() => createMutation.mutate({ title, options: opts.filter(Boolean), scope: 'community' })}
                    disabled={!title || opts.filter(Boolean).length < 2 || createMutation.isPending}
                    className="btn-primary flex-1 text-sm">{t('common.save')}</button>
          </div>
        </div>
      )}

      <div className="px-4 pb-6">
        {isLoading && [1,2].map((i) => <div key={i} className="skeleton h-40 rounded-xl mb-3" />)}
        {!isLoading && polls.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--tg-hint)' }}>
            <BarChart2 size={40} className="mx-auto mb-2" strokeWidth={1.2} />
            <p className="text-sm am">{t('common.empty')}</p>
          </div>
        )}
        {polls.map((poll) => (
          <PollCard key={poll.id} poll={poll}
                    onVote={(pollId, optionIds) => voteMutation.mutate({ pollId, optionIds })} />
        ))}
      </div>
    </div>
  );
}
