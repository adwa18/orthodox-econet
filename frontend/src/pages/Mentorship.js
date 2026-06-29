// frontend/src/pages/Mentorship.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Star } from 'lucide-react';
import { mentorshipAPI } from '../utils/api';
import useAuthStore from '../context/authStore';

function MentorCard({ mentor, onRequest }) {
  const { user } = useAuthStore();
  const isSelf   = mentor.user?.id === user?.id;
  return (
    <div className="card p-4 mb-3">
      <div className="flex items-start gap-3">
        {mentor.user?.telegramPhotoUrl
          ? <img src={mentor.user.telegramPhotoUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
          : <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold"
                 style={{ background: 'var(--tg-button)', color: 'var(--tg-button-text)' }}>{mentor.user?.fullName?.[0]}</div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold am" style={{ color: 'var(--tg-text)' }}>{mentor.user?.fullName}</p>
          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--tg-button)' }}>{mentor.field}</p>
          {mentor.bio && <p className="text-xs am mt-1 line-clamp-2" style={{ color: 'var(--tg-hint)' }}>{mentor.bio}</p>}
          <div className="flex flex-wrap gap-1 mt-2">
            {mentor.skills?.slice(0,4).map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>{s}</span>
            ))}
          </div>
          {mentor.availability && (
            <p className="text-xs mt-1.5 am" style={{ color: 'var(--tg-hint)' }}>🕐 {mentor.availability}</p>
          )}
        </div>
      </div>
      {!isSelf && (
        <button onClick={() => onRequest(mentor)} className="btn-primary w-full mt-3 text-sm">
          <UserPlus size={14} /> Request Mentorship
        </button>
      )}
    </div>
  );
}

export default function Mentorship() {
  const { t }  = useTranslation();
  const { user } = useAuthStore();
  const qc     = useQueryClient();
  const [tab, setTab]     = useState('browse');
  const [selected, setSelected] = useState(null);
  const [reqMsg, setReqMsg]     = useState('');
  const [field, setField]       = useState('');

  const { data: mentors, isLoading } = useQuery({
    queryKey: ['mentors'],
    queryFn:  () => mentorshipAPI.mentors({}).then((r) => r.data),
    enabled:  tab === 'browse',
  });

  const { data: matches } = useQuery({
    queryKey: ['my-matches'],
    queryFn:  () => mentorshipAPI.myMatches('both').then((r) => r.data),
    enabled:  tab === 'matches',
  });

  const requestMutation = useMutation({
    mutationFn: (d) => mentorshipAPI.request(d),
    onSuccess:  () => { qc.invalidateQueries(['my-matches']); setSelected(null); setReqMsg(''); setTab('matches'); },
  });

  const TABS = [
    { id: 'browse', label: 'Find Mentor' },
    { id: 'matches', label: 'My Matches'  },
  ];

  return (
    <div className="page">
      <div className="flex px-4 pt-4 pb-3 gap-2">
        {TABS.map((tab_) => (
          <button key={tab_.id} onClick={() => setTab(tab_.id)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium"
                  style={{ background: tab === tab_.id ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: tab === tab_.id ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
            {tab_.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-6">
        {tab === 'browse' && (
          <>
            {isLoading && [1,2,3].map((i) => <div key={i} className="skeleton h-32 rounded-xl mb-3" />)}
            {(mentors?.mentors || []).map((m) => <MentorCard key={m.id} mentor={m} onRequest={setSelected} />)}
            {!isLoading && !mentors?.mentors?.length && (
              <div className="text-center py-16" style={{ color: 'var(--tg-hint)' }}>
                <Users size={40} className="mx-auto mb-2" strokeWidth={1.2} />
                <p className="text-sm am">ምንም አማካሪ የለም</p>
              </div>
            )}
          </>
        )}

        {tab === 'matches' && (
          <div className="space-y-3">
            {(matches || []).map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold am" style={{ color: 'var(--tg-text)' }}>
                    {m.mentorId === user?.id ? m.mentee?.fullName : m.mentor?.fullName}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: m.status === 'active' ? '#1a7a4a18' : 'var(--tg-secondary-bg)', color: m.status === 'active' ? 'var(--tg-success)' : 'var(--tg-hint)' }}>
                    {m.status}
                  </span>
                </div>
                <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>{m.field}</p>
              </div>
            ))}
            {!matches?.length && <div className="text-center py-16" style={{ color: 'var(--tg-hint)' }}><p className="text-sm am">ምንም ዝምድና የለም</p></div>}
          </div>
        )}
      </div>

      {/* Request modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelected(null)}>
          <div className="w-full card p-5 space-y-3 rounded-b-none" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold am" style={{ color: 'var(--tg-text)' }}>Request — {selected.user?.fullName}</p>
            <input value={field} onChange={(e) => setField(e.target.value)} placeholder="Field (e.g. Engineering)" className="input" />
            <textarea value={reqMsg} onChange={(e) => setReqMsg(e.target.value)}
                      placeholder="Request message (why you want this mentor...)" className="input" rows={3} />
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1 text-sm">{t('common.cancel')}</button>
              <button onClick={() => requestMutation.mutate({ mentorId: selected.userId || selected.user?.id, field, requestMessage: reqMsg, skills: [] })}
                      disabled={!reqMsg || !field || requestMutation.isPending}
                      className="btn-primary flex-1 text-sm">{t('common.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
