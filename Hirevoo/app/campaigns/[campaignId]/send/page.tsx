'use client';

import { SideBar } from '@/components/layout/SideBar';
import { SidebarProvider } from '@/context/SidebarContext';
import { SendCampaignPage } from '@/components/campaigns/compose-ui';

export default function SendPage() {
  return (
    <SidebarProvider>
      <div className="h-screen bg-background flex overflow-hidden">
        {/* Sidebar - Always visible on desktop, can be collapsed */}
        <div className="hidden lg:block">
          <SideBar />
        </div>

        {/* Main Content - Full screen for SendCampaignPage */}
        <div className="flex-1 h-full">
          <SendCampaignPage />
        </div>
      </div>
    </SidebarProvider>
  );
}
