// frontend/src/pages/MarketplaceDetail.js
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceAPI } from '../utils/api';
import useAuthStore from '../context/authStore';

export default function MarketplaceDetail() {
  const { id }    = useParams();
  const { t }     = useTranslation();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const qc        = useQueryClient();
  const [offerAmt, setOfferAmt] = useState('');
  const [offerMsg, setOfferMsg] = useState('');
  const [imgIdx, setImgIdx]     = useState(0);
  const [showOffer, setShowOffer] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn:  () => marketplaceAPI.get(id).then((r) => r.data),
  });

  const offerMutation = useMutation({
    mutationFn: (d) => marketplaceAPI.makeOffer(id, d),
    onSuccess:  () => { qc.invalidateQueries(['listing', id]); setShowOffer(false); },
  });

  if (isLoading) return <div className="flex justify-center pt-12"><div className="w-8 h-8 rounded-full border-2 border-tg-button border-t-transparent animate-spin" /></div>;
  if (!listing)  return <div className="text-center pt-12 am" style={{ color: 'var(--tg-hint)' }}>ዝርዝሩ አልተገኘም</div>;

  const isSeller = listing.seller?.id === user?.id;
  const myOffer  = listing.offers?.[0];

  return (
    <div className="page pb-8">
      {/* Images */}
      {listing.images?.length > 0 && (
        <div className="relative">
          <img src={listing.images[imgIdx]?.url} alt={listing.title} className="w-full h-56 object-cover" />
          {listing.images.length > 1 && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
              {listing.images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                        className="w-2 h-2 rounded-full" style={{ background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.5)' }} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        <div>
          <h1 className="text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>{listing.title}</h1>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-bold" style={{ color: 'var(--tg-button)' }}>
              {parseFloat(listing.price).toLocaleString()} {listing.currency}
            </span>
            <span className="text-xs px-2 py-1 rounded-full capitalize"
                  style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>
              {listing.category}
            </span>
          </div>
          {listing.location && <p className="text-sm mt-1 am" style={{ color: 'var(--tg-hint)' }}>📍 {listing.location}</p>}
        </div>

        <div className="card p-3">
          <p className="text-sm am leading-relaxed" style={{ color: 'var(--tg-text)' }}>{listing.description}</p>
        </div>

        {/* Seller */}
        <div className="card p-3 flex items-center gap-3">
          {listing.seller?.telegramPhotoUrl && (
            <img src={listing.seller.telegramPhotoUrl} alt="" className="w-10 h-10 rounded-full" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium am" style={{ color: 'var(--tg-text)' }}>{listing.seller?.fullName}</p>
            <p className="text-xs" style={{ color: 'var(--tg-hint)' }}>⭐ {listing.seller?.trustScore} Trust</p>
          </div>
          <button onClick={() => navigate(`/profile/${listing.seller?.id}`)}
                  className="text-xs" style={{ color: 'var(--tg-button)' }}>
            View
          </button>
        </div>

        {/* Offer section */}
        {!isSeller && listing.status === 'active' && (
          myOffer ? (
            <div className="card p-3 text-center">
              <p className="text-sm am font-medium" style={{ color: myOffer.status === 'accepted' ? 'var(--tg-success)' : 'var(--tg-hint)' }}>
                {myOffer.status === 'pending' && '⏳ ቅናሽዎ ይጠበቃል'}
                {myOffer.status === 'accepted' && '✅ ቅናሽዎ ተቀበለ!'}
                {myOffer.status === 'rejected' && '❌ ቅናሽዎ አልተቀበለም'}
              </p>
              {myOffer.status === 'accepted' && (
                <p className="text-xs mt-1 am" style={{ color: 'var(--tg-hint)' }}>ሻጩ ይደርስዎታል</p>
              )}
            </div>
          ) : showOffer ? (
            <div className="card p-4 space-y-3">
              <p className="text-sm font-medium am" style={{ color: 'var(--tg-text)' }}>{t('marketplace.makeOffer')}</p>
              <input type="number" value={offerAmt} onChange={(e) => setOfferAmt(e.target.value)}
                     placeholder={`${t('marketplace.yourOffer')} (ETB)`} className="input" />
              <textarea value={offerMsg} onChange={(e) => setOfferMsg(e.target.value)}
                        placeholder={t('marketplace.offerMessage')} className="input" rows={2} />
              <div className="flex gap-2">
                <button onClick={() => setShowOffer(false)} className="btn-secondary flex-1 text-sm">{t('common.cancel')}</button>
                <button onClick={() => offerMutation.mutate({ amount: offerAmt, message: offerMsg })}
                        disabled={!offerAmt || offerMutation.isPending} className="btn-primary flex-1 text-sm">
                  {offerMutation.isPending ? '...' : t('common.confirm')}
                </button>
              </div>
            </div>
          ) : (
            listing.negotiable && (
              <button onClick={() => setShowOffer(true)} className="btn-primary w-full">
                💬 {t('marketplace.makeOffer')}
              </button>
            )
          )
        )}
      </div>
    </div>
  );
}
