// frontend/src/pages/Marketplace.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, Plus, SlidersHorizontal } from 'lucide-react';
import { marketplaceAPI } from '../utils/api';

const CATS = ['products','services','real_estate','vehicles','electronics','food','books','clothing','other'];

function ListingCard({ listing, onClick }) {
  const { t } = useTranslation();
  return (
    <button onClick={onClick} className="card p-3 text-left w-full active:opacity-70 transition-opacity">
      {listing.images?.[0] && (
        <img src={listing.images[0].url} alt={listing.title}
             className="w-full h-36 object-cover rounded-lg mb-2" loading="lazy" />
      )}
      <p className="text-sm font-semibold am line-clamp-2" style={{ color: 'var(--tg-text)' }}>{listing.title}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-sm font-bold" style={{ color: 'var(--tg-button)' }}>
          {parseFloat(listing.price).toLocaleString()} {listing.currency}
        </span>
        {listing.negotiable && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--tg-secondary-bg)', color: 'var(--tg-hint)' }}>
            {t('marketplace.negotiable')}
          </span>
        )}
      </div>
      {listing.location && <p className="text-xs mt-0.5 am" style={{ color: 'var(--tg-hint)' }}>📍 {listing.location}</p>}
      <div className="flex items-center gap-1.5 mt-1.5">
        {listing.seller?.telegramPhotoUrl && (
          <img src={listing.seller.telegramPhotoUrl} alt="" className="w-4 h-4 rounded-full" />
        )}
        <p className="text-xs am" style={{ color: 'var(--tg-hint)' }}>{listing.seller?.fullName}</p>
      </div>
    </button>
  );
}

export default function Marketplace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ]               = useState('');
  const [category, setCategory] = useState('');
  const [showFilter, setFilter] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['marketplace', q, category],
    queryFn:  ({ pageParam }) => marketplaceAPI.list({ q: q || undefined, category: category || undefined, cursor: pageParam, limit: 20 }).then((r) => r.data),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const listings = (data?.pages || []).flatMap((p) => p.listings);

  return (
    <div className="page">
      {/* Search bar */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3" style={{ background: 'var(--tg-secondary-bg)' }}>
          <Search size={16} style={{ color: 'var(--tg-hint)' }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('marketplace.search')}
                 className="flex-1 bg-transparent py-2.5 text-sm outline-none am" style={{ color: 'var(--tg-text)' }} />
        </div>
        <button onClick={() => setFilter((v) => !v)} className="p-2.5 rounded-xl" style={{ background: 'var(--tg-secondary-bg)' }}>
          <SlidersHorizontal size={18} style={{ color: showFilter ? 'var(--tg-button)' : 'var(--tg-hint)' }} />
        </button>
        <button onClick={() => navigate('/marketplace/new')} className="p-2.5 rounded-xl" style={{ background: 'var(--tg-button)' }}>
          <Plus size={18} style={{ color: 'var(--tg-button-text)' }} />
        </button>
      </div>

      {/* Category filter */}
      {showFilter && (
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
          <button onClick={() => setCategory('')}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: !category ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: !category ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
            {t('common.all')}
          </button>
          {CATS.map((c) => (
            <button key={c} onClick={() => setCategory(c === category ? '' : c)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium capitalize"
                    style={{ background: category === c ? 'var(--tg-button)' : 'var(--tg-secondary-bg)', color: category === c ? 'var(--tg-button-text)' : 'var(--tg-hint)' }}>
              {t(`marketplace.categories.${c}`)}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="px-4 pb-6 grid grid-cols-2 gap-3">
        {isLoading && [1,2,3,4].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
        {listings.map((l) => <ListingCard key={l.id} listing={l} onClick={() => navigate(`/marketplace/${l.id}`)} />)}
        {!isLoading && listings.length === 0 && (
          <div className="col-span-2 text-center py-16" style={{ color: 'var(--tg-hint)' }}>
            <p className="text-3xl mb-2">🛒</p>
            <p className="text-sm am">{t('common.empty')}</p>
          </div>
        )}
      </div>
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                className="w-full py-4 text-sm" style={{ color: 'var(--tg-hint)' }}>
          {isFetchingNextPage ? '...' : t('common.more')}
        </button>
      )}
    </div>
  );
}
