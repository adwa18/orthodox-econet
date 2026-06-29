// frontend/src/components/ChatComposer.js
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Paperclip, X, AlertCircle } from 'lucide-react';
import { postsAPI } from '../utils/api';
import { emitTypingStart, emitTypingStop } from '../utils/socket';

const URL_REGEX = /https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|me|app|co|biz|info|xyz)/gi;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export default function ChatComposer({ sectionId, replyTo, onClearReply, onPosted }) {
  const { t } = useTranslation();
  const [text, setText]       = useState('');
  const [files, setFiles]     = useState([]);
  const [error, setError]     = useState('');
  const [sending, setSending] = useState(false);
  const fileRef  = useRef(null);
  const typingTimer = useRef(null);

  const hasLink = URL_REGEX.test(text);
  URL_REGEX.lastIndex = 0;

  const handleTextChange = (val) => {
    setText(val);
    setError('');

    // Typing indicator
    emitTypingStart(sectionId, 'User');
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTypingStop(sectionId), 2000);
  };

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    const oversized = picked.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversized.length) { setError('ፋይሉ ከ50MB አልፏል'); return; }
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (sending) return;
    if (!text.trim() && files.length === 0) return;
    if (hasLink) { setError(t('post.noLinks')); return; }

    setSending(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('sectionId', sectionId);
      fd.append('content', text.trim());
      if (replyTo) fd.append('replyToId', replyTo.id);
      files.forEach((f) => fd.append('attachments', f));

      const res = await postsAPI.create(fd);
      onPosted?.(res.data);
      setText('');
      setFiles([]);
      onClearReply?.();
      emitTypingStop(sectionId);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to send.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex-shrink-0 border-t" style={{ background: 'var(--tg-bg)', borderColor: 'var(--tg-border)' }}>
      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs border-b"
             style={{ background: 'var(--tg-secondary-bg)', borderColor: 'var(--tg-border)', color: 'var(--tg-hint)' }}>
          <div className="flex-1 truncate">
            ↩ <span className="font-medium am" style={{ color: 'var(--tg-text)' }}>{replyTo.author?.fullName}</span>
            {': '}{replyTo.content?.slice(0, 60)}
          </div>
          <button onClick={onClearReply} aria-label="Cancel reply"><X size={14} /></button>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto">
          {files.map((f, i) => (
            <div key={i} className="relative flex-shrink-0">
              {f.type.startsWith('image/')
                ? <img src={URL.createObjectURL(f)} alt={f.name} className="w-16 h-16 rounded-lg object-cover" />
                : <div className="w-16 h-16 rounded-lg flex flex-col items-center justify-center text-[10px] p-1 text-center"
                       style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>
                    <Paperclip size={16} />{f.name.slice(0,10)}
                  </div>
              }
              <button onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--tg-danger)', color: '#fff' }}>
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs"
             style={{ color: 'var(--tg-danger)', background: '#d9302510' }}>
          <AlertCircle size={12} /><span className="am">{error}</span>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2">
        {/* File attach */}
        <button onClick={() => fileRef.current?.click()}
                className="flex-shrink-0 p-2 rounded-xl transition-colors"
                style={{ color: 'var(--tg-hint)' }} aria-label={t('post.attachFile')}>
          <Paperclip size={20} />
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
               onChange={handleFiles} className="hidden" />

        {/* Text area */}
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('post.placeholder')}
          className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none am"
          style={{
            background: 'var(--tg-secondary-bg)',
            color: hasLink ? 'var(--tg-danger)' : 'var(--tg-text)',
            border: hasLink ? '1px solid var(--tg-danger)' : '1px solid transparent',
            minHeight: '44px', maxHeight: '120px',
          }}
          rows={1}
          aria-label={t('post.placeholder')}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && files.length === 0) || hasLink}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-opacity"
          style={{
            background: 'var(--tg-button)',
            color: 'var(--tg-button-text)',
            opacity: (sending || (!text.trim() && files.length === 0) || hasLink) ? 0.5 : 1,
          }}
          aria-label={t('post.send')}
        >
          {sending
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Send size={16} />
          }
        </button>
      </div>
    </div>
  );
}
