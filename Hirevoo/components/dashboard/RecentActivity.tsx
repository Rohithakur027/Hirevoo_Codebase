"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Plus, Sparkles, BookOpen, Laptop, Loader2 } from "lucide-react"
import { toast } from "sonner" // Optional: Assuming you use sonner or similar for toasts
import ConnectGmailModal from "./ConnectGmailModal"

// Define the permission levels locally to avoid import issues
type PermissionLevel = 'SEND_ONLY' | 'FULL_ACCESS';

interface Reply {
    id: string
    user: {
        name: string
        initials: string
    }
    subject: string
    preview: string
    time: string
}

const recentReplies: Reply[] = [
    {
        id: "1",
        user: { name: "Sarah Johnson", initials: "SJ" },
        subject: "Re: Interview Opportunity",
        preview: "Thank you for reaching out! I would love to schedule a call to discuss...",
        time: "2m ago",
    },
    {
        id: "2",
        user: { name: "Michael Chen", initials: "MC" },
        subject: "Re: Partnership Proposal",
        preview: "This sounds interesting. Can you share more details about the...",
        time: "15m ago",
    },
    // ... kept your other data points ...
]

export function RecentActivity() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // 1. State for connection status and loading
    const [isGmailConnected, setIsGmailConnected] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // 2. Check status and handle URL callbacks on mount
    useEffect(() => {
        checkStatus()

        // Handle success/error redirects from Google OAuth
        if (searchParams?.get("success") === "gmail_connected") {
            toast.success("Gmail connected successfully!")
            // Clean up URL
            router.replace("/dashboard")
        } else if (searchParams?.get("error")) {
            toast.error("Failed to connect Gmail")
        }
    }, [searchParams, router])

    const checkStatus = async () => {
        try {
            const res = await fetch("/api/auth/gmail/status")
            if (res.ok) {
                const data = await res.json()
                setIsGmailConnected(data.isConnected)
            }
        } catch (error) {
            console.error("Failed to fetch status:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // 3. Handler for the "Connect Gmail" button - opens modal
    const handleConnectClick = () => {
        setIsModalOpen(true)
    }

    // 4. Handler for modal connect action - performs OAuth with permission level
    const handleConnect = async (permissionLevel: PermissionLevel) => {
        setIsModalOpen(false)
        setIsConnecting(true)
        try {
            // Call your backend to get the Google OAuth URL with permission level
            const res = await fetch("/api/auth/gmail/connect", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ permissionLevel }),
            })
            const data = await res.json()

            if (data.url) {
                // Redirect user to Google
                window.location.href = data.url
            } else {
                toast.error("Could not initiate connection")
                setIsConnecting(false)
            }
        } catch (error) {
            console.error("Connection error:", error)
            toast.error("Something went wrong")
            setIsConnecting(false)
        }
    }

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Connect Gmail Card */}
            <div className="rounded-xl p-5 text-white relative overflow-hidden h-[160px] flex-shrink-0 flex flex-col justify-between" style={{ backgroundColor: "#209ba0" }}>
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="absolute -right-6 top-6 w-14 h-14 bg-white/10 rounded-full" />

                {/* Decorative Icons */}
                <BookOpen className="absolute right-8 top-8 w-6 h-6 text-white/20 rotate-12" />
                <Laptop className="absolute right-8 bottom-12 w-8 h-8 text-white/20 -rotate-6" />

                {/* Dynamic UI based on state */}
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                    </div>
                ) : isGmailConnected ? (
                    // STATE: CONNECTED (Show Upgrade option)
                    <>
                        <div>
                            <h3 className="text-sm font-semibold mb-1">Upgrade to Pro</h3>
                            <p className="text-xs opacity-90 leading-relaxed">
                                Get unlimited campaigns, AI features, and more.
                            </p>
                        </div>
                        <Button
                            className="text-xs font-medium px-4 py-1.5 rounded-md w-fit text-black hover:opacity-90 h-8 mt-2"
                            style={{ backgroundColor: "#c9f763" }}
                            onClick={() => router.push("/settings/billing")} // Example action
                        >
                            Upgrade Now
                        </Button>
                    </>
                ) : (
                    // STATE: DISCONNECTED (Show Connect option)
                    <>
                        <div>
                            <h3 className="text-sm font-semibold mb-1">Connect Gmail</h3>
                            <p className="text-xs opacity-90 leading-relaxed mt-1">
                                Connect Gmail and send emails for free.
                            </p>
                        </div>
                        <Button
                            className="text-xs font-medium px-4 py-1.5 rounded-md w-fit text-black hover:opacity-90 h-8 mt-2 disabled:opacity-70"
                            style={{ backgroundColor: "#c9f763" }}
                            onClick={handleConnectClick}
                            disabled={isConnecting}
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                "Connect Gmail"
                            )}
                        </Button>
                    </>
                )}
            </div>

            {/* Create Campaign Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-gray-800">Create Campaign</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    Do your daily task to send emails — you&apos;re just one step away from your dream job.
                </p>
                <Button
                    className="w-full text-xs font-medium rounded-md text-white bg-black hover:bg-gray-800 h-9"
                    onClick={() => router.push('/campaigns/upload')}
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Create New Campaign
                </Button>
            </div>

            {/* Recent Replies */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-800">Recent Replies</h3>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                    <div className="space-y-1">
                        {recentReplies.map((reply) => (
                            <button
                                key={reply.id}
                                className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-amber-50 transition-colors text-left"
                                style={{ backgroundColor: "rgba(254, 243, 199, 0.4)" }}
                            >
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-medium">
                                        {reply.user.initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-gray-800 truncate">{reply.user.name}</p>
                                        <span className="text-xs text-gray-400 flex-shrink-0">{reply.time}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 truncate mt-0.5">{reply.subject}</p>
                                    <p className="text-xs text-gray-400 truncate mt-0.5">{reply.preview}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Connect Gmail Modal */}
            <ConnectGmailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConnect={handleConnect}
            />
        </div>
    )
}