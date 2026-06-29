// frontend/src/pages/admin/AdminBroadcast.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pin, PinOff, Archive, Plus } from 'lucide-react';
import { broadcastAPI } from '../../utils/api';
import { SECTIONS } from '../../utils/sections';

function ComposeModal({ onClose, onSubmit }) {
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [type, setType]       = useState('general');
  const [sectionId, setSec]   = useState('');
  const [isPinned, setPinned] = useState(false);
  const [file, setFile]       = useState(null);

  const handleSubmit = () => {
    const fd = new FormData();
    fd.append('title', title);
    fd.append('content', content);
    fd.append('type', type);
    if (type === 'section') fd.append('sectionId', sectionId);
    fd.append('isPinned', isPinned);
    if (file) fd.append('attachments', file);
    onSubmit(fd);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl p-5 space-y-3 shadow-xl animate-fade-in"
           style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }}
           onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold" style={{ color: 'var(--tg-text)' }}>New Announcement</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className="input" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content *" className="input" rows={4} />
        <div className="flex gap-2">
          {['general','section'].map((t_) => (
            <button key={t_} onClick={() => setType(t_)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium capitalize"
                    style={{ background: type === t_ ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: type === t_ ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
              {t_}
            </button>
          ))}
        </div>
        {type === 'section' && (
          <select value={sectionId} onChange={(e) => setSec(e.target.value)} className="input">
            <option value="">Select section...</option>
            {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.english}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isPinned} onChange={(e) => setPinned(e.target.checked)} style={{ accentColor: 'var(--tg-button)' }} />
          <span className="text-sm" style={{ color: 'var(--tg-text)' }}>📌 Pin this announcement</span>
        </label>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Attachment (optional)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0])} className="text-sm" style={{ color: 'var(--tg-hint)' }} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim() || !content.trim() || (type === 'section' && !sectionId)}
                  className="btn-primary flex-1 text-sm" style={{ opacity: !title.trim() || !content.trim() ? 0.5 : 1 }}>
            Broadcast
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBroadcast() {
  const qc = useQueryClient();
  const [composing, setComposing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-broadcast'],
    queryFn:  () => broadcastAPI.list({ limit: 30 }).then((r) => r.data),
  });

  const createMutation  = useMutation({ mutationFn: (fd) => broadcastAPI.create(fd),       onSuccess: () => { qc.invalidateQueries(['admin-broadcast']); setComposing(false); } });
  const pinMutation     = useMutation({ mutationFn: ({ id, pin }) => broadcastAPI.pin(id, pin),      onSuccess: () => qc.invalidateQueries(['admin-broadcast']) });
  const archiveMutation = useMutation({ mutationFn: (id) => broadcastAPI.remove(id),       onSuccess: () => qc.invalidateQueries(['admin-broadcast']) });

  const announcements = data?.announcements || [];

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="text-base font-bold" style={{ color: 'var(--tg-text)' }}>Broadcast</h1>
        <button onClick={() => setComposing(true)} className="flex items-center gap-1 text-sm" style={{ color: 'var(--tg-button)' }}>
          <Plus size={16} /> New
        </button>
      </div>
      <div className="px-4 pb-6 space-y-3">
        {isLoading && [1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        {announcements.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-semibold am flex-1" style={{ color: 'var(--tg-text)' }}>{a.title}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: a.type === 'general' ? '#2678b618' : 'var(--tg-secondary-bg)', color: a.type === 'general' ? 'var(--tg-button)' : 'var(--tg-hint)' }}>
                {a.type}
              </span>
            </div>
            <p className="text-xs am line-clamp-2 mb-2" style={{ color: 'var(--tg-hint)' }}>{a.content}</p>
            <div className="flex gap-2">
              <button onClick={() => pinMutation.mutate({ id: a.id, pin: !a.isPinned })}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                      style={{ background: a.isPinned ? '#2678b618' : 'var(--tg-secondary-bg)', color: a.isPinned ? 'var(--tg-button)' : 'var(--tg-hint)' }}>
                {a.isPinned ? <PinOff size={11} /> : <Pin size={11} />} {a.isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button onClick={() => archiveMutation.mutate(a.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>
                <Archive size={11} /> Archive
              </button>
            </div>
          </div>
        ))}
        {!isLoading && !announcements.length && <div className="text-center py-12" style={{ color: 'var(--tg-hint)' }}><p className="text-sm">No announcements yet</p></div>}
      </div>
      {composing && <ComposeModal onClose={() => setComposing(false)} onSubmit={(fd) => createMutation.mutate(fd)} />}
    </div>
  );
}
