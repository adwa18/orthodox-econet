// frontend/src/pages/BannedScreen.js
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldOff } from 'lucide-react';
import useAuthStore from '../context/authStore';

export default function BannedScreen() {
  const { t } = useTranslation();
  const { banInfo, logout } = useAuthStore();
  const support = process.env.REACT_APP_SUPPORT_USERNAME || 'OrthodoxEconetSupport';

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 text-center gap-5"
         style={{ background: 'var(--tg-bg)', minHeight: '100dvh' }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#d9302518' }}>
        <ShieldOff size={36} style={{ color: 'var(--tg-danger)' }} />
      </div>
      <div>
        <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--tg-danger)' }}>{t('auth.banned')}</h1>
        {banInfo?.reason && (
          <p className="text-sm mb-1" style={{ color: 'var(--tg-hint)' }}>
            <span className="font-medium" style={{ color: 'var(--tg-text)' }}>{t('auth.banReason')}:</span> {banInfo.reason}
          </p>
        )}
        {!banInfo?.isPermanent && banInfo?.expiresAt && (
          <p className="text-sm" style={{ color: 'var(--tg-hint)' }}>
            {t('auth.banExpiry')}: {new Date(banInfo.expiresAt).toLocaleString()}
          </p>
        )}
        {banInfo?.isPermanent && (
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--tg-danger)' }}>{t('auth.permanentBan')}</p>
        )}
      </div>
      <a href={`https://t.me/${support}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm px-6">
        {t('auth.contactSupport')} @{support}
      </a>
      <button onClick={logout} className="text-xs" style={{ color: 'var(--tg-hint)' }}>{t('auth.logout')}</button>
    </div>
  );
}
