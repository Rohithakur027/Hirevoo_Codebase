'use client';

import { ReactNode } from 'react';
import { SideBar } from './Sidebar';
import { useSidebar } from '@/context/SidebarContext';

interface DashboardLayoutProps {
  children: ReactNode;
  fullScreen?: boolean;
}

export function DashboardLayout({ children, fullScreen = false }: DashboardLayoutProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar - Always visible on desktop, can be collapsed */}
      <div className="hidden lg:block">
        <SideBar />
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-60'} ${fullScreen ? 'h-full' : ''}`}>
        {/* Page Content */}
        <main className={`h-full ${fullScreen ? "" : "p-4 sm:p-5"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
