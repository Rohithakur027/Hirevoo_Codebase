'use client';

import { SideBar } from '@/components/layout/SideBar';
import { SidebarProvider } from '@/context/SidebarContext';
import { ComposeReviewPage } from '@/components/campaigns/compose-ui';

export default function ComposePage() {
  return (
    <SidebarProvider>
      <div className="h-screen bg-background flex overflow-hidden">
        {/* Sidebar - Always visible on desktop, can be collapsed */}
        <div className="hidden lg:block">
          <SideBar />
        </div>

        {/* Main Content - Full screen for ComposeReviewPage */}
        <div className="flex-1 h-full">
          <ComposeReviewPage />
        </div>
      </div>
    </SidebarProvider>
  );
}
