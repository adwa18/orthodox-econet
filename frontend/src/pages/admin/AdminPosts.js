// frontend/src/pages/admin/AdminPosts.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit2, MoveRight, RotateCcw, Flag } from 'lucide-react';
import { adminAPI } from '../../utils/api';
import { SECTIONS } from '../../utils/sections';

const STATUS_COLORS = { ACTIVE:'var(--tg-success)', FLAGGED:'var(--tg-warning)', DELETED:'var(--tg-hint)', UNDER_REVIEW:'var(--tg-warning)' };

function PostRow({ post, onDelete, onRestore, onMove, onEdit }) {
  const [open, setOpen] = useState(false);
  const sec = SECTIONS.find((s) => s.id === post.sectionId);
  return (
    <div className="card mb-2">
      <button className="w-full p-3 text-left flex items-start gap-2" onClick={() => setOpen((v) => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {sec && <span className="text-xs">{sec.emoji} <span style={{ color: sec.color }}>{sec.english}</span></span>}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[post.status]}18`, color: STATUS_COLORS[post.status] }}>{post.status}</span>
            {post.reports?.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#d9302518', color: 'var(--tg-danger)' }}><Flag size={9} className="inline" /> {post.reports.length}</span>}
          </div>
          <p className="text-xs am line-clamp-2" style={{ color: 'var(--tg-text)' }}>{post.content || '[Attachment only]'}</p>
          <p className="text-[10px] mt-1 am" style={{ color: 'var(--tg-hint)' }}>{post.author?.fullName} · {new Date(post.createdAt).toLocaleString()}</p>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-wrap gap-2 border-t" style={{ borderColor: 'var(--tg-border)' }}>
          <div className="pt-2 flex flex-wrap gap-2 w-full">
            {post.status !== 'DELETED' && <>
              <button onClick={() => onEdit(post)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-text)' }}><Edit2 size={12} /> Edit</button>
              <button onClick={() => onMove(post)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-text)' }}><MoveRight size={12} /> Move</button>
              <button onClick={() => onDelete(post.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#d9302518', color: 'var(--tg-danger)' }}><Trash2 size={12} /> Delete</button>
            </>}
            {post.status === 'DELETED' && (
              <button onClick={() => onRestore(post.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#1a7a4a18', color: 'var(--tg-success)' }}><RotateCcw size={12} /> Restore</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MoveModal({ post, onClose, onMove }) {
  const [target, setTarget] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full rounded-t-2xl p-5 space-y-3 shadow-xl" style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }} onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold" style={{ color: 'var(--tg-text)' }}>Move post to section</p>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="input">
          <option value="">Select section...</option>
          {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.english}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={() => onMove(post.id, target)} disabled={!target} className="btn-primary flex-1 text-sm" style={{ opacity: !target ? 0.5 : 1 }}>Move</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ post, onClose, onEdit }) {
  const [content, setContent] = useState(post.content || '');
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full rounded-t-2xl p-5 space-y-3 shadow-xl" style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }} onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold" style={{ color: 'var(--tg-text)' }}>Edit post</p>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="input am" rows={4} />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={() => onEdit(post.id, content)} disabled={!content.trim()} className="btn-primary flex-1 text-sm">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPosts() {
  const { t } = useTranslation();
  const qc    = useQueryClient();
  const [filter, setFilter] = useState('');
  const [moving, setMoving] = useState(null);
  const [editing, setEditing] = useState(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['admin-posts', filter],
    queryFn:  ({ pageParam }) => adminAPI.allPosts({ status: filter || undefined, cursor: pageParam, limit: 30 }).then((r) => r.data),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const refresh = () => qc.invalidateQueries(['admin-posts']);
  const deleteMutation  = useMutation({ mutationFn: (id) => adminAPI.deletePost(id), onSuccess: refresh });
  const restoreMutation = useMutation({ mutationFn: (id) => adminAPI.restorePost(id), onSuccess: refresh });
  const moveMutation    = useMutation({ mutationFn: ({ id, sec }) => adminAPI.movePost(id, sec), onSuccess: () => { refresh(); setMoving(null); } });
  const editMutation    = useMutation({ mutationFn: ({ id, content }) => adminAPI.editPost(id, content), onSuccess: () => { refresh(); setEditing(null); } });

  const posts = (data?.pages || []).flatMap((p) => p.posts);
  const FILTERS = [{ v:'', label:'All' },{ v:'FLAGGED', label:'⚠️ Flagged' },{ v:'DELETED', label:'Deleted' }];

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-base font-bold mb-3" style={{ color: 'var(--tg-text)' }}>Moderate Posts</h1>
        <div className="flex gap-2">
          {FILTERS.map(({ v, label }) => (
            <button key={v} onClick={() => setFilter(v)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: filter === v ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: filter === v ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-6">
        {isLoading && [1,2,3,4].map((i) => <div key={i} className="skeleton h-16 rounded-xl mb-2" />)}
        {!isLoading && posts.length === 0 && <div className="text-center py-12" style={{ color: 'var(--tg-hint)' }}><p className="text-sm">No posts</p></div>}
        {posts.map((p) => (
          <PostRow key={p.id} post={p}
                   onDelete={(id) => deleteMutation.mutate(id)}
                   onRestore={(id) => restoreMutation.mutate(id)}
                   onMove={(post) => setMoving(post)}
                   onEdit={(post) => setEditing(post)} />
        ))}
        {hasNextPage && <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="w-full py-3 text-sm" style={{ color: 'var(--tg-hint)' }}>{isFetchingNextPage ? '...' : t('common.more')}</button>}
      </div>
      {moving  && <MoveModal post={moving} onClose={() => setMoving(null)}  onMove={(id, sec) => moveMutation.mutate({ id, sec })} />}
      {editing && <EditModal post={editing} onClose={() => setEditing(null)} onEdit={(id, content) => editMutation.mutate({ id, content })} />}
    </div>
  );
}
