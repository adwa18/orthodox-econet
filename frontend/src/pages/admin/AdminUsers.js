// frontend/src/pages/admin/AdminUsers.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, AlertTriangle, ShieldOff, ShieldCheck, ChevronDown } from 'lucide-react';
import { adminAPI } from '../../utils/api';
import useAuthStore from '../../context/authStore';

const BAN_DURATIONS = [
  { label: '1 Day',   hours: 24    },
  { label: '1 Week',  hours: 168   },
  { label: '1 Month', hours: 720   },
  { label: 'Permanent', hours: null, permanent: true },
];

function ActionModal({ type, target, onClose, onConfirm }) {
  const [reason, setReason]   = useState('');
  const [duration, setDuration] = useState(BAN_DURATIONS[0]);
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full rounded-t-2xl p-5 space-y-3 shadow-xl animate-fade-in"
           style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }}
           onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold" style={{ color: 'var(--tg-text)' }}>
          {type === 'warn' ? '⚠️ Warn' : type === 'ban' ? '🚫 Ban' : '✅ Unban'} — {target?.fullName}
        </h3>
        {type === 'ban' && (
          <div className="grid grid-cols-2 gap-2">
            {BAN_DURATIONS.map((d) => (
              <button key={d.label} onClick={() => setDuration(d)}
                      className="py-2 rounded-xl text-sm font-medium"
                      style={{ background: duration.label === d.label ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: duration.label === d.label ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
                {d.label}
              </button>
            ))}
          </div>
        )}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder={type === 'warn' ? 'Warning message...' : type === 'ban' ? 'Ban reason...' : 'Unban reason (optional)...'}
                  className="input" rows={3} required={type !== 'unban'} />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={() => onConfirm({ reason, duration })}
                  disabled={type !== 'unban' && !reason.trim()}
                  className={type === 'warn' ? 'btn-primary flex-1 text-sm' : type === 'ban' ? 'btn-danger flex-1 text-sm' : 'btn-primary flex-1 text-sm'}
                  style={{ opacity: type !== 'unban' && !reason.trim() ? 0.5 : 1 }}>
            {type === 'warn' ? 'Send Warning' : type === 'ban' ? 'Ban User' : 'Unban User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserCard({ user: u, onWarn, onBan, onUnban, isOwner }) {
  const [open, setOpen] = useState(false);
  const STATUS_COLOR = { VERIFIED:'var(--tg-success)', UNVERIFIED:'var(--tg-warning)', BANNED:'var(--tg-danger)', DECLINED:'var(--tg-hint)' };
  return (
    <div className="card mb-2">
      <button className="w-full p-3 text-left flex items-center gap-3" onClick={() => setOpen((v) => !v)}>
        {u.telegramPhotoUrl
          ? <img src={u.telegramPhotoUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
          : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                 style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-text)' }}>{u.fullName?.[0]}</div>
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold am" style={{ color: 'var(--tg-text)' }}>{u.fullName}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_COLOR[u.status]}18`, color: STATUS_COLOR[u.status] }}>{u.status}</span>
            {u.role !== 'USER' && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#d9302518', color: 'var(--tg-danger)' }}>{u.role}</span>}
          </div>
          <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>{u.telegramUsername ? `@${u.telegramUsername}` : u.email}</p>
        </div>
        <ChevronDown size={16} style={{ color: 'var(--tg-hint)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--tg-border)' }}>
          <div className="py-2 space-y-1 text-xs">
            {[['📞', u.phoneNumber],['✉️', u.email],['Posts', u.postsCount],['Trust', u.trustScore]].map(([k,v]) => (
              <div key={k} className="flex justify-between"><span style={{ color: 'var(--tg-hint)' }}>{k}</span><span className="am" style={{ color: 'var(--tg-text)' }}>{v}</span></div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => onWarn(u)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#b85c0018', color: 'var(--tg-warning)' }}><AlertTriangle size={12} /> Warn</button>
            {u.status !== 'BANNED' && <button onClick={() => onBan(u)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#d9302518', color: 'var(--tg-danger)' }}><ShieldOff size={12} /> Ban</button>}
            {u.status === 'BANNED' && <button onClick={() => onUnban(u)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#1a7a4a18', color: 'var(--tg-success)' }}><ShieldCheck size={12} /> Unban</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const { t }    = useTranslation();
  const { user } = useAuthStore();
  const qc       = useQueryClient();
  const [q, setQ]       = useState('');
  const [modal, setModal] = useState(null); // { type, target }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-users', q],
    queryFn:  () => adminAPI.users({ q: q || undefined, limit: 30 }).then((r) => r.data),
    staleTime: 30000,
  });

  const warnMutation  = useMutation({ mutationFn: ({ id, reason }) => adminAPI.warn(id, reason),                         onSuccess: () => { refetch(); setModal(null); } });
  const banMutation   = useMutation({ mutationFn: ({ id, reason, duration }) => adminAPI.ban(id, { reason, isPermanent: duration.permanent, durationHours: duration.hours }), onSuccess: () => { refetch(); setModal(null); } });
  const unbanMutation = useMutation({ mutationFn: ({ id, reason }) => adminAPI.unban(id, reason),                        onSuccess: () => { refetch(); setModal(null); } });

  const handleConfirm = ({ reason, duration }) => {
    const { type, target } = modal;
    if (type === 'warn')  warnMutation.mutate({ id: target.id, reason });
    if (type === 'ban')   banMutation.mutate({ id: target.id, reason, duration });
    if (type === 'unban') unbanMutation.mutate({ id: target.id, reason });
  };

  const users = data?.users || [];

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-base font-bold mb-3" style={{ color: 'var(--tg-text)' }}>Manage Users</h1>
        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: 'var(--tg-secondary-bg)' }}>
          <Search size={15} style={{ color: 'var(--tg-hint)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, username, phone..."
                 className="flex-1 bg-transparent py-2.5 text-sm outline-none" style={{ color: 'var(--tg-text)' }} />
        </div>
      </div>
      <div className="px-4 pb-6">
        {isLoading && [1,2,3].map((i) => <div key={i} className="skeleton h-16 rounded-xl mb-2" />)}
        {users.map((u) => (
          <UserCard key={u.id} user={u} isOwner={user?.role === 'OWNER'}
                    onWarn={(u) => setModal({ type: 'warn', target: u })}
                    onBan={(u)  => setModal({ type: 'ban',  target: u })}
                    onUnban={(u)=> setModal({ type: 'unban',target: u })} />
        ))}
        {!isLoading && !users.length && <div className="text-center py-12" style={{ color: 'var(--tg-hint)' }}><p className="text-sm">{q ? 'No results' : 'No users'}</p></div>}
      </div>
      {modal && <ActionModal type={modal.type} target={modal.target} onClose={() => setModal(null)} onConfirm={handleConfirm} />}
    </div>
  );
}
