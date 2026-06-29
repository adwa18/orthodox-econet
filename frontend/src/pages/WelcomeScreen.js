// frontend/src/pages/WelcomeScreen.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../context/authStore';
import { usersAPI } from '../utils/api';

export default function WelcomeScreen() {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [dontShow, setDontShow] = useState(false);

  const handleDismiss = async () => {
    if (dontShow) {
      usersAPI.updateMe({ dontShowWelcome: true }).catch(console.error);
      setUser({ ...user, dontShowWelcome: true });
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 text-center gap-6"
         style={{ background: 'var(--tg-bg)' }}>
      <div className="text-6xl">☦️</div>
      <div>
        <h1 className="text-xl font-bold leading-snug am mb-3" style={{ color: 'var(--tg-text)' }}>
          {t('home.welcome')}
        </h1>
        <p className="text-sm am" style={{ color: 'var(--tg-hint)' }}>{t('home.welcomeSubtitle')}</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)}
               className="w-4 h-4 rounded" style={{ accentColor: 'var(--tg-button)' }} />
        <span className="text-sm am" style={{ color: 'var(--tg-hint)' }}>{t('home.dontShowAgain')}</span>
      </label>
      <button onClick={handleDismiss} className="btn-primary px-8">{t('common.done')}</button>
    </div>
  );
}
