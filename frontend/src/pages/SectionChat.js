// frontend/src/pages/SectionChat.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getSectionById } from '../utils/sections';
import { postsAPI } from '../utils/api';
import { joinSection, leaveSection, getSocket } from '../utils/socket';
import PostCard      from '../components/PostCard';
import ChatComposer  from '../components/ChatComposer';
import AnnouncementCard from '../components/AnnouncementCard';
import { broadcastAPI } from '../utils/api';
import { useQuery } from '@tanstack/react-query';

export default function SectionChat() {
  const { sectionId }  = useParams();
  const { i18n }       = useTranslation();
  const section        = getSectionById(sectionId);
  const bottomRef      = useRef(null);
  const listRef        = useRef(null);
  const [replyTo, setReplyTo]   = useState(null);
  const [typing, setTyping]     = useState('');
  const queryClient = useQueryClient();

  // ── Fetch paginated posts ─────────────────────────────────────────────────
  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey: ['posts', sectionId],
    queryFn:  ({ pageParam }) => postsAPI.list(sectionId, { cursor: pageParam, limit: 30 }).then((r) => r.data),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30000,
  });

  const posts = (data?.pages || []).flatMap((p) => p.posts).reverse();

  // ── Fetch pinned section announcements ────────────────────────────────────
  const { data: annoData } = useQuery({
    queryKey: ['announcements', sectionId],
    queryFn:  () => broadcastAPI.list({ type: 'section', sectionId, pinned: true }).then((r) => r.data),
    staleTime: 120000,
  });
  const pinnedAnnouncements = annoData?.announcements || [];

  // ── Socket.io — join room, listen for new posts ───────────────────────────
  useEffect(() => {
    joinSection(sectionId);
    const socket = getSocket();
    if (!socket) return;

    const handleNewPost = (post) => {
      queryClient.setQueryData(['posts', sectionId], (old) => {
        if (!old) return old;
        const firstPage = old.pages[0];
        return {
          ...old,
          pages: [{ ...firstPage, posts: [...firstPage.posts, post] }, ...old.pages.slice(1)],
        };
      });
      // Auto-scroll to bottom on new message
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleNewReply = ({ parentPostId, reply }) => {
      queryClient.invalidateQueries(['posts', sectionId]);
    };

    const handleTyping = ({ displayName }) => {
      setTyping(displayName);
      setTimeout(() => setTyping(''), 2500);
    };

    const handleModerated = ({ postId, action }) => {
      queryClient.invalidateQueries(['posts', sectionId]);
    };

    socket.on('new-post',       handleNewPost);
    socket.on('new-reply',      handleNewReply);
    socket.on('user-typing',    handleTyping);
    socket.on('post-moderated', handleModerated);

    return () => {
      leaveSection(sectionId);
      socket.off('new-post',       handleNewPost);
      socket.off('new-reply',      handleNewReply);
      socket.off('user-typing',    handleTyping);
      socket.off('post-moderated', handleModerated);
    };
  }, [sectionId, queryClient]);

  // ── Scroll to bottom on first load ───────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => bottomRef.current?.scrollIntoView(), 200);
    }
  }, [isLoading]);

  // ── Load more on scroll to top ────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    if (listRef.current.scrollTop < 60 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handlePosted = (post) => {
    queryClient.setQueryData(['posts', sectionId], (old) => {
      if (!old) return old;
      const firstPage = old.pages[0];
      return { ...old, pages: [{ ...firstPage, posts: [...firstPage.posts, post] }, ...old.pages.slice(1)] };
    });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    setReplyTo(null);
  };

  if (!section) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--tg-hint)' }}>
      Section not found
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--tg-bg)' }}>
      {/* Pinned announcements */}
      {pinnedAnnouncements.length > 0 && (
        <div className="px-4 pt-3 flex-shrink-0">
          {pinnedAnnouncements.map((a) => <AnnouncementCard key={a.id} announcement={a} />)}
        </div>
      )}

      {/* Posts list */}
      <div ref={listRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {/* Load more spinner */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-3">
            <div className="w-5 h-5 rounded-full border-2 border-tg-button border-t-transparent animate-spin" />
          </div>
        )}

        {/* Skeleton */}
        {isLoading && (
          <div className="px-4 pt-4 space-y-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-24 rounded" />
                  <div className="skeleton h-10 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Posts */}
        {!isLoading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2" style={{ color: 'var(--tg-hint)' }}>
            <span className="text-3xl">{section.emoji}</span>
            <p className="text-sm am">ምንም ፖስት የለም — ለመጀመሪያ ሁኑ!</p>
          </div>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} onReply={setReplyTo} />
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="px-4 py-2 text-xs am" style={{ color: 'var(--tg-hint)' }}>
            {typing} ይጽፋል...
          </div>
        )}

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Composer */}
      <ChatComposer
        sectionId={sectionId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onPosted={handlePosted}
      />
    </div>
  );
}
