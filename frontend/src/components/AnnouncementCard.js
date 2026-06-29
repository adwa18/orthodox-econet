// frontend/src/components/AnnouncementCard.js
import React from 'react';
import { Pin, Paperclip } from 'lucide-react';

export default function AnnouncementCard({ announcement }) {
  const { title, content, author, isPinned, attachments, createdAt } = announcement;

  return (
    <article
      className="card p-4 mb-3"
      style={{ borderLeft: isPinned ? '3px solid var(--tg-button)' : undefined }}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold am leading-snug" style={{ color: 'var(--tg-text)' }}>{title}</h3>
        {isPinned && <Pin size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--tg-button)' }} aria-label="Pinned" />}
      </div>
      <p className="text-sm am leading-relaxed" style={{ color: 'var(--tg-text)' }}>{content}</p>

      {attachments?.length > 0 && (
        <div className="mt-3 space-y-1">
          {attachments.map((att, i) => (
            att.type === 'image'
              ? <img key={i} src={att.url} alt={att.filename} className="w-full rounded-lg object-cover max-h-48" />
              : (
                <a key={i} href={att.url} target="_blank" rel="noreferrer"
                   className="flex items-center gap-2 text-xs p-2 rounded-lg"
                   style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-link)' }}>
                  <Paperclip size={13} /> {att.filename}
                </a>
              )
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        {author?.telegramPhotoUrl && (
          <img src={author.telegramPhotoUrl} alt={author.fullName} className="w-5 h-5 rounded-full" />
        )}
        <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>
          {author?.fullName} · {new Date(createdAt).toLocaleDateString()}
        </p>
      </div>
    </article>
  );
}
