// frontend/src/utils/api.js
// Axios instance. Automatically attaches JWT and handles 401s.

import axios from 'axios';

const api = axios.create({
  // Empty baseURL = same origin (works in production where Express serves React).
  // In development, package.json "proxy" forwards /api to localhost:10000.
  baseURL: process.env.REACT_APP_API_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — attach JWT ────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Response interceptor — handle 401 ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear and redirect to re-auth
      localStorage.removeItem('token');
      // The Zustand store's rehydration logic will detect missing token and show auth screen
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  },
);

export default api;

// ─── Typed API helpers ────────────────────────────────────────────────────────

/** Auth */
export const authAPI = {
  login:           (initData)             => api.post('/api/auth', { initData }),
  register:        (data)                 => api.post('/api/auth/register', data),
  request2FA:      ()                     => api.post('/api/auth/2fa/request'),
  verify2FA:       (code)                 => api.post('/api/auth/2fa/verify', { code }),
  requestRecovery: (data)                 => api.post('/api/auth/recovery/request', data),
  verifyRecovery:  (data)                 => api.post('/api/auth/recovery/verify', data),
};

/** Users */
export const usersAPI = {
  me:           ()               => api.get('/api/users/me'),
  myStats:      ()               => api.get('/api/users/me/stats'),
  updateMe:     (data)           => api.put('/api/users/me', data),
  getUser:      (id)             => api.get(`/api/users/${id}`),
  endorse:      (id, text)       => api.post(`/api/users/${id}/endorse`, { text }),
  unendorse:    (id)             => api.delete(`/api/users/${id}/endorse`),
};

