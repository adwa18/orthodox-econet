// frontend/src/pages/Profile.js
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Shield, Award, Edit2, Check } from 'lucide-react';
import { usersAPI } from '../utils/api';
import useAuthStore from '../context/authStore';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';

const BADGE_META = {
  VERIFIED_MEMBER:       { icon: '✓',  color: '#1a7a4a', label: 'Verified Member'        },
  ACTIVE_CONTRIBUTOR:    { icon: '⭐', color: '#2678b6', label: 'Active Contributor'      },
  ELDER_MENTOR:          { icon: '🕊', color: '#7B5EA7', label: 'Elder / Mentor'          },
  VERIFIED_PROFESSIONAL: { icon: '🏅', color: '#b85c00', label: 'Verified Professional'   },
  TOP_TRADER:            { icon: '🛒', color: '#d93025', label: 'Top Trader'              },
  COMMUNITY_BUILDER:     { icon: '🤝', color: '#5a5a5a', label: 'Community Builder'       },
};

function BadgePill({ type }) {
  const meta = BADGE_META[type] || { icon: '🎖', color: 'var(--tg-hint)', label: type };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
          style={{ background: `${meta.color}18`, color: meta.color }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="flex flex-col items-center py-3 rounded-xl" style={{ background: 'var(--tg-secondary-bg)' }}>
      <span className="text-xl font-bold" style={{ color: 'var(--tg-text)' }}>{value ?? '—'}</span>
      <span className="text-[10px] mt-0.5 am" style={{ color: 'var(--tg-hint)' }}>{label}</span>
    </div>
  );
}

