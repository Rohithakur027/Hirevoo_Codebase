"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Plus, Sparkles, BookOpen, Laptop, Loader2, Mail } from "lucide-react"
import { toast } from "sonner" // Optional: Assuming you use sonner or similar for toasts
import ConnectGmailModal from "./ConnectGmailModal"

// Define the permission levels locally to avoid import issues
type PermissionLevel = 'SEND_ONLY' | 'FULL_ACCESS';



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
            <div className="rounded-[16px] p-5 text-white relative overflow-hidden h-[200px] flex-shrink-0 flex flex-col justify-between" style={{ backgroundColor: "#209ba0" }}>
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full" />
                <div className="absolute -right-6 top-6 w-14 h-14 bg-white/10 rounded-full" />

                {/* Decorative Icons */}
                <BookOpen className="absolute right-4 top-12 w-8 h-8 text-white/20 rotate-12" />
                <Laptop className="absolute right-6 bottom-16 w-10 h-10 text-white/20 -rotate-6" />
                <div className="absolute right-3 bottom-8 w-3 h-3 rounded-full border border-white/30" />
                <div className="absolute right-12 top-6 w-2 h-2 rounded-full bg-white/30" />

                {/* Dynamic UI based on state */}
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                    </div>
                ) : isGmailConnected ? (
                    // STATE: CONNECTED (Show Upgrade option)
                    <>
                        <div>
                            <h3 className="text-base font-semibold mb-2">Upgrade to Pro</h3>
                            <div className="mb-2">
                                <span className="text-3xl font-bold">₹199</span>
                                <span className="text-xs opacity-90 ml-1">/ Month</span>
                            </div>
                            <p className="text-[10px] opacity-80 mb-4">
                                ₹1999 Billed Annually
                            </p>
                        </div>
                        <Button
                            className="text-xs font-semibold px-6 py-1 rounded-[6px] w-fit text-black hover:opacity-90 h-8 mt-auto shadow-sm"
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
                            className="text-xs font-medium px-4 py-1 rounded-none w-fit text-black hover:opacity-90 h-7 mt-2 disabled:opacity-70"
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

            {/* Recent Replies */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-800">Recent Replies</h3>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <div className="bg-gray-50 p-3 rounded-full mb-2">
                            <Mail className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-xs font-medium">No Recent Replies</p>
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