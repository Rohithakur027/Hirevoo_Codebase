"use client"

import { SidebarProvider } from "@/context/SidebarContext"
import { SideBar } from "@/components/layout"

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <div className="flex h-screen bg-gray-50 overflow-hidden">
                <div className="hidden md:block">
                    <SideBar />
                </div>
                <div className="flex-1 flex flex-col overflow-hidden">
                    {children}
                </div>
            </div>
        </SidebarProvider>
    )
}
