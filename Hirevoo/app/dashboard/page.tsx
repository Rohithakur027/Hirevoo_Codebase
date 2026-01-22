"use client"

import { useSession } from "../hooks/use-session"
import { SidebarProvider } from "@/context/SidebarContext"

import { SideBar } from "@/components/layout"
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
} from "lucide-react"

// Mock data - replace with actual data source
const stats = {
    totalOutreach: 242650,
    totalOpened: 17347,
    totalReplied: 74.86,
}

const chartData = [
    { day: "Sun", value: 20 },
    { day: "Mon", value: 35 },
    { day: "Tue", value: 45 },
    { day: "Wed", value: 30 },
    { day: "Thu", value: 50 },
    { day: "Fri", value: 25 },
    { day: "Sat", value: 40 },
]

// Mock Gmail connection status - replace with actual auth logic
const isGmailConnected = false

export default function Dashboard() {
    const { user, isLoading } = useSession()

    const userInitials = user?.name
        ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
        : "NW"

    return (
        <SidebarProvider>
            <div className="flex h-screen bg-gray-50 overflow-hidden">
                {/* Left Sidebar */}
                <SideBar />

            {/* Main Content Area - Two Column Layout */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header - Slimmer */}
                <header className="flex items-center justify-between px-6 py-2 bg-white border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h1 className="text-lg font-semibold text-gray-800">Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="pl-4">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                        <div className="text-right">
                                            {isLoading ? (
                                                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                                            ) : (
                                                <p className="text-sm font-medium text-gray-800">{user?.name || "Guest User"}</p>
                                            )}
                                        </div>
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={user?.avatar || "/placeholder.svg"} />
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
                <div className="flex-1 flex overflow-hidden">
                    {/* Column 1 - Primary Content */}
                    <main className="flex-1 flex flex-col overflow-hidden p-8 gap-6">
                        {/* Stats Cards Row */}
                        <div className="flex gap-4 flex-shrink-0">
                            {/* Total Outreach Card */}
                            <div className="flex-1 rounded-xl p-4 h-[100px] flex flex-col justify-between" style={{ backgroundColor: "#cec4ff" }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                        <Mail className="w-3 h-3 text-violet-700" />
                                    </div>
                                    <span className="text-xs font-medium text-black">Total Outreach</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-2xl font-bold text-black">
                                        {(stats.totalOutreach / 1000).toFixed(2)}K
                                    </p>
                                    <p className="text-[10px] text-gray-600">From the running month</p>
                                </div>
                            </div>

                            {/* Total Opened Card */}
                            <div className="flex-1 rounded-xl p-4 h-[100px] flex flex-col justify-between" style={{ backgroundColor: "#aac9ff" }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                        <TrendingUp className="w-3 h-3 text-emerald-700" />
                                    </div>
                                    <span className="text-xs font-medium text-black">Total Opened</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-2xl font-bold text-black">
                                        {(stats.totalOpened / 1000).toFixed(3)}K
                                    </p>
                                    <p className="text-[10px] text-gray-600">Daily Earnings of this month</p>
                                </div>
                            </div>

                            {/* Total Replied Card */}
                            <div className="flex-1 rounded-xl p-4 h-[100px] flex flex-col justify-between" style={{ backgroundColor: "#93e4b9" }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                        <MessageSquare className="w-3 h-3 text-amber-700" />
                                    </div>
                                    <span className="text-xs font-medium text-black">Total Replied</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <p className="text-2xl font-bold text-black">{stats.totalReplied}%</p>
                                    <p className="text-[10px] text-gray-600">+15.6% greater than last month</p>
                                </div>
                            </div>
                        </div>

                        {/* Chart Section - Reduced Height */}
                        <div className="flex gap-4 flex-shrink-0 h-[150px]">
                            {/* Regular Sell Chart */}
                            <div className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-gray-800">Regular Sell</h3>
                                    <Button variant="outline" className="text-xs bg-transparent border-emerald-500 text-emerald-500 hover:bg-emerald-50 rounded-lg px-3 h-7">
                                        Export
                                    </Button>
                                </div>
                                {/* Chart Y-axis labels and bars */}
                                <div className="flex gap-3 flex-1">
                                    <div className="flex flex-col justify-between text-xs text-gray-400">
                                        <span>50k</span>
                                        <span>30</span>
                                        <span>10</span>
                                    </div>
                                    <div className="flex-1 flex items-end justify-between gap-1">
                                        {chartData.map((item) => (
                                            <div key={item.day} className="flex flex-col items-center gap-1 flex-1">
                                                <div
                                                    className="w-full max-w-6 bg-gradient-to-t from-emerald-400 to-emerald-300 rounded-t-md transition-all hover:from-emerald-500 hover:to-emerald-400"
                                                    style={{ height: `${item.value * 1.5}px` }}
                                                />
                                                <span className="text-xs text-gray-500">{item.day}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* More Analysis Section */}
                            <div className="w-56 p-4 flex flex-col">
                                <h3 className="text-sm font-semibold text-gray-800 mb-1">More Analysis</h3>
                                <p className="text-xs text-gray-400 mb-2">There are more to view</p>
                                <div className="space-y-3 flex-1">
                                    <button className="w-full flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 bg-emerald-100 rounded-md flex items-center justify-center">
                                                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                                            </div>
                                            <span className="text-xs font-medium text-gray-700">Campaign Analytics</span>
                                        </div>
                                        <ChevronDown className="w-3 h-3 text-gray-400 -rotate-90" />
                                    </button>
                                    <button className="w-full flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 bg-violet-100 rounded-md flex items-center justify-center">
                                                <Package className="w-3.5 h-3.5 text-violet-600" />
                                            </div>
                                            <span className="text-xs font-medium text-gray-700">Top Performers</span>
                                        </div>
                                        <ChevronDown className="w-3 h-3 text-gray-400 -rotate-90" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Campaign Table - Expanded */}
                        <div className="flex-1 min-h-0">
                            <CampaignTable />
                        </div>
                    </main>

                    {/* Column 2 - Right Sidebar */}
                    <aside className="w-[350px] flex flex-col overflow-hidden flex-shrink-0 pt-8 pr-8 pb-8 pl-0 gap-4">
                        <RecentActivity />
                    </aside>
                </div>
            </div>
        </div>
        </SidebarProvider>
    )
}
