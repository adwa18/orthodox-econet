// frontend/src/pages/Donations.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Heart, Copy, Check } from 'lucide-react';
import { donationsAPI } from '../utils/api';

function InfoRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--tg-border)' }}>
      <span className="text-xs" style={{ color: 'var(--tg-hint)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium am" style={{ color: 'var(--tg-text)' }}>{value}</span>
        <button onClick={copy} style={{ color: 'var(--tg-hint)' }}>{copied ? <Check size={12} /> : <Copy size={12} />}</button>
      </div>
    </div>
  );
}

export default function Donations() {
  const { t }  = useTranslation();
  const [method, setMethod]   = useState('telebirr');
  const [amount, setAmount]   = useState('');
  const [reference, setRef]   = useState('');
  const [message, setMessage] = useState('');
  const [anon, setAnon]       = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [done, setDone]       = useState(false);

  const { data: info } = useQuery({
    queryKey: ['payment-info'],
    queryFn:  () => donationsAPI.paymentInfo().then((r) => r.data),
  });

  const submitMutation = useMutation({
    mutationFn: (fd) => donationsAPI.submit(fd),
    onSuccess:  () => setDone(true),
  });

  const handleSubmit = () => {
    const fd = new FormData();
    fd.append('amount', amount);
    fd.append('method', method);
    fd.append('reference', reference);
    fd.append('message', message);
    fd.append('isAnonymous', anon);
    if (screenshot) fd.append('screenshot', screenshot);
    submitMutation.mutate(fd);
  };

  const METHODS = [
    { id: 'telebirr',      label: t('donations.telebirr') },
    { id: 'bank_transfer', label: t('donations.bank')     },
    { id: 'cash',          label: t('donations.cash')     },
  ];

  if (done) return (
    <div className="flex flex-col items-center justify-center min-h-full gap-4 text-center p-6" style={{ background: 'var(--tg-bg)' }}>
      <Heart size={48} fill="currentColor" style={{ color: 'var(--tg-danger)' }} />
      <p className="text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>{t('donations.thanks')}</p>
      <p className="text-sm am" style={{ color: 'var(--tg-hint)' }}>አስተዳዳሪ ሲያረጋግጥ ይነገርዎታል።</p>
    </div>
  );

  return (
    <div className="page pb-8">
      <div className="px-4 pt-6 pb-4 text-center">
        <Heart size={32} fill="currentColor" style={{ color: 'var(--tg-danger)', margin: '0 auto 8px' }} />
        <h1 className="text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>{t('donations.title')}</h1>
      </div>

      {/* Method tabs */}
      <div className="flex px-4 gap-2 mb-4">
        {METHODS.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium"
                  style={{ background: method === m.id ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: method === m.id ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Payment info */}
      {info && (
        <div className="mx-4 card p-4 mb-4">
          {method === 'telebirr' && (
            <InfoRow label={t('donations.telebirr')} value={info.telebirr_number} />
          )}
          {method === 'bank_transfer' && (<>
            <InfoRow label="Bank"       value={info.bank_name} />
            <InfoRow label="Account"    value={info.bank_account_name} />
            <InfoRow label="Number"     value={info.bank_account_number} />
            <InfoRow label="Branch"     value={info.bank_branch} />
          </>)}
          {method === 'cash' && (
            <p className="text-sm am text-center py-2" style={{ color: 'var(--tg-hint)' }}>
              ለጥሬ ገንዘብ ድጋፍ ያናግሩ @{info.support_username || 'OrthodoxEconetSupport'}
            </p>
          )}
        </div>
      )}

      {/* Form */}
      <div className="px-4 space-y-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>{t('donations.amount')} *</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="input" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>{t('donations.reference')}</label>
          <input value={reference} onChange={(e) => setRef(e.target.value)} placeholder="TX-12345" className="input" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>{t('donations.screenshot')}</label>
          <input type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0])}
                 className="text-sm w-full" style={{ color: 'var(--tg-hint)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Message (optional)</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input am" rows={2} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} style={{ accentColor: 'var(--tg-button)' }} />
          <span className="text-sm am" style={{ color: 'var(--tg-hint)' }}>{t('donations.anonymous')}</span>
        </label>
        <button onClick={handleSubmit} disabled={!amount || submitMutation.isPending} className="btn-primary w-full">
          {submitMutation.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t('donations.submit')}
        </button>
      </div>
    </div>
  );
}
