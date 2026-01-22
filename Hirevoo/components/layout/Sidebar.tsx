"use client"

import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Mail,
    FileText,
    Settings,
    UserIcon,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Plus,
} from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/context/SidebarContext"
import { useSession } from "@/app/hooks/use-session"

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Mail, label: "My Campaigns", href: "/campaigns" },
    { icon: FileText, label: "My Templates", href: "/templates" },
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: UserIcon, label: "Profile", href: "/profile" },
]

export function SideBar() {
    const pathname = usePathname()
    const { collapsed, toggleCollapsed } = useSidebar()
    const { user, isLoading } = useSession()
    const userInitials = user?.name
        ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
        : "?"

    return (
        <aside
            className={cn(
                "flex flex-col bg-white border-r border-gray-100 h-screen transition-all duration-300 relative flex-shrink-0",
                collapsed ? "w-20" : "w-60"
            )}
        >
            {/* Logo */}
            <div className="flex items-center gap-2 px-5 py-6 flex-shrink-0">
                <div className="flex items-center justify-center w-8 h-8">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-emerald-500" fill="currentColor">
                        <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
                    </svg>
                </div>
                {!collapsed && (
                    <span className="text-xl font-semibold text-gray-800">Hirevoo</span>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 overflow-hidden">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                        return (
                            <li key={item.label}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                                        isActive
                                            ? "text-black"
                                            : "text-gray-600 hover:bg-gray-100"
                                    )}
                                    style={isActive ? { backgroundColor: "#cef562" } : undefined}
                                >
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && <span>{item.label}</span>}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            {/* Quick Actions */}
            <div className="px-3 py-2 flex-shrink-0">
                <Link
                    href="/campaigns/new"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors bg-emerald-500 hover:bg-emerald-600 text-white w-full justify-center",
                        collapsed ? "px-2" : ""
                    )}
                >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>New Campaign</span>}
                </Link>
            </div>

            {/* User Profile */}
            <div className="px-3 py-4 border-t border-gray-100 flex-shrink-0">
                <div className={cn(
                    "flex items-center gap-3",
                    collapsed ? "justify-center" : ""
                )}>
                    <Avatar className="w-10 h-10">
                        <AvatarImage src={user?.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            {isLoading ? (
                                <div className="space-y-1">
                                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                                    <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm font-medium text-gray-800 truncate">{user?.name || "Guest"}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.role || "No Role"}</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {!collapsed && (
                    <button className="flex items-center gap-2 mt-4 text-sm text-gray-500 hover:text-gray-700">
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                    </button>
                )}
            </div>

            {/* Collapse Toggle */}
            <button
                onClick={toggleCollapsed}
                className="absolute right-2 top-8 w-6 h-6 bg-gray-100 border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-200 z-50"
            >
                {collapsed ? (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                ) : (
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                )}
            </button>
        </aside>
    )
}
