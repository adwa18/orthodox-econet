// frontend/src/components/PostCard.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Flag, Paperclip, ChevronDown } from 'lucide-react';
import ReactionBar from './ReactionBar';
import { postsAPI } from '../utils/api';
import useAuthStore from '../context/authStore';

const BADGE_COLORS = {
  VERIFIED_MEMBER: '#1a7a4a', ACTIVE_CONTRIBUTOR: '#2678b6',
  ELDER_MENTOR: '#7B5EA7',    VERIFIED_PROFESSIONAL: '#b85c00',
  TOP_TRADER: '#d93025',      COMMUNITY_BUILDER: '#5a5a5a',
};

const BADGE_ICONS = {
  VERIFIED_MEMBER: '✓', ACTIVE_CONTRIBUTOR: '⭐', ELDER_MENTOR: '🕊',
  VERIFIED_PROFESSIONAL: '🏅', TOP_TRADER: '🛒', COMMUNITY_BUILDER: '🤝',
};

function ReportModal({ postId, onClose }) {
  const { t } = useTranslation();
  const REASONS = ['spam','offensive','misinformation','inappropriate','other'];
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sent, setSent]   = useState(false);

  const submit = async () => {
    if (!reason) return;
    await postsAPI.report(postId, reason, details).catch(console.error);
    setSent(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="w-full rounded-t-2xl p-5 animate-fade-in"
           style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }}
           onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <p className="text-center text-sm font-medium py-4 am" style={{ color: 'var(--tg-success)' }}>✓ ሪፖርት ተልኳል</p>
        ) : (
          <>
            <h3 className="font-semibold mb-3 am" style={{ color: 'var(--tg-text)' }}>{t('post.report')}</h3>
            <div className="space-y-2 mb-3">
              {REASONS.map((r) => (
                <label key={r} className="flex items-center gap-3 py-2 cursor-pointer">
                  <input type="radio" name="reason" value={r} onChange={() => setReason(r)} style={{ accentColor: 'var(--tg-button)' }} />
                  <span className="text-sm" style={{ color: 'var(--tg-text)' }}>{r}</span>
                </label>
              ))}
            </div>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)}
                      placeholder="ተጨማሪ ዝርዝሮች (አማራጭ)" className="input mb-3" rows={2} />
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary flex-1 text-sm">{t('common.cancel')}</button>
              <button onClick={submit} disabled={!reason} className="btn-danger flex-1 text-sm"
                      style={{ opacity: reason ? 1 : 0.5 }}>
                {t('post.report')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PostCard({ post, onReply, showReplies = true }) {
  const { t }  = useTranslation();
  const { user } = useAuthStore();
  const [reactions, setReactions] = useState({
    reactionCounts: post.reactionCounts || {},
    myReactions:    post.myReactions    || [],
  });
  const [reporting, setReporting] = useState(false);

  const { author, content, attachments, createdAt, _count, status } = post;

  if (status === 'DELETED') return null;

  const topBadge = author?.badges?.[0];

  return (
    <>
      <article className="px-4 py-3 border-b" style={{ borderColor: 'var(--tg-border)' }}>
        {/* Author row */}
        <div className="flex items-start gap-2.5 mb-2">
          <div className="flex-shrink-0">
            {author?.telegramPhotoUrl
              ? <img src={author.telegramPhotoUrl} alt={author.fullName} className="w-9 h-9 rounded-full object-cover" />
              : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                     style={{ background: 'var(--tg-button)', color: 'var(--tg-button-text)' }}>
                  {author?.fullName?.[0] || '?'}
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold am" style={{ color: 'var(--tg-text)' }}>{author?.fullName}</span>
              {topBadge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${BADGE_COLORS[topBadge.type]}22`, color: BADGE_COLORS[topBadge.type] }}>
                  {BADGE_ICONS[topBadge.type]}
                </span>
              )}
              {['MODERATOR','SENIOR_ADMIN','OWNER'].includes(author?.role) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: '#d9302518', color: 'var(--tg-danger)' }}>
                  🛡
                </span>
              )}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--tg-hint)' }}>
              {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' · '}{new Date(createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Content */}
        {content && (
          <p className="text-sm am leading-relaxed mb-2 whitespace-pre-wrap" style={{ color: 'var(--tg-text)' }}>
            {content}
          </p>
        )}

        {/* Attachments */}
        {attachments?.length > 0 && (
          <div className="mb-2 space-y-2">
            {attachments.map((att, i) => (
              att.type === 'image'
                ? <img key={i} src={att.url} alt={att.filename || 'image'}
                       className="w-full rounded-xl object-cover max-h-64" loading="lazy" />
                : <a key={i} href={att.url} target="_blank" rel="noreferrer"
                     className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                     style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-link)' }}>
                    <Paperclip size={14} />{att.filename}
                  </a>
            ))}
          </div>
        )}

        {/* Flagged notice */}
        {status === 'FLAGGED' && (
          <p className="text-xs mb-2 px-2 py-1 rounded-lg" style={{ background: '#b85c0018', color: 'var(--tg-warning)' }}>
            ⚠️ Under review
          </p>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-3 mt-1">
          <ReactionBar
            postId={post.id}
            reactionCounts={reactions.reactionCounts}
            myReactions={reactions.myReactions}
            onUpdate={({ reactionCounts, myReactions }) => setReactions({ reactionCounts, myReactions })}
          />

          {showReplies && (
            <button
              onClick={() => onReply?.(post)}
              className="flex items-center gap-1 text-xs transition-colors active:opacity-60"
              style={{ color: 'var(--tg-hint)' }}
              aria-label={t('post.reply')}
            >
              <MessageSquare size={14} />
              {_count?.replies > 0 && <span>{_count.replies}</span>}
            </button>
          )}

          {author?.id !== user?.id && (
            <button
              onClick={() => setReporting(true)}
              className="ml-auto p-1 transition-opacity active:opacity-60"
              style={{ color: 'var(--tg-hint)' }}
              aria-label={t('post.report')}
            >
              <Flag size={13} />
            </button>
          )}
        </div>
      </article>

      {reporting && <ReportModal postId={post.id} onClose={() => setReporting(false)} />}
    </>
  );
}