/** Posts */
export const postsAPI = {
  list:      (sectionId, params) => api.get(`/api/posts/${sectionId}`, { params }),
  create:    (formData)          => api.post('/api/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  edit:      (id, content)       => api.put(`/api/posts/${id}`, { content }),
  react:     (id, type)          => api.post(`/api/posts/${id}/react`, { type }),
  replies:   (id, params)        => api.get(`/api/posts/${id}/replies`, { params }),
  report:    (id, reason, details) => api.post(`/api/posts/${id}/report`, { reason, details }),
  view:      (id)                => api.post(`/api/posts/${id}/view`),
};

/** Broadcast */
export const broadcastAPI = {
  list:   (params) => api.get('/api/broadcast', { params }),
  create: (formData) => api.post('/api/broadcast', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  pin:    (id, pin)  => api.put(`/api/broadcast/${id}/pin`, { pin }),
  edit:   (id, data) => api.put(`/api/broadcast/${id}`, data),
  remove: (id)       => api.delete(`/api/broadcast/${id}`),
};

/** Notifications */
export const notificationsAPI = {
  list:        (params) => api.get('/api/notifications', { params }),
  unreadCount: ()       => api.get('/api/notifications/unread-count'),
  markRead:    (id)     => api.put(`/api/notifications/${id}/read`),
  markAllRead: ()       => api.put('/api/notifications/read-all'),
};

/** Marketplace */
export const marketplaceAPI = {
  list:        (params) => api.get('/api/marketplace', { params }),
  get:         (id)     => api.get(`/api/marketplace/${id}`),
  create:      (fd)     => api.post('/api/marketplace', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:      (id, d)  => api.put(`/api/marketplace/${id}`, d),
  makeOffer:   (id, d)  => api.post(`/api/marketplace/${id}/offer`, d),
  respondOffer:(id, status) => api.put(`/api/marketplace/offers/${id}`, { status }),
};

/** Mentorship */
export const mentorshipAPI = {
  mentors:        (params) => api.get('/api/mentorship/mentors', { params }),
  register:       (data)   => api.post('/api/mentorship/register', data),
  request:        (data)   => api.post('/api/mentorship/request', data),
  myMatches:      (role)   => api.get('/api/mentorship/matches', { params: { role } }),
  updateMatch:    (id, d)  => api.put(`/api/mentorship/matches/${id}`, d),
};

/** Polls */
export const pollsAPI = {
  list:   (params) => api.get('/api/polls', { params }),
  create: (data)   => api.post('/api/polls', data),
  vote:   (id, optionIds) => api.post(`/api/polls/${id}/vote`, { optionIds }),
  cancel: (id)     => api.delete(`/api/polls/${id}`),
};

/** Live Q&A */
export const qaAPI = {
  list:     (params) => api.get('/api/liveqa', { params }),
  create:   (data)   => api.post('/api/liveqa', data),
  get:      (id)     => api.get(`/api/liveqa/${id}`),
  question: (id, d)  => api.post(`/api/liveqa/${id}/questions`, d),
  upvote:   (qaId, qid) => api.post(`/api/liveqa/${qaId}/questions/${qid}/upvote`),
  answer:   (qaId, qid, answer) => api.put(`/api/liveqa/${qaId}/questions/${qid}/answer`, { answer }),
  setStatus:(id, status) => api.put(`/api/liveqa/${id}/status`, { status }),
};

/** Bookings */
export const bookingsAPI = {
  list:       (params) => api.get('/api/bookings', { params }),
  create:     (data)   => api.post('/api/bookings', data),
  setStatus:  (id, status, notes) => api.put(`/api/bookings/${id}/status`, { status, professionalNotes: notes }),
};

/** Professional */
export const professionalAPI = {
  apply:     (fd)     => api.post('/api/professional/apply', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  directory: (params) => api.get('/api/professional/directory', { params }),
  myProfile: ()       => api.get('/api/professional/me'),
};

/** Donations */
export const donationsAPI = {
  paymentInfo: ()   => api.get('/api/donations/payment-info'),
  submit:      (fd) => api.post('/api/donations', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  mine:        ()   => api.get('/api/donations/mine'),
};

/** Admin */
export const adminAPI = {
  verifications:    (params) => api.get('/api/admin/verifications', { params }),
  verify:           (id)     => api.put(`/api/admin/verifications/${id}/verify`),
  decline:          (id, reason) => api.put(`/api/admin/verifications/${id}/decline`, { reason }),
  allPosts:         (params) => api.get('/api/admin/posts', { params }),
  editPost:         (id, content) => api.put(`/api/admin/posts/${id}`, { content }),
  deletePost:       (id, reason)  => api.delete(`/api/admin/posts/${id}`, { data: { reason } }),
  restorePost:      (id)     => api.put(`/api/admin/posts/${id}/restore`),
  movePost:         (id, targetSectionId) => api.put(`/api/admin/posts/${id}/move`, { targetSectionId }),
  users:            (params) => api.get('/api/admin/users', { params }),
  warn:             (id, message) => api.post(`/api/admin/users/${id}/warn`, { message }),
  ban:              (id, data)    => api.post(`/api/admin/users/${id}/ban`, data),
  unban:            (id, reason)  => api.post(`/api/admin/users/${id}/unban`, { reason }),
  banHistory:       (id)     => api.get(`/api/admin/users/${id}/ban-history`),
  addAdmin:         (userId, role) => api.post('/api/admin/admins', { userId, role }),
  removeAdmin:      (id)     => api.delete(`/api/admin/admins/${id}`),
  auditLog:         (params) => api.get('/api/admin/audit-log', { params }),
  overview:         ()       => api.get('/api/admin/overview'),
  reports:          (params) => api.get('/api/admin/reports', { params }),
  resolveReport:    (id, resolution) => api.put(`/api/admin/reports/${id}/resolve`, { resolution }),
  dismissReport:    (id)     => api.put(`/api/admin/reports/${id}/dismiss`),
  assignBadge:      (userId, type, note) => api.post('/api/admin/badges', { userId, type, note }),
  removeBadge:      (id)     => api.delete(`/api/admin/badges/${id}`),
  proApps:          (params) => api.get('/api/admin/professional-apps', { params }),
  verifyPro:        (id)     => api.put(`/api/admin/professional-apps/${id}/verify`),
  donations:        (params) => api.get('/api/admin/donations', { params }),
  confirmDonation:  (id, notes) => api.put(`/api/admin/donations/${id}/confirm`, { notes }),
  exportUsers:      ()       => api.get('/api/admin/users/export', { responseType: 'blob' }),
  exportDonations:  ()       => api.get('/api/admin/donations/export', { responseType: 'blob' }),
};

/** Settings */
export const settingsAPI = {
  all:    ()        => api.get('/api/settings'),
  update: (key, value) => api.put(`/api/settings/${key}`, { value }),
};
