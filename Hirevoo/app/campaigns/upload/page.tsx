'use client';

import { SideBar } from '@/components/layout/SideBar';
import { SidebarProvider } from '@/context/SidebarContext';
import UploadContacts from '@/components/campaigns/contactuploader/ContactUploader';

export default function UploadContactsPage() {
  return (
    <SidebarProvider>
      <div className="h-screen bg-background flex overflow-hidden">
        {/* Sidebar - Always visible on desktop, can be collapsed */}
        <div className="hidden lg:block">
          <SideBar />
        </div>

        {/* Main Content - Full screen for ContactUploader */}
        <div className="flex-1 h-full">
          <UploadContacts />
        </div>
      </div>
    </SidebarProvider>
  );
}