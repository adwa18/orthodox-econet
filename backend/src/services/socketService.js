// backend/src/services/socketService.js
// Socket.io real-time event handling.
// The io instance is set from server.js after creation.
// Route handlers call emitNewPost(), emitNewReply(), etc. after DB writes.

/** @type {import('socket.io').Server} */
let io;

/**
 * Initialise the socket service.
 * @param {import('socket.io').Server} ioInstance
 */
function initSocket(ioInstance) {
  io = ioInstance;

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;

    if (userId) {
      // Join a personal room for targeted notifications
      socket.join(`user:${userId}`);
    }

    // ── Section chat rooms ───────────────────────────────────────────────────

    socket.on('join-section', (sectionId) => {
      if (typeof sectionId === 'string' && sectionId.length < 100) {
        socket.join(`section:${sectionId}`);
      }
    });

    socket.on('leave-section', (sectionId) => {
      socket.leave(`section:${sectionId}`);
    });

    // ── Typing indicator ─────────────────────────────────────────────────────
    // Debounce on the client side — server just broadcasts.

    socket.on('typing-start', ({ sectionId, displayName }) => {
      if (!sectionId || !displayName) return;
      socket.to(`section:${sectionId}`).emit('user-typing', {
        sectionId,
        displayName,
        socketId: socket.id,
      });
    });

    socket.on('typing-stop', ({ sectionId }) => {
      if (!sectionId) return;
      socket.to(`section:${sectionId}`).emit('user-stopped-typing', {
        sectionId,
        socketId: socket.id,
      });
    });

    // ── Live Q&A room ────────────────────────────────────────────────────────

    socket.on('join-qa', (qaId) => {
      if (typeof qaId === 'string') socket.join(`qa:${qaId}`);
    });

    socket.on('leave-qa', (qaId) => {
      socket.leave(`qa:${qaId}`);
    });

    // ── Cleanup ──────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      // Socket.io handles room cleanup automatically on disconnect
    });
  });
}

// ─── Emitters (called by route handlers) ──────────────────────────────────────

/**
 * Broadcast a new post to everyone in that section room.
 * @param {string} sectionId
 * @param {object} post - The post object to broadcast (should be serializable)
 */
function emitNewPost(sectionId, post) {
  if (!io) return;
  io.to(`section:${sectionId}`).emit('new-post', post);
}

/**
 * Broadcast a reply to everyone watching that post's section.
 * @param {string} sectionId
 * @param {string} parentPostId
 * @param {object} reply
 */
function emitNewReply(sectionId, parentPostId, reply) {
  if (!io) return;
  io.to(`section:${sectionId}`).emit('new-reply', { parentPostId, reply });
}

/**
 * Send a real-time notification to a specific user.
 * @param {string} userId
 * @param {object} notification - Notification payload
 */
function emitNotification(userId, notification) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification', notification);
}

/**
 * Broadcast a pinned announcement to all connected users (general)
 * or to a specific section room.
 * @param {object} announcement
 * @param {string|null} sectionId - null = broadcast to all
 */
function emitAnnouncement(announcement, sectionId = null) {
  if (!io) return;
  if (sectionId) {
    io.to(`section:${sectionId}`).emit('new-announcement', announcement);
  } else {
    io.emit('new-announcement', announcement); // Broadcast to all connected users
  }
}

/**
 * Notify a section room that a post was deleted/edited/moved by admin.
 * @param {string} sectionId
 * @param {string} postId
 * @param {'deleted'|'edited'|'moved'} action
 * @param {object} [data] - e.g. { newSectionId } for moves
 */
function emitPostModerated(sectionId, postId, action, data = {}) {
  if (!io) return;
  io.to(`section:${sectionId}`).emit('post-moderated', { postId, action, ...data });
}

/**
 * Broadcast a new Q&A question to the QA room.
 * @param {string} qaId
 * @param {object} question
 */
function emitQAQuestion(qaId, question) {
  if (!io) return;
  io.to(`qa:${qaId}`).emit('new-qa-question', question);
}

/**
 * Broadcast a Q&A answer to the QA room.
 * @param {string} qaId
 * @param {string} questionId
 * @param {string} answer
 */
function emitQAAnswer(qaId, questionId, answer) {
  if (!io) return;
  io.to(`qa:${qaId}`).emit('qa-answered', { questionId, answer });
}

module.exports = {
  initSocket,
  emitNewPost,
  emitNewReply,
  emitNotification,
  emitAnnouncement,
  emitPostModerated,
  emitQAQuestion,
  emitQAAnswer,
};
