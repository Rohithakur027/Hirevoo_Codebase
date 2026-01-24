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
    CheckCircle,
} from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/context/SidebarContext"
import { useSession } from "@/app/hooks/use-session"
import { useState, useEffect } from "react"
import ConnectGmailModal, { PermissionLevel } from "@/components/dashboard/ConnectGmailModal"
import { signOut } from "next-auth/react"

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Mail, label: "My Campaigns", href: "/campaigns" },
    { icon: FileText, label: "My Templates", href: "/templates" },
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: UserIcon, label: "Profile", href: "/profile" },
]

interface GmailStatusData {
    isConnected: boolean;
    permissionLevel: 'SEND_ONLY' | 'FULL_ACCESS' | null;
    email: string | null;
}

export function SideBar() {
    const pathname = usePathname()
    const { collapsed, toggleCollapsed } = useSidebar()
    const { user, isLoading } = useSession()
    const [isDisconnecting, setIsDisconnecting] = useState(false)
    const [isConnecting, setIsConnecting] = useState(false)
    const [gmailStatus, setGmailStatus] = useState<GmailStatusData>({
        isConnected: false,
        permissionLevel: null,
        email: null,
    })
    const [showConnectModal, setShowConnectModal] = useState(false)
    const userInitials = user?.name
        ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
        : "?"

    // Check Gmail connection status
    const checkGmailStatus = async () => {
        try {
            const response = await fetch('/api/auth/gmail/status')
            if (response.ok) {
                const data = await response.json()
                setGmailStatus({
                    isConnected: data.isConnected || false,
                    permissionLevel: data.permissionLevel || null,
                    email: data.email || null,
                })
            }
        } catch (error) {
            console.error('Error checking Gmail status:', error)
        }
    }

    // Handle Gmail connect/disconnect
    const handleGmailAction = async () => {
        if (gmailStatus.isConnected) {
            // Disconnect Gmail
            if (isDisconnecting) return

            try {
                setIsDisconnecting(true)
                const response = await fetch('/api/auth/gmail/disconnect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })

                if (response.ok) {
                    setGmailStatus({
                        isConnected: false,
                        permissionLevel: null,
                        email: null,
                    })
                } else {
                    const errorData = await response.json().catch(() => ({}))
                    console.error('Failed to disconnect Gmail:', errorData)
                    alert(`Failed to disconnect Gmail: ${errorData.error || 'Please try again.'}`)
                }
            } catch (error) {
                console.error('Error disconnecting Gmail:', error)
                alert('Error disconnecting Gmail. Please try again.')
            } finally {
                setIsDisconnecting(false)
            }
        } else {
            // Connect Gmail - open modal for permission selection
            setShowConnectModal(true)
        }
    }

    // Handle Gmail connection from modal
    const handleConnectGmail = async (permissionLevel: PermissionLevel) => {
        try {
            setIsConnecting(true)
            const response = await fetch('/api/auth/gmail/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    permissionLevel
                }),
            })

            if (response.ok) {
                const data = await response.json()
                // Close modal and redirect to Google OAuth
                setShowConnectModal(false)
                window.location.href = data.url
            } else {
                console.error('Failed to get Gmail connect URL')
                alert('Failed to connect Gmail. Please try again.')
            }
        } catch (error) {
            console.error('Error connecting Gmail:', error)
            alert('Error connecting Gmail. Please try again.')
        } finally {
            setIsConnecting(false)
        }
    }

    // Handle logout
    const handleLogout = async () => {
        await signOut({ callbackUrl: '/login' })
    }

    // Check Gmail status on component mount and periodically
    useEffect(() => {
        checkGmailStatus()

        // Check Gmail status every 30 seconds
        const interval = setInterval(checkGmailStatus, 30000)

        // Also check when the page becomes visible (user switches tabs)
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                checkGmailStatus()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            clearInterval(interval)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    // Truncate email for display
    const truncateEmail = (email: string | null, maxLength: number = 20) => {
        if (!email) return null
        if (email.length <= maxLength) return email
        const [localPart, domain] = email.split('@')
        if (localPart.length > maxLength - 5) {
            return `${localPart.substring(0, maxLength - 8)}...@${domain}`
        }
        return email
    }

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

            {/* Quick Actions - Gmail Connect/Disconnect */}
            <div className="px-3 py-2 flex-shrink-0">
                <button
                    onClick={handleGmailAction}
                    disabled={isDisconnecting || isConnecting}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors w-full rounded-sm",
                        gmailStatus.isConnected
                            ? "bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                            : "bg-black hover:bg-gray-800 text-white",
                        collapsed ? "justify-center px-2" : ""
                    )}
                >
                    {gmailStatus.isConnected ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <Mail className="w-4 h-4 flex-shrink-0" />
                    )}
                    {!collapsed && (
                        <span className="truncate">
                            {isDisconnecting
                                ? 'Disconnecting...'
                                : isConnecting
                                ? 'Connecting...'
                                : gmailStatus.isConnected
                                ? 'Gmail Connected'
                                : 'Connect Gmail'
                            }
                        </span>
                    )}
                </button>

                {/* Show connected email when expanded and connected */}
                {!collapsed && gmailStatus.isConnected && gmailStatus.email && (
                    <div className="mt-2 px-3">
                        <p className="text-xs text-gray-500 truncate" title={gmailStatus.email}>
                            {truncateEmail(gmailStatus.email)}
                        </p>
                        <button
                            onClick={handleGmailAction}
                            disabled={isDisconnecting}
                            className="text-xs text-red-500 hover:text-red-700 mt-1"
                        >
                            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                    </div>
                )}
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
                                    <p className="text-xs text-gray-500 truncate">{user?.email || "Not logged in"}</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {!collapsed && (
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 mt-4 text-sm text-gray-500 hover:text-gray-700"
                    >
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

            {/* Connect Gmail Modal */}
            <ConnectGmailModal
                isOpen={showConnectModal}
                onClose={() => setShowConnectModal(false)}
                onConnect={handleConnectGmail}
            />
        </aside>
    )
}
