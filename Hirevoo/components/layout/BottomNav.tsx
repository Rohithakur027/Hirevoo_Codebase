"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Send, FileText, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
    const pathname = usePathname()

    const navItems = [
        {
            name: "Dashboard",
            href: "/dashboard",
            icon: Home,
            active: pathname === "/dashboard"
        },
        {
            name: "Campaigns",
            href: "/campaigns",
            icon: Send,
            active: pathname.startsWith("/campaigns")
        },
        {
            name: "Templates",
            href: "/templates",
            icon: FileText,
            active: pathname === "/templates"
        },
        {
            name: "Settings",
            href: "/settings",
            icon: Settings,
            active: pathname.startsWith("/settings")
        }
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 block md:hidden">
            <div className="flex items-center justify-around h-[60px] pb-1">
                {navItems.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center p-2 flex-1 h-full",
                            item.active ? "text-black" : "text-gray-400 hover:text-gray-600"
                        )}
                    >
                        <item.icon className={cn("w-5 h-5 mb-1", item.active && "fill-current")} />
                        <span className="text-[10px] font-medium">{item.name}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
