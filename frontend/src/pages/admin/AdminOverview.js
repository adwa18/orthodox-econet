// frontend/src/pages/admin/AdminOverview.js
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { adminAPI } from '../../utils/api';
import { SECTIONS } from '../../utils/sections';

function StatCard({ label, value, color = 'var(--tg-text)', sub }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--tg-secondary-bg)' }}>
      <p className="text-2xl font-bold" style={{ color }}>{value ?? '—'}</p>
      <p className="text-xs am mt-0.5" style={{ color: 'var(--tg-hint)' }}>{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--tg-hint)' }}>{sub}</p>}
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-overview'],
    queryFn:  () => adminAPI.overview().then((r) => r.data),
    staleTime: 30000,
  });

  if (isLoading) return (
    <div className="page px-4 pt-6 space-y-3">
      {[1,2,3,4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
    </div>
  );

  return (
    <div className="page">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-base font-bold" style={{ color: 'var(--tg-text)' }}>Statistics Overview</h1>
        <button onClick={() => refetch()} disabled={isFetching} className="p-2 rounded-lg" style={{ color: 'var(--tg-hint)' }}>
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-4 pb-6 space-y-5">
        {/* User stats */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>Users</p>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Verified Members" value={data?.users?.totalVerified}     color="var(--tg-success)" />
            <StatCard label="Pending Review"   value={data?.users?.totalUnverified}   color="var(--tg-warning)" />
            <StatCard label="Banned"           value={data?.users?.totalBanned}       color="var(--tg-danger)"  />
            <StatCard label="Total Registered" value={data?.users?.totalRegistered}   />
          </div>
        </section>

        {/* Post activity */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>Post Activity</p>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Today"     value={data?.posts?.today}     color="var(--tg-button)" />
            <StatCard label="This Week" value={data?.posts?.thisWeek}  color="var(--tg-button)" />
            <StatCard label="This Month"value={data?.posts?.thisMonth} color="var(--tg-button)" />
          </div>
          <div className="mt-2">
            <StatCard label="Total Posts (all time)" value={data?.posts?.total} />
          </div>
        </section>

        {/* Moderation */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>Moderation</p>
          <StatCard label="Pending Reports" value={data?.moderation?.pendingReports} color="var(--tg-danger)" />
        </section>

        {/* Per-section post counts */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>Posts per Section</p>
          <div className="space-y-1.5">
            {(data?.sections || []).map(({ sectionId, postCount }) => {
              const sec = SECTIONS.find((s) => s.id === sectionId);
              const max = Math.max(...(data?.sections || []).map((s) => s.postCount), 1);
              return (
                <div key={sectionId} className="flex items-center gap-2">
                  <span className="text-sm w-6 text-center flex-shrink-0">{sec?.emoji}</span>
                  <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'var(--tg-secondary-bg)', height: '6px' }}>
                    <div className="h-full rounded-full" style={{ width: `${(postCount / max) * 100}%`, background: sec?.color || 'var(--tg-button)' }} />
                  </div>
                  <span className="text-xs w-10 text-right" style={{ color: 'var(--tg-hint)' }}>{postCount}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* CSV exports */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>Export</p>
          <div className="flex gap-2">
            {[
              { label: 'Users CSV', fn: adminAPI.exportUsers, filename: 'users.csv' },
              { label: 'Donations CSV', fn: adminAPI.exportDonations, filename: 'donations.csv' },
            ].map(({ label, fn, filename }) => (
              <button key={filename}
                      onClick={async () => {
                        const res = await fn();
                        const url = URL.createObjectURL(new Blob([res.data]));
                        const a   = document.createElement('a');
                        a.href = url; a.download = filename; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex-1 btn-secondary text-xs py-2">
                ⬇️ {label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
