// frontend/src/pages/Registration.js
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, AlertCircle, CheckCircle } from 'lucide-react';
import { authAPI } from '../utils/api';

const CREED_PHRASE = 'በሥላሴ ሦስትነት እና አንድነት አምናለው፣ የኢየሱስ ክርስቶስን የባህርይ አምላክነት በፍጹም ልቤ አምናለው፣ የድንግል ማርያም ጻድቃን መላዕክት ሰማዕታት አማላጅነት አምናለው።';
const normalize  = (s) => (s || '').trim().replace(/\s+/g, ' ');

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete, required = true }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--tg-hint)' }}>
        {label} {required && <span style={{ color: 'var(--tg-danger)' }}>*</span>}
      </label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        className="input" required={required}
      />
    </div>
  );
}

export default function Registration() {
  const { t } = useTranslation();
  const tg    = window.Telegram?.WebApp;
  const tgUser = tg?.initDataUnsafe?.user || {};

  const [form, setForm] = useState({
    fullName: '', baptismName: '', churchName: '', phoneNumber: '', email: '', creedPhrase: '',
  });
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const creedRef = useRef(null);

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const creedMatch = normalize(form.creedPhrase) === normalize(CREED_PHRASE);

  const handleCopy = () => {
    navigator.clipboard?.writeText(CREED_PHRASE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.fullName || !form.baptismName || !form.churchName || !form.phoneNumber || !form.email) {
      setError('ሁሉም ሜዳዎች ያስፈልጋሉ / All fields are required.'); return;
    }
    if (!creedMatch) { setError(t('registration.creedError')); creedRef.current?.focus(); return; }

    setLoading(true);
    try {
      await authAPI.register({ ...form, initData: tg?.initData || '' });
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Registration failed.';
      if (err.response?.data?.error === 'already_registered') {
        setError('አስቀድሞ ተመዝግቧል / Already registered.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-5 text-center"
           style={{ background: 'var(--tg-bg)' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#1a7a4a18' }}>
          <CheckCircle size={40} style={{ color: 'var(--tg-success)' }} />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-2 am" style={{ color: 'var(--tg-text)' }}>ምዝገባ ተቀብሏል!</h2>
          <p className="text-sm am" style={{ color: 'var(--tg-hint)' }}>{t('registration.success')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--tg-bg)', minHeight: '100vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">☦️</div>
          <h1 className="text-xl font-bold am" style={{ color: 'var(--tg-text)' }}>{t('registration.title')}</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--tg-hint)' }}>{t('registration.subtitle')}</p>
        </div>

        {/* Telegram info (read-only) */}
        {tgUser.id && (
          <div className="card p-3 mb-5 flex items-center gap-3">
            {tgUser.photo_url && <img src={tgUser.photo_url} alt="" className="w-10 h-10 rounded-full" />}
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--tg-text)' }}>
                {tgUser.first_name} {tgUser.last_name}
              </p>
              {tgUser.username && (
                <p className="text-xs" style={{ color: 'var(--tg-hint)' }}>@{tgUser.username}</p>
              )}
              <p className="text-xs" style={{ color: 'var(--tg-success)' }}>✓ {t('registration.telegramInfo')}</p>
            </div>
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-4">
          <Field label={t('registration.fullName')}    value={form.fullName}    onChange={set('fullName')}    placeholder="ሙሉ ስም" autoComplete="name" />
          <Field label={t('registration.baptismName')} value={form.baptismName} onChange={set('baptismName')} placeholder="የክርስትና ስም" />
          <Field label={t('registration.churchName')}  value={form.churchName}  onChange={set('churchName')}  placeholder="ቅርብ ያለ ቤተክርስቲያን" />
          <Field label={t('registration.phone')}       value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="+251..." type="tel" autoComplete="tel" />
          <Field label={t('registration.email')}       value={form.email}       onChange={set('email')}       placeholder="example@email.com" type="email" autoComplete="email" />

          {/* ─── Faith declaration ─────────────────────────────── */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--tg-hint)' }}>
              {t('registration.creedTitle')} <span style={{ color: 'var(--tg-danger)' }}>*</span>
            </label>
            <p className="text-xs mb-2" style={{ color: 'var(--tg-hint)' }}>{t('registration.creedInstruction')}</p>

            {/* The phrase to retype — styled blockquote */}
            <div className="relative rounded-xl p-4 mb-3" style={{ background: 'var(--tg-secondary-bg)', borderLeft: '3px solid var(--tg-button)' }}>
              <p className="text-sm am leading-relaxed pr-8" style={{ color: 'var(--tg-text)', direction: 'ltr' }}>
                {CREED_PHRASE}
              </p>
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors"
                style={{ color: copied ? 'var(--tg-success)' : 'var(--tg-hint)', background: 'var(--tg-bg)' }}
                aria-label={t('registration.creedCopy')}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            {/* Input field */}
            <textarea
              ref={creedRef}
              value={form.creedPhrase}
              onChange={(e) => set('creedPhrase')(e.target.value)}
              placeholder={t('registration.creedInput')}
              className="input am"
              rows={4}
              aria-invalid={form.creedPhrase && !creedMatch}
              style={{
                borderColor: form.creedPhrase
                  ? creedMatch ? 'var(--tg-success)' : 'var(--tg-danger)'
                  : 'transparent',
              }}
            />

            {/* Validation feedback */}
            {form.creedPhrase && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {creedMatch
                  ? <><Check size={13} style={{ color: 'var(--tg-success)' }} /><span className="text-xs" style={{ color: 'var(--tg-success)' }}>ትክክለኛ ✓</span></>
                  : <><AlertCircle size={13} style={{ color: 'var(--tg-danger)' }} /><span className="text-xs" style={{ color: 'var(--tg-danger)' }}>{t('registration.creedError')}</span></>
                }
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl flex items-start gap-2 text-sm"
               style={{ background: '#d9302518', color: 'var(--tg-danger)' }}>
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="am">{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !creedMatch}
          className="btn-primary w-full mt-6"
          style={{ opacity: loading || !creedMatch ? 0.6 : 1 }}
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('registration.registering')}</>
          ) : (
            <>{t('registration.submit')}</>
          )}
        </button>
      </div>
    </div>
  );
}
