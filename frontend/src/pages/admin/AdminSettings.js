// frontend/src/pages/admin/AdminSettings.js
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Check, X } from 'lucide-react';
import { settingsAPI } from '../../utils/api';
import useAuthStore from '../../context/authStore';

function SettingRow({ setting, onSave, isOwner }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(setting.value);

  const handleSave = () => { onSave(setting.key, val); setEditing(false); };
  const handleCancel = () => { setVal(setting.value); setEditing(false); };

  return (
    <div className="card p-3 mb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium" style={{ color: 'var(--tg-hint)' }}>{setting.label || setting.key}</p>
          {!editing
            ? <p className="text-sm am mt-1 break-all" style={{ color: 'var(--tg-text)' }}>{setting.value}</p>
            : <textarea value={val} onChange={(e) => setVal(e.target.value)} className="input am mt-1 text-sm" rows={2} />
          }
        </div>
        {isOwner && (
          editing
            ? <div className="flex gap-1 ml-2 flex-shrink-0 pt-4">
                <button onClick={handleSave}   className="p-1.5 rounded-lg" style={{ background: '#1a7a4a18', color: 'var(--tg-success)' }}><Check size={14} /></button>
                <button onClick={handleCancel} className="p-1.5 rounded-lg" style={{ background: '#d9302518', color: 'var(--tg-danger)' }}><X size={14} /></button>
              </div>
            : <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg ml-2 flex-shrink-0" style={{ color: 'var(--tg-hint)' }}><Edit2 size={14} /></button>
        )}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const { user }  = useAuthStore();
  const qc        = useQueryClient();
  const isOwner   = user?.role === 'OWNER';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn:  () => settingsAPI.all().then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, value }) => settingsAPI.update(key, value),
    onSuccess:  () => qc.invalidateQueries(['admin-settings']),
  });

  if (isLoading) return <div className="page px-4 pt-6 space-y-2">{[1,2,3,4].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;

  const groups = data || {};

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-base font-bold" style={{ color: 'var(--tg-text)' }}>Settings</h1>
        {!isOwner && <p className="text-xs mt-1" style={{ color: 'var(--tg-hint)' }}>Read-only. Owner can edit.</p>}
      </div>
      <div className="px-4 pb-8">
        {Object.entries(groups).map(([group, settings]) => (
          <div key={group} className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 capitalize" style={{ color: 'var(--tg-hint)' }}>{group}</p>
            {settings.map((s) => (
              <SettingRow key={s.key} setting={s} isOwner={isOwner}
                          onSave={(key, value) => saveMutation.mutate({ key, value })} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
