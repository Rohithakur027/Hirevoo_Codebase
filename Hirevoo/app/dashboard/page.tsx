"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { SidebarProvider } from "@/context/SidebarContext"
import { useRouter } from "next/navigation"

import { SideBar } from "@/components/layout"
import { BottomNav } from "@/components/layout/BottomNav"
import { CampaignTable } from "@/components/dashboard/CampaignTable"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Mail,
    TrendingUp,
    MessageSquare,
    Bell,
    ChevronDown,
    BarChart3,
    Package,
    User,
    Settings,
    LogOut,
    CheckCircle,
    X,
    Sparkles,
    Plus,
} from "lucide-react"



export default function Dashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const isLoadingSession = status === "loading"
    const user = session?.user
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [stats, setStats] = useState({
        totalOutreach: 0,
        totalOpened: 0,
        totalReplied: 0
    })
    const [chartData, setChartData] = useState<{ day: string, value: number }[]>([])
    const [isLoadingStats, setIsLoadingStats] = useState(true)
    const [statsError, setStatsError] = useState(false)

    // Check URL params for success messages
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const success = params.get('success')

        if (success === 'gmail_connected') {
            setSuccessMessage('Gmail connected successfully! You can now send email campaigns.')
            // Clear success message after 5 seconds
            setTimeout(() => setSuccessMessage(null), 5000)
            // Clean URL params
            window.history.replaceState({}, '', '/dashboard')
        }
    }, [])

    // Fetch dashboard stats
    useEffect(() => {
        const fetchStats = async () => {
            if (status !== 'authenticated') return

            try {
                setIsLoadingStats(true)
                const response = await fetch('/api/dashboard/stats')
                if (response.ok) {
                    const data = await response.json()
                    setStats(data.stats)
                    setChartData(data.chartData)
                } else {
                    setStatsError(true)
                }
            } catch (error) {
                console.error('Failed to fetch dashboard stats:', error)
                setStatsError(true)
            } finally {
                setIsLoadingStats(false)
            }
        }

        fetchStats()
    }, [status])

    const userInitials = user?.name
        ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
        : "NW"

    // Helper to format number
    const formatNumber = (num: number) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
        return num.toString()
    }

    return (
        <SidebarProvider>
            <div className="flex min-h-screen md:h-screen bg-gray-50 overflow-auto md:overflow-hidden flex-col md:flex-row pb-[60px] md:pb-0">

                {/* Left Sidebar - Desktop */}
                <div className="hidden md:block">
                    <SideBar />
                </div>

                {/* Main Content Area - Two Column Layout */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Success Message Banner */}
                    {successMessage && (
                        <div className="px-6 py-3 bg-green-50 border-b border-green-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-green-800">{successMessage}</span>
                            </div>
                            <button
                                onClick={() => setSuccessMessage(null)}
                                className="text-green-600 hover:text-green-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Header - Slimmer & Unified */}
                    <header className="flex items-start justify-between px-4 md:px-8 py-2 bg-gray-50 flex-shrink-0">
                        <div className="pt-1">
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-none">Dashboard</h1>
                            <p className="text-sm text-gray-500 font-medium mt-1">
                                {(() => {
                                    const date = new Date()
                                    const day = date.getDate()
                                    const month = date.toLocaleString('default', { month: 'short' })
                                    const year = date.getFullYear()

                                    const suffix = (day: number) => {
                                        if (day > 3 && day < 21) return 'th'
                                        switch (day % 10) {
                                            case 1: return "st"
                                            case 2: return "nd"
                                            case 3: return "rd"
                                            default: return "th"
                                        }
                                    }
                                    return `${day}${suffix(day)} ${month} ${year}`
                                })()}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="pl-4">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                            <div className="text-right hidden md:block">
                                                {isLoadingSession ? (
                                                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                                                ) : (
                                                    <p className="text-sm font-medium text-gray-800">{user?.name || "Guest User"}</p>
                                                )}
                                            </div>
                                            <Avatar className="w-8 h-8">
                                                <AvatarImage src={user?.image || "/placeholder.svg"} />
                                                <AvatarFallback>{userInitials}</AvatarFallback>
                                            </Avatar>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem className="cursor-pointer">
                                            <User className="w-4 h-4 mr-2" />
                                            Profile
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer">
                                            <Settings className="w-4 h-4 mr-2" />
                                            Settings
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="cursor-pointer text-red-600">
                                            <LogOut className="w-4 h-4 mr-2" />
                                            Log Out
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </header>

                    {/* Two Column Content */}
                    <div className="flex-1 flex flex-col md:flex-row overflow-auto md:overflow-hidden">
                        {/* Column 1 - Primary Content */}
                        <main className="flex-1 flex flex-col overflow-visible md:overflow-hidden px-4 md:px-8 pb-8 pt-2 gap-4">
                            {/* Stats Cards Row - converted to grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
                                {/* Total Outreach Card */}
                                <div className="rounded-[16px] p-4 h-[125px] flex flex-col justify-between" style={{ backgroundColor: "#cec4ff" }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                            <Mail className="w-3 h-3 text-violet-700" />
                                        </div>
                                        <span className="text-xs font-medium text-black">Total Outreach</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center flex-1">
                                        {isLoadingStats ? (
                                            <div className="h-6 w-16 bg-white/30 rounded animate-pulse" />
                                        ) : stats.totalOutreach === 0 ? (
                                            <p className="text-sm text-black/60">No Data to Display</p>
                                        ) : (
                                            <>
                                                <p className="text-2xl font-bold text-black">
                                                    {formatNumber(stats.totalOutreach)}
                                                </p>
                                                <p className="text-[10px] text-gray-600">From the running month</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Total Opened Card */}
                                <div className="rounded-[16px] p-4 h-[125px] flex flex-col justify-between" style={{ backgroundColor: "#aac9ff" }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                            <TrendingUp className="w-3 h-3 text-emerald-700" />
                                        </div>
                                        <span className="text-xs font-medium text-black">Total Opened</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center flex-1">
                                        {isLoadingStats ? (
                                            <div className="h-6 w-16 bg-white/30 rounded animate-pulse" />
                                        ) : stats.totalOpened === 0 ? (
                                            <p className="text-sm text-black/60">No Data to Display</p>
                                        ) : (
                                            <>
                                                <p className="text-2xl font-bold text-black">
                                                    {formatNumber(stats.totalOpened)}
                                                </p>
                                                <p className="text-[10px] text-gray-600">Daily Earnings of this month</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Total Replied Card */}
                                <div className="rounded-[16px] p-4 h-[125px] flex flex-col justify-between" style={{ backgroundColor: "#93e4b9" }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                            <MessageSquare className="w-3 h-3 text-amber-700" />
                                        </div>
                                        <span className="text-xs font-medium text-black">Total Replied</span>
                                    </div>
                                    <div className="flex flex-col items-center justify-center flex-1">
                                        {isLoadingStats ? (
                                            <div className="h-6 w-16 bg-white/30 rounded animate-pulse" />
                                        ) : stats.totalReplied === 0 ? (
                                            <p className="text-sm text-black/60">No Data to Display</p>
                                        ) : (
                                            <>
                                                <p className="text-2xl font-bold text-black">{stats.totalReplied}%</p>
                                                <p className="text-[10px] text-gray-600">+15.6% greater than last month</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Only: Recent Activity (Moved from Sidebar) */}
                            <div className="block md:hidden mb-6">
                                <RecentActivity />
                            </div>

                            {/* Chart Section & More Analysis - Grid Row */}
                            <div className="flex flex-col md:grid md:grid-cols-3 gap-4 flex-shrink-0 min-h-[150px]">
                                {/* Regular Sell Chart - Spans 2 columns - Hidden on Mobile */}
                                <div className="hidden md:flex col-span-2 bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex-col h-full min-h-[140px]">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-gray-800">Regular Sell</h3>
                                        <Button variant="outline" className="text-xs bg-transparent border-emerald-500 text-emerald-500 hover:bg-emerald-50 rounded-lg px-3 h-7">
                                            Export
                                        </Button>
                                    </div>
                                    {/* Chart Y-axis labels and bars */}
                                    <div className="flex gap-3 flex-1">
                                        {isLoadingStats ? (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="h-10 w-10 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin"></div>
                                            </div>
                                        ) : !chartData.some(d => d.value > 0) ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                                <BarChart3 className="w-8 h-8 mb-2 opacity-20" />
                                                <p className="text-sm">No Data Available</p>
                                                <p className="text-xs">No sales recorded this week.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-col justify-between text-xs text-gray-400">
                                                    <span>{Math.max(...chartData.map(d => d.value), 10)}</span>
                                                    <span>{Math.floor(Math.max(...chartData.map(d => d.value), 10) / 2)}</span>
                                                    <span>0</span>
                                                </div>
                                                <div className="flex-1 flex items-end justify-between gap-1">
                                                    {chartData.map((item) => (
                                                        <div key={item.day} className="flex flex-col items-center gap-1 flex-1">
                                                            <div
                                                                className="w-full max-w-6 bg-gradient-to-t from-emerald-400 to-emerald-300 rounded-t-md transition-all hover:from-emerald-500 hover:to-emerald-400"
                                                                style={{ height: `${(item.value / Math.max(...chartData.map(d => d.value), 1)) * 80}px`, minHeight: '4px' }}
                                                            />
                                                            <span className="text-xs text-gray-500">{item.day}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Create Campaign Section - Replaces More Analysis */}
                                <div className="col-span-1 md:pl-4 flex flex-col justify-between h-full">
                                    <div className="bg-white rounded-[16px] p-4 shadow-sm border border-gray-100 h-full flex flex-col justify-between min-h-[140px]">
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-800 mb-1">Let&apos;s get you hired.</h4>
                                            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                                Create a new outreach campaign to land your dream job.
                                            </p>
                                        </div>
                                        <Button
                                            className="text-xs font-medium rounded-[8px] text-white bg-black hover:bg-gray-800 h-9 px-4 w-full flex items-center justify-center"
                                            onClick={() => router.push('/campaigns/upload')}
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Create New Campaign
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Campaign Table - Expanded */}
                            <div className="flex-1 min-h-[400px] md:min-h-0">
                                <CampaignTable />
                            </div>
                        </main>

                        {/* Column 2 - Right Sidebar */}
                        <aside className="hidden md:flex w-full md:w-[300px] flex-col overflow-visible md:overflow-hidden flex-shrink-0 pt-2 md:pr-8 pb-8 px-4 md:pl-0 gap-4">
                            <RecentActivity />
                        </aside>
                    </div>
                </div>

                {/* Mobile Bottom Navigation */}
                <BottomNav />
            </div>
        </SidebarProvider>
    )
}
