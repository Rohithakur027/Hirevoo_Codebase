'use client';

import { SideBar } from '@/components/layout/SideBar';
import { SidebarProvider } from '@/context/SidebarContext';
import { useSession } from '@/app/hooks/use-session';

export default function SettingsPage() {
  const { user, isLoading } = useSession();

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "NW"

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f0f4f5" }}>
        {/* Left Sidebar */}
        <SideBar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-10 py-3 flex-shrink-0">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">Settings</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="pl-4">
                <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="text-right">
                    {isLoading ? (
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm font-medium text-gray-800">{user?.name || "Guest User"}</p>
                    )}
                  </div>
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">{userInitials}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-10">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold mb-6">Settings</h2>
              <p className="text-gray-600">Settings page coming soon...</p>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}