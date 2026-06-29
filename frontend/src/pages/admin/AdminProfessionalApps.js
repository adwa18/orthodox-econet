// frontend/src/pages/admin/AdminProfessionalApps.js
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, CheckCircle, ExternalLink } from 'lucide-react';
import { adminAPI } from '../../utils/api';

export default function AdminProfessionalApps() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('false');

  const { data, isLoading } = useQuery({
    queryKey: ['pro-apps', filter],
    queryFn:  () => adminAPI.proApps({ verified: filter }).then((r) => r.data),
  });

  const verifyMutation = useMutation({
    mutationFn: (id) => adminAPI.verifyPro(id),
    onSuccess:  () => qc.invalidateQueries(['pro-apps']),
  });

  const apps = data || [];

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-base font-bold mb-3" style={{ color: 'var(--tg-text)' }}>Professional Applications</h1>
        <div className="flex gap-2">
          {[['false','Pending'],['true','Verified']].map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium"
                    style={{ background: filter === v ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: filter === v ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-6 space-y-3">
        {isLoading && [1,2,3].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        {!isLoading && !apps.length && (
          <div className="text-center py-12" style={{ color: 'var(--tg-hint)' }}>
            <Award size={36} className="mx-auto mb-2" strokeWidth={1.2} />
            <p className="text-sm">No {filter === 'false' ? 'pending' : 'verified'} applications</p>
          </div>
        )}
        {apps.map((app) => (
          <div key={app.id} className="card p-4">
            <div className="flex items-start gap-3 mb-3">
              {app.user?.telegramPhotoUrl && <img src={app.user.telegramPhotoUrl} alt="" className="w-10 h-10 rounded-full" />}
              <div className="flex-1">
                <p className="text-sm font-semibold am" style={{ color: 'var(--tg-text)' }}>{app.user?.fullName}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--tg-button)' }}>{app.field}</p>
              </div>
              {app.isVerified && <CheckCircle size={18} style={{ color: 'var(--tg-success)' }} />}
            </div>
            <div className="space-y-1 text-xs mb-3">
              {[['Credentials', app.credentials], ['Experience', `${app.experienceYears} years`], ['Fee', app.consultationFee ? `${app.consultationFee} ETB` : '—'], ['Hours', app.availableHours || '—']].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span style={{ color: 'var(--tg-hint)' }}>{k}</span>
                  <span className="am text-right max-w-[60%]" style={{ color: 'var(--tg-text)' }}>{v}</span>
                </div>
              ))}
            </div>
            {app.verificationDoc && (
              <a href={app.verificationDoc} target="_blank" rel="noreferrer"
                 className="flex items-center gap-1 text-xs mb-3" style={{ color: 'var(--tg-link)' }}>
                <ExternalLink size={12} /> View Credential Document
              </a>
            )}
            {!app.isVerified && (
              <button onClick={() => verifyMutation.mutate(app.id)}
                      disabled={verifyMutation.isPending}
                      className="btn-primary w-full text-sm">
                {verifyMutation.isPending ? '...' : '✓ Verify Professional'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
