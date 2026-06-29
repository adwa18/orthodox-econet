// frontend/src/App.js
// Root router. Handles auth state and renders the correct screen.

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuthStore from './context/authStore';

// Layout
import Layout from './components/Layout';

// Public / auth screens
import Registration  from './pages/Registration';
import BannedScreen  from './pages/BannedScreen';
import Recovery      from './pages/Recovery';

// Lazy-load all other pages to reduce initial bundle size
const WelcomeScreen      = React.lazy(() => import('./pages/WelcomeScreen'));
const Home               = React.lazy(() => import('./pages/Home'));
const MyFeed             = React.lazy(() => import('./pages/MyFeed'));
const SectionChat        = React.lazy(() => import('./pages/SectionChat'));
const Marketplace        = React.lazy(() => import('./pages/Marketplace'));
const MarketplaceDetail  = React.lazy(() => import('./pages/MarketplaceDetail'));
const Mentorship         = React.lazy(() => import('./pages/Mentorship'));
const LiveQA             = React.lazy(() => import('./pages/LiveQA'));
const Polls              = React.lazy(() => import('./pages/Polls'));
const Bookings           = React.lazy(() => import('./pages/Bookings'));
const ProfessionalApply  = React.lazy(() => import('./pages/ProfessionalApply'));
const Profile            = React.lazy(() => import('./pages/Profile'));
const Notifications      = React.lazy(() => import('./pages/Notifications'));
const Donations          = React.lazy(() => import('./pages/Donations'));

// Admin pages
const AdminDashboard       = React.lazy(() => import('./pages/admin/AdminDashboard'));
const AdminVerifications   = React.lazy(() => import('./pages/admin/AdminVerifications'));
const AdminPosts           = React.lazy(() => import('./pages/admin/AdminPosts'));
const AdminUsers           = React.lazy(() => import('./pages/admin/AdminUsers'));
const AdminBroadcast       = React.lazy(() => import('./pages/admin/AdminBroadcast'));
const AdminOverview        = React.lazy(() => import('./pages/admin/AdminOverview'));
const AdminReports         = React.lazy(() => import('./pages/admin/AdminReports'));
const AdminProfessionalApps= React.lazy(() => import('./pages/admin/AdminProfessionalApps'));
const AdminDonations       = React.lazy(() => import('./pages/admin/AdminDonations'));
const AdminSettings        = React.lazy(() => import('./pages/admin/AdminSettings'));

// ─── Suspense fallback ─────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--tg-bg)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-tg-button border-t-transparent animate-spin" />
    </div>
  );
}

// ─── Auth guard — wraps all authenticated routes ───────────────────────────
function RequireAuth({ children }) {
  const { status, banInfo } = useAuthStore();

  if (status === 'loading' || status === 'idle') return <PageLoader />;
  if (status === 'banned')          return <BannedScreen banInfo={banInfo} />;
  if (status === 'unverified')      return <Navigate to="/pending" replace />;
  if (status === 'declined')        return <Navigate to="/declined" replace />;
  if (status !== 'authenticated')   return <Navigate to="/register" replace />;
  return children;
}

// ─── Admin guard ───────────────────────────────────────────────────────────
function RequireAdmin({ children }) {
  const { user } = useAuthStore();
  const isAdmin = ['MODERATOR','SENIOR_ADMIN','OWNER'].includes(user?.role);
  return isAdmin ? children : <Navigate to="/" replace />;
}

// ─── Offline banner ────────────────────────────────────────────────────────
function OfflineBanner() {
  const [offline, setOffline] = React.useState(!navigator.onLine);
  const { t } = useTranslation();

  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white"
         style={{ background: 'var(--tg-warning)' }}>
      ⚠️ {t('common.offline')}
    </div>
  );
}

// ─── Auth initialiser ──────────────────────────────────────────────────────
function AuthInit() {
  const { rehydrate, login, status } = useAuthStore();

  useEffect(() => {
    const tg       = window.Telegram?.WebApp;
    const initData = tg?.initData;

    if (initData && status === 'idle') {
      // Attempt login with Telegram initData
      login(initData);
    } else if (!initData && status === 'idle') {
      // No Telegram context (dev mode) — try token rehydration
      rehydrate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ─── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthInit />
      <OfflineBanner />
      <React.Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="/register" element={<Registration />} />
          <Route path="/recovery" element={<Recovery />} />
          <Route path="/banned"   element={<BannedScreen />} />

          {/* ── Pending / declined status pages ── */}
          <Route path="/pending"  element={
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center" style={{ background: 'var(--tg-bg)' }}>
              <div className="text-4xl">⏳</div>
              <p className="text-tg-text font-medium">ምዝገባዎ ለግምገማ ቀርቧል።</p>
              <p className="text-tg-hint text-sm">Your registration is pending admin review.</p>
            </div>
          } />
          <Route path="/declined" element={
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center" style={{ background: 'var(--tg-bg)' }}>
              <div className="text-4xl">❌</div>
              <p className="text-tg-text font-medium">ምዝገባዎ አልተቀበለም።</p>
              <p className="text-tg-hint text-sm">Your registration was not approved. Contact support.</p>
            </div>
          } />

          {/* ── Authenticated routes (wrapped in Layout) ── */}
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/"                    element={<Home />} />
            <Route path="/welcome"             element={<WelcomeScreen />} />
            <Route path="/feed"                element={<MyFeed />} />
            <Route path="/section/:sectionId"  element={<SectionChat />} />
            <Route path="/marketplace"         element={<Marketplace />} />
            <Route path="/marketplace/:id"     element={<MarketplaceDetail />} />
            <Route path="/mentorship"          element={<Mentorship />} />
            <Route path="/liveqa"              element={<LiveQA />} />
            <Route path="/polls"               element={<Polls />} />
            <Route path="/bookings"            element={<Bookings />} />
            <Route path="/professional/apply"  element={<ProfessionalApply />} />
            <Route path="/profile"             element={<Profile />} />
            <Route path="/profile/:id"         element={<Profile />} />
            <Route path="/notifications"       element={<Notifications />} />
            <Route path="/donate"              element={<Donations />} />

            {/* Admin routes */}
            <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
            <Route path="/admin/verifications" element={<RequireAdmin><AdminVerifications /></RequireAdmin>} />
            <Route path="/admin/posts"         element={<RequireAdmin><AdminPosts /></RequireAdmin>} />
            <Route path="/admin/users"         element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
            <Route path="/admin/broadcast"     element={<RequireAdmin><AdminBroadcast /></RequireAdmin>} />
            <Route path="/admin/overview"      element={<RequireAdmin><AdminOverview /></RequireAdmin>} />
            <Route path="/admin/reports"       element={<RequireAdmin><AdminReports /></RequireAdmin>} />
            <Route path="/admin/professional-apps" element={<RequireAdmin><AdminProfessionalApps /></RequireAdmin>} />
            <Route path="/admin/donations"     element={<RequireAdmin><AdminDonations /></RequireAdmin>} />
            <Route path="/admin/settings"      element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}
