// frontend/src/components/Layout.js
import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopBar    from './TopBar';
import Sidebar   from './Sidebar';
import BottomNav from './BottomNav';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Pages that hide the bottom nav (full-screen chat experience)
  const hideBottomNav = location.pathname.startsWith('/section/') ||
                        location.pathname.startsWith('/admin');

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--tg-bg)' }}>
      {/* Top bar */}
      <TopBar onMenuOpen={() => setSidebarOpen(true)} />

      {/* Sidebar overlay */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Outlet />
      </main>

      {/* Bottom navigation */}
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
