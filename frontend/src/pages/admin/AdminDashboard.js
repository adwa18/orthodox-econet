// frontend/src/pages/admin/AdminDashboard.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, FileText, Megaphone, BarChart2, Flag, Award, Heart, Settings, ShieldCheck } from 'lucide-react';
import { adminAPI } from '../../utils/api';
import useAuthStore from '../../context/authStore';

const TILES = [
  { path: '/admin/verifications', icon: ShieldCheck, label: 'Verifications', color: '#1a7a4a', badgeKey: 'pendingVerifications' },
  { path: '/admin/posts',         icon: FileText,    label: 'Moderate Posts', color: '#2678b6'   },
  { path: '/admin/users',         icon: Users,       label: 'Manage Users',   color: '#7B5EA7'   },
  { path: '/admin/broadcast',     icon: Megaphone,   label: 'Broadcast',      color: '#b85c00'   },
  { path: '/admin/reports',       icon: Flag,        label: 'Reports',        color: '#d93025', badgeKey: 'pendingReports' },
  { path: '/admin/professional-apps', icon: Award,  label: 'Professional Apps', color: '#b85c00' },
  { path: '/admin/donations',     icon: Heart,       label: 'Donations',      color: '#d93025'   },
  { path: '/admin/overview',      icon: BarChart2,   label: 'Statistics',     color: '#2678b6'   },
  { path: '/admin/settings',      icon: Settings,    label: 'Settings',       color: '#5a5a5a'   },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn:  () => adminAPI.overview().then((r) => r.data),
    staleTime: 60000,
  });

  const badges = {
    pendingVerifications: overview?.users?.totalUnverified,
    pendingReports:       overview?.moderation?.pendingReports,
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🛡️</span>
          <h1 className="text-lg font-bold" style={{ color: 'var(--tg-text)' }}>Admin Panel</h1>
        </div>
        <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>
          {user?.fullName} · {user?.role?.replace('_', ' ')}
        </p>
      </div>

      {/* Quick stats row */}
      {overview && (
        <div className="grid grid-cols-3 gap-2 px-4 mb-5">
          {[
            { label: 'Verified',  value: overview.users.totalVerified,   color: 'var(--tg-success)' },
            { label: 'Pending',   value: overview.users.totalUnverified, color: 'var(--tg-warning)' },
            { label: 'Banned',    value: overview.users.totalBanned,     color: 'var(--tg-danger)'  },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--tg-secondary-bg)' }}>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
              <p className="text-[10px] mt-0.5 am" style={{ color: 'var(--tg-hint)' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Nav tiles */}
      <div className="grid grid-cols-3 gap-3 px-4 pb-8">
        {TILES.map(({ path, icon: Icon, label, color, badgeKey }) => {
          const badgeCount = badgeKey ? badges[badgeKey] : 0;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="relative flex flex-col items-center gap-2 py-4 rounded-2xl active:opacity-70 transition-opacity"
              style={{ background: 'var(--tg-secondary-bg)' }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon size={22} style={{ color }} />
              </div>
              <span className="text-[11px] font-medium text-center leading-tight" style={{ color: 'var(--tg-text)' }}>
                {label}
              </span>
              {badgeCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                      style={{ background: 'var(--tg-danger)', color: '#fff' }}>
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
