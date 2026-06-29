// frontend/src/utils/socket.js
// Socket.io client singleton. Connects once after login, reuses across components.

import { io } from 'socket.io-client';

let socket = null;

/**
 * Connect and return the singleton socket.
 * Safe to call multiple times — returns existing socket if already connected.
 * @param {string} userId - Authenticated user ID (sent in handshake auth)
 */
export function connectSocket(userId) {
  if (socket?.connected) return socket;

  const url = process.env.REACT_APP_API_URL || window.location.origin;

  socket = io(url, {
    auth:              { userId },
    transports:        ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    timeout:           20000,
  });

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[socket] connection error:', err.message);
  });

  return socket;
}

/** Disconnect and clear the singleton */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Get the current socket instance (may be null if not connected) */
export function getSocket() {
  return socket;
}

/** Join a section room */
export function joinSection(sectionId) {
  socket?.emit('join-section', sectionId);
}

/** Leave a section room */
export function leaveSection(sectionId) {
  socket?.emit('leave-section', sectionId);
}

/** Emit typing start indicator */
export function emitTypingStart(sectionId, displayName) {
  socket?.emit('typing-start', { sectionId, displayName });
}

/** Emit typing stop indicator */
export function emitTypingStop(sectionId) {
  socket?.emit('typing-stop', { sectionId });
}

/** Join a Live Q&A room */
export function joinQA(qaId) {
  socket?.emit('join-qa', qaId);
}

/** Leave a Live Q&A room */
export function leaveQA(qaId) {
  socket?.emit('leave-qa', qaId);
}
