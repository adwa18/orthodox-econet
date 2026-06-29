// frontend/src/pages/Recovery.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, CheckCircle, AlertCircle } from 'lucide-react';
import { authAPI } from '../utils/api';
import useAuthStore from '../context/authStore';

export default function Recovery() {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const tg = window.Telegram?.WebApp;

  const [step, setStep]     = useState(1); // 1 = identify, 2 = verify code, 3 = success
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [tgUser, setTgUser] = useState('');
  const [userId, setUserId] = useState('');
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleRequest = async () => {
    if (!email && !phone && !tgUser) {
      setError('ቢያንስ አንድ ሜዳ ያስፈልጋል'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await authAPI.requestRecovery({
        email: email || undefined,
        phoneNumber: phone || undefined,
        telegramUsername: tgUser || undefined,
      });
      if (res.data.userId) setUserId(res.data.userId);
      setStep(2);
    } catch {
      setError('ጥያቄ አልተሳካም');
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      setError('6-ዲጂት ኮድ ያስፈልጋል'); return;
    }
    if (!tg?.initData) {
      setError('ከቴሌግራም ውስጥ ይጠቀሙ'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await authAPI.verifyRecovery({
        userId,
        code: code.trim(),
        newTelegramInitData: tg.initData,
      });
      localStorage.setItem('token', res.data.token);
      await login(tg.initData);
      setStep(3);
      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'ኮድ ትክክለኛ አይደለም');
    } finally { setLoading(false); }
  };

  const InputField = ({ label, value, onChange, placeholder, type = 'text' }) => (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--tg-hint)' }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
             placeholder={placeholder} className="input" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6"
         style={{ background: 'var(--tg-bg)' }}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center"
           style={{ background: 'var(--tg-secondary-bg)' }}>
        <KeyRound size={28} style={{ color: 'var(--tg-button)' }} />
      </div>

      {step === 1 && (
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>መለያ መመለሻ</h1>
            <p className="text-xs mt-1 am" style={{ color: 'var(--tg-hint)' }}>
              ቢያንስ አንድ ሜዳ ይሙሉ — ወደ አሮጌ Telegram መለያ ኮድ ይላካል
            </p>
          </div>
          <InputField label="ኢሜይል" value={email} onChange={setEmail} placeholder="example@email.com" type="email" />
          <InputField label="ስልክ ቁጥር" value={phone} onChange={setPhone} placeholder="+251..." type="tel" />
          <InputField label="የቴሌግራም ስም" value={tgUser} onChange={setTgUser} placeholder="@username" />
          {error && <p className="text-xs am" style={{ color: 'var(--tg-danger)' }}><AlertCircle size={12} className="inline mr-1" />{error}</p>}
          <button onClick={handleRequest} disabled={loading} className="btn-primary w-full">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'ቀጥል'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>ኮድ ያስገቡ</h1>
            <p className="text-xs mt-1 am" style={{ color: 'var(--tg-hint)' }}>ወደ አሮጌ Telegram መለያዎ 6-ዲጂት ኮድ ተልኳል</p>
          </div>
          <InputField label="ኮድ" value={code} onChange={setCode} placeholder="123456" type="number" />
          {error && <p className="text-xs am" style={{ color: 'var(--tg-danger)' }}><AlertCircle size={12} className="inline mr-1" />{error}</p>}
          <button onClick={handleVerify} disabled={loading} className="btn-primary w-full">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'አረጋግጥ'}
          </button>
          <button onClick={() => { setStep(1); setError(''); }} className="w-full text-sm" style={{ color: 'var(--tg-hint)' }}>
            {t('common.back')}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-3">
          <CheckCircle size={48} style={{ color: 'var(--tg-success)' }} className="mx-auto" />
          <p className="text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>መለያ ተመልሷል!</p>
          <p className="text-sm am" style={{ color: 'var(--tg-hint)' }}>ወደ ዋና ገጽ እየሄደ ነው...</p>
        </div>
      )}
    </div>
  );
}