// ── Own profile section ───────────────────────────────────────────────────────
function OwnProfile({ user }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { setUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [prefs, setPrefs]     = useState({ preferredLanguage: user.preferredLanguage || 'am' });

  const { data: stats } = useQuery({
    queryKey: ['my-stats'],
    queryFn:  () => usersAPI.myStats().then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => usersAPI.updateMe(data),
    onSuccess:  (res) => {
      setUser(res.data);
      qc.invalidateQueries(['me']);
      setEditing(false);
    },
  });

  const handleLangChange = (lang) => {
    setPrefs((p) => ({ ...p, preferredLanguage: lang }));
    setLanguage(lang);
  };

  return (
    <div className="page pb-8">
      {/* Avatar + name */}
      <div className="flex flex-col items-center pt-6 pb-4 px-4">
        {user.telegramPhotoUrl
          ? <img src={user.telegramPhotoUrl} alt={user.fullName} className="w-20 h-20 rounded-full object-cover shadow" />
          : <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow"
                 style={{ background: 'var(--tg-button)', color: 'var(--tg-button-text)' }}>
              {user.fullName?.[0]}
            </div>
        }
        <h1 className="mt-3 text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>{user.fullName}</h1>
        <p className="text-sm am" style={{ color: 'var(--tg-hint)' }}>{user.baptismName} · {user.churchName}</p>
        {user.telegramUsername && <p className="text-xs mt-0.5" style={{ color: 'var(--tg-hint)' }}>@{user.telegramUsername}</p>}

        {/* Trust score */}
        <div className="flex items-center gap-1 mt-2">
          <Star size={14} fill="currentColor" style={{ color: '#b85c00' }} />
          <span className="text-xs font-medium" style={{ color: '#b85c00' }}>{user.trustScore} Trust Score</span>
        </div>
      </div>

      {/* Badges */}
      {user.badges?.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>{t('profile.badges')}</p>
          <div className="flex flex-wrap gap-2">
            {user.badges.map((b) => <BadgePill key={b.id} type={b.type} />)}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="px-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>{t('profile.stats')}</p>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label={t('profile.posts')}        value={stats.postsCount} />
            <StatBox label={t('profile.endorsements')} value={stats.endorsementsReceived} />
            <StatBox label="Sections"                   value={stats.sectionsActiveCount} />
          </div>
        </div>
      )}

      {/* Preferences */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--tg-hint)' }}>
            {t('profile.editProfile')}
          </p>
          <button onClick={() => editing ? saveMutation.mutate(prefs) : setEditing(true)}
                  className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--tg-button)' }}>
            {editing ? <><Check size={13} /> {t('common.save')}</> : <><Edit2 size={13} /> {t('profile.editProfile')}</>}
          </button>
        </div>

        {editing && (
          <div className="card p-4 space-y-3">
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--tg-hint)' }}>{t('profile.language')}</p>
              <div className="grid grid-cols-4 gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button key={lang.code} onClick={() => handleLangChange(lang.code)}
                          className="py-2 rounded-xl text-xs font-medium transition-colors"
                          style={{
                            background: prefs.preferredLanguage === lang.code ? 'var(--tg-button)' : 'var(--tg-secondary-bg)',
                            color: prefs.preferredLanguage === lang.code ? 'var(--tg-button-text)' : 'var(--tg-hint)',
                          }}>
                    {lang.code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Endorsements received */}
      {user.endorsements?.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>{t('profile.endorsements')}</p>
          <div className="space-y-2">
            {user.endorsements.slice(0, 5).map((e) => (
              <div key={e.id} className="card p-3">
                <div className="flex items-center gap-2 mb-1">
                  {e.fromUser?.telegramPhotoUrl
                    ? <img src={e.fromUser.telegramPhotoUrl} alt="" className="w-6 h-6 rounded-full" />
                    : <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                           style={{ background: 'var(--tg-button)', color: 'var(--tg-button-text)' }}>
                        {e.fromUser?.fullName?.[0]}
                      </div>
                  }
                  <span className="text-xs font-medium am" style={{ color: 'var(--tg-text)' }}>{e.fromUser?.fullName}</span>
                </div>
                <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>"{e.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Viewing another user's profile ────────────────────────────────────────────
function OtherProfile({ userId }) {
  const { t } = useTranslation();
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [endorseText, setEndorseText] = useState('');
  const [endorsing, setEndorsing]     = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn:  () => usersAPI.getUser(userId).then((r) => r.data),
  });

  const endorseMutation = useMutation({
    mutationFn: ({ id, text }) => usersAPI.endorse(id, text),
    onSuccess:  () => { qc.invalidateQueries(['user', userId]); setEndorsing(false); setEndorseText(''); },
  });

  if (isLoading) return <div className="flex justify-center pt-12"><div className="w-8 h-8 rounded-full border-2 border-tg-button border-t-transparent animate-spin" /></div>;
  if (!profile)  return <div className="text-center pt-12" style={{ color: 'var(--tg-hint)' }}>User not found</div>;

  return (
    <div className="page pb-8">
      <div className="flex flex-col items-center pt-6 pb-4 px-4">
        {profile.telegramPhotoUrl
          ? <img src={profile.telegramPhotoUrl} alt={profile.fullName} className="w-20 h-20 rounded-full object-cover" />
          : <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                 style={{ background: 'var(--tg-button)', color: 'var(--tg-button-text)' }}>
              {profile.fullName?.[0]}
            </div>
        }
        <h1 className="mt-3 text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>{profile.fullName}</h1>
        <p className="text-sm am" style={{ color: 'var(--tg-hint)' }}>{profile.baptismName} · {profile.churchName}</p>
        <div className="flex items-center gap-1 mt-2">
          <Star size={14} fill="currentColor" style={{ color: '#b85c00' }} />
          <span className="text-xs" style={{ color: '#b85c00' }}>{profile.trustScore} Trust</span>
        </div>
      </div>

      {profile.badges?.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((b) => <BadgePill key={b.id} type={b.type} />)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 px-4 mb-4">
        <StatBox label={t('profile.posts')} value={profile._count?.posts} />
        <StatBox label={t('profile.endorsements')} value={profile.endorsements?.length} />
      </div>

      {/* Endorse button */}
      {me?.id !== userId && (
        <div className="px-4 mb-4">
          {endorsing ? (
            <div className="card p-3 space-y-2">
              <textarea value={endorseText} onChange={(e) => setEndorseText(e.target.value)}
                        placeholder="ምስክርነት ይጻፉ... (10+ ፊደሎች)" className="input am" rows={3} />
              <div className="flex gap-2">
                <button onClick={() => setEndorsing(false)} className="btn-secondary flex-1 text-sm">{t('common.cancel')}</button>
                <button onClick={() => endorseMutation.mutate({ id: userId, text: endorseText })}
                        disabled={endorseText.trim().length < 10 || endorseMutation.isPending}
                        className="btn-primary flex-1 text-sm" style={{ opacity: endorseText.trim().length < 10 ? 0.5 : 1 }}>
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => profile.alreadyEndorsed ? null : setEndorsing(true)}
                    className={profile.alreadyEndorsed ? 'btn-secondary w-full text-sm' : 'btn-primary w-full text-sm'}
                    disabled={profile.alreadyEndorsed}>
              {profile.alreadyEndorsed ? '✓ Endorsed' : `🏅 ${t('profile.endorseUser')}`}
            </button>
          )}
        </div>
      )}

      {profile.endorsements?.length > 0 && (
        <div className="px-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tg-hint)' }}>{t('profile.endorsements')}</p>
          <div className="space-y-2">
            {profile.endorsements.map((e) => (
              <div key={e.id} className="card p-3">
                <p className="text-xs font-medium am mb-1" style={{ color: 'var(--tg-text)' }}>{e.fromUser?.fullName}</p>
                <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>"{e.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Profile() {
  const { id }   = useParams();
  const { user } = useAuthStore();
  const viewingOther = id && id !== user?.id;

  if (viewingOther) return <OtherProfile userId={id} />;

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn:  () => usersAPI.me().then((r) => r.data),
    initialData: user,
  });

  if (isLoading) return <div className="flex justify-center pt-12"><div className="w-8 h-8 rounded-full border-2 border-tg-button border-t-transparent animate-spin" /></div>;
  return <OwnProfile user={data} />;
}
