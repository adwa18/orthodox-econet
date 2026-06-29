// frontend/src/pages/MyFeed.js
// Chronological merged feed of all 16 sections.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import { postsAPI } from '../utils/api';
import PostCard from '../components/PostCard';
import { getSectionById } from '../utils/sections';

export default function MyFeed() {
  const { t, i18n } = useTranslation();
  const navigate     = useNavigate();

  // We fetch from all sections in parallel and merge — simplified approach
  // In production you'd want a dedicated /api/feed endpoint
  const SECTION_IDS = [
    'spiritual-life','business-directory','import-export','education-training',
    'logistics-supply','jobs-careers','it-software','health-wellness',
    'marketplace-b2c','banking-finance','tenders-bids','engineering-arch',
    'legal-property','trust-safety','business-development','healthcare-community',
  ];

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn:  async ({ pageParam = null }) => {
      const results = await Promise.all(
        SECTION_IDS.map((id) => postsAPI.list(id, { cursor: pageParam, limit: 5 }).then((r) => r.data.posts))
      );
      const merged = results.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { posts: merged.slice(0, 30), nextCursor: merged[29]?.id || null };
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60000,
  });

  const posts = (data?.pages || []).flatMap((p) => p.posts);

  return (
    <div className="page">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-base font-bold am" style={{ color: 'var(--tg-text)' }}>{t('nav.feed')}</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--tg-hint)' }}>ከሁሉም ክፍሎች</p>
      </div>

      {isLoading && (
        <div className="px-4 space-y-4 pt-2">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      )}

      {posts.map((post) => {
        const sec = getSectionById(post.sectionId);
        return (
          <div key={post.id}>
            {sec && (
              <button onClick={() => navigate(`/section/${sec.id}`)}
                      className="w-full flex items-center gap-1.5 px-4 py-1.5 text-xs"
                      style={{ color: sec.color, background: `${sec.color}0a` }}>
                <span>{sec.emoji}</span>
                <span>{i18n.language === 'am' ? sec.amharic : sec.english}</span>
              </button>
            )}
            <PostCard post={post} />
          </div>
        );
      })}

      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                className="w-full py-4 text-sm" style={{ color: 'var(--tg-hint)' }}>
          {isFetchingNextPage ? '...' : t('common.more')}
        </button>
      )}
    </div>
  );
}
