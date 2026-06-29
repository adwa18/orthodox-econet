// frontend/src/components/ReactionBar.js
import React, { useState } from 'react';
import { postsAPI } from '../utils/api';

const REACTIONS = [
  { type: 'like',      emoji: '👍', label: 'Like'      },
  { type: 'pray',      emoji: '🙏', label: 'Pray'      },
  { type: 'agree',     emoji: '✅', label: 'Agree'     },
  { type: 'celebrate', emoji: '🎉', label: 'Celebrate' },
];

export default function ReactionBar({ postId, reactionCounts = {}, myReactions = [], onUpdate }) {
  const [open, setOpen]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReact = async (type) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await postsAPI.react(postId, type);
      onUpdate?.(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const totalCount = Object.values(reactionCounts).reduce((s, c) => s + c, 0);

  return (
    <div className="relative">
      {/* Reaction summary row */}
      <div className="flex items-center gap-1 flex-wrap">
        {REACTIONS.filter((r) => reactionCounts[r.type]).map((r) => (
          <button
            key={r.type}
            onClick={() => handleReact(r.type)}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs transition-colors"
            style={{
              background: myReactions.includes(r.type) ? 'var(--tg-button)' : 'var(--tg-secondary-bg)',
              color:      myReactions.includes(r.type) ? 'var(--tg-button-text)' : 'var(--tg-text)',
            }}
            aria-pressed={myReactions.includes(r.type)}
            aria-label={r.label}
          >
            {r.emoji} {reactionCounts[r.type]}
          </button>
        ))}

        {/* Add reaction button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-2 py-0.5 rounded-full text-xs transition-colors"
          style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}
          aria-label="Add reaction"
          aria-expanded={open}
        >
          {totalCount === 0 ? '+ ምላሽ' : '＋'}
        </button>
      </div>

      {/* Reaction picker popup */}
      {open && (
        <div
          className="absolute bottom-8 left-0 flex gap-1 p-2 rounded-xl shadow-lg z-10 animate-fade-in"
          style={{ background: 'var(--tg-bg)', border: '1px solid var(--tg-border)' }}
        >
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              onClick={() => handleReact(r.type)}
              className="text-xl p-1.5 rounded-lg transition-transform active:scale-90"
              aria-label={r.label}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
