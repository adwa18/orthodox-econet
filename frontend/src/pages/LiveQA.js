// frontend/src/pages/LiveQA.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Mic, ChevronRight, ThumbsUp } from 'lucide-react';
import { qaAPI } from '../utils/api';

export default function LiveQA() {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['qas'],
    queryFn:  () => qaAPI.list({}).then((r) => r.data),
  });

  const STATUS_COLOR = { scheduled: 'var(--tg-hint)', live: 'var(--tg-danger)', ended: 'var(--tg-success)' };
  const STATUS_LABEL = { scheduled: '📅 Scheduled', live: '🔴 Live Now', ended: '✅ Ended' };

  const qas = data?.qas || [];

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-base font-bold" style={{ color: 'var(--tg-text)' }}>Live Q&A / AMA Sessions</h1>
      </div>
      <div className="px-4 pb-6 space-y-3">
        {isLoading && [1,2].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        {!isLoading && !qas.length && (
          <div className="text-center py-16" style={{ color: 'var(--tg-hint)' }}>
            <Mic size={40} className="mx-auto mb-2" strokeWidth={1.2} />
            <p className="text-sm">No sessions scheduled</p>
          </div>
        )}
        {qas.map((qa) => (
          <button key={qa.id} onClick={() => navigate(`/liveqa/${qa.id}`)}
                  className="card p-4 w-full text-left active:opacity-70 transition-opacity">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium" style={{ color: STATUS_COLOR[qa.status] || 'var(--tg-hint)' }}>
                    {STATUS_LABEL[qa.status] || qa.status}
                  </span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--tg-text)' }}>{qa.title}</p>
                <p className="text-xs mt-0.5 am" style={{ color: 'var(--tg-hint)' }}>
                  Host: {qa.host?.fullName} · {qa.field}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--tg-hint)' }}>
                  {new Date(qa.scheduledAt).toLocaleString()} · {qa.durationMins} min
                </p>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--tg-hint)' }} />
            </div>
            <div className="flex items-center gap-3 mt-2 pt-2 border-t" style={{ borderColor: 'var(--tg-border)' }}>
              <span className="text-xs" style={{ color: 'var(--tg-hint)' }}>{qa._count?.questions || 0} questions</span>
              <span className="text-xs" style={{ color: 'var(--tg-hint)' }}>{qa.attendeeCount} attending</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
