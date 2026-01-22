"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    CheckCircle2,
    Clock,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Send,
    Pause,
    Eye
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useCampaign } from "@/context/CampaignContext"


type EmailStatus = "sent" | "in-queue" | "pending"

interface EmailContact {
    id: string
    email: string
    status: EmailStatus
}

// Paper plane SVG animation component
function PaperPlaneAnimation() {
    return (
        <div className="relative w-48 h-32 mx-auto">
            {/* Trail dots */}
            <motion.div
                className="absolute left-4 bottom-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            >
                <div className="w-2 h-2 rounded-full bg-violet-300" />
            </motion.div>
            <motion.div
                className="absolute left-12 bottom-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
            >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
            </motion.div>
            <motion.div
                className="absolute left-20 bottom-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
            >
                <div className="w-2 h-2 rounded-full bg-amber-300" />
            </motion.div>

            {/* Dashed trail path */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 120">
                <motion.path
                    d="M20 100 Q60 40 100 60 Q140 80 180 30"
                    fill="none"
                    stroke="#CBD5E1"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                />
            </svg>

            {/* Paper Plane */}
            <motion.div
                className="absolute"
                initial={{ x: 20, y: 80, rotate: -30 }}
                animate={{
                    x: [20, 60, 100, 140, 160],
                    y: [80, 30, 50, 20, 15],
                    rotate: [-30, -45, -20, -40, -35]
                }}
                transition={{
                    duration: 3,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatType: "reverse"
                }}
            >
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M22 2L11 13M22 2L15 22L11 13M22 2L2 8L11 13"
                        stroke="url(#planeGradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="rgba(167, 139, 250, 0.1)"
                    />
                    <defs>
                        <linearGradient id="planeGradient" x1="2" y1="2" x2="22" y2="22">
                            <stop offset="0%" stopColor="#06B6D4" />
                            <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                    </defs>
                </svg>
            </motion.div>
        </div>
    )
}

export function SendCampaignPage() {
    const router = useRouter()
    const params = useParams()
    const { getCampaign } = useCampaign()
    const campaignId = params.campaignId as string

    // Get campaign data and convert to EmailContact format
    const campaign = getCampaign(campaignId)
    const contacts = campaign?.contacts?.map((contact, index) => ({
        id: contact.id,
        email: contact.email,
        status: index === 0 ? "sent" as EmailStatus : index < 3 ? "in-queue" as EmailStatus : "pending" as EmailStatus
    })) || []

    const [sentCount, setSentCount] = useState(1)
    const [isPaused, setIsPaused] = useState(false)
    const totalCount = contacts.length
    const queueCount = totalCount - sentCount

    // Simulate sending progress
    useEffect(() => {
        if (isPaused) return

        const interval = setInterval(() => {
            setSentCount((prev) => {
                if (prev >= totalCount) {
                    clearInterval(interval)
                    return prev
                }
                // Update contact status
                setContacts((prevContacts) =>
                    prevContacts.map((c, i) =>
                        i === prev ? { ...c, status: "sent" as EmailStatus } : c
                    )
                )
                return prev + 1
            })
        }, 2000)

        return () => clearInterval(interval)
    }, [isPaused, totalCount])

    const getStatusIcon = (status: EmailStatus) => {
        switch (status) {
            case "sent":
                return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            case "in-queue":
                return <Clock className="w-4 h-4 text-amber-500" />
            default:
                return <div className="w-4 h-4" />
        }
    }

    const getStatusText = (status: EmailStatus) => {
        switch (status) {
            case "sent":
                return "Sent"
            case "in-queue":
                return "In Queue"
            default:
                return "In Queue"
        }
    }

    return (
        <div className="h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="px-6 py-3 border-b bg-white border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1">Step 3/3</span>
                        <span className="text-sm font-medium text-foreground">Send Campaign</span>
                    </div>
                    <Link
                        href="/campaigns/new"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        Back to Contacts
                    </Link>
                </div>
            </div>

            {/* Main Content - Centered */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full space-y-4">
                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-center"
                    >
                        <h1 className="text-xl md:text-2xl font-bold text-foreground">
                            {sentCount >= totalCount ? "Campaign Sent! 🎉" : "Sending Your Campaign..."}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {sentCount >= totalCount
                                ? "All your personalized emails have been sent successfully."
                                : "Your personalized emails are now in the queue."}
                        </p>
                    </motion.div>

                    {/* Paper Plane Animation */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <PaperPlaneAnimation />
                    </motion.div>

                    {/* Progress Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <Card className="shadow-lg border-border/50">
                            <CardContent className="p-0">
                                {/* Tabs */}
                                <div className="flex items-center justify-between px-4 py-3 border-b">
                                    <div className="flex items-center gap-6">
                                        <button className="text-sm font-semibold text-foreground border-b-2 border-violet-600 pb-2 cursor-pointer">
                                            Campaign in Progress
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground">
                                            Sent <span className="font-semibold text-foreground">({sentCount}/{totalCount})</span>
                                        </span>
                                        <span className="text-muted-foreground">
                                            In Queue <span className="font-semibold text-foreground">({queueCount}/{totalCount})</span>
                                        </span>
                                        {sentCount < totalCount && !isPaused && (
                                            <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                                        )}
                                    </div>
                                </div>

                                {/* Email List */}
                                <div className="divide-y divide-border/50 max-h-[180px] overflow-y-auto">
                                    <AnimatePresence>
                                        {contacts.map((contact, index) => (
                                            <motion.div
                                                key={contact.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.3, delay: index * 0.1 }}
                                                className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {getStatusIcon(contact.status)}
                                                    <span className="text-sm text-foreground">{contact.email}</span>
                                                </div>
                                                <span className={cn(
                                                    "text-sm",
                                                    contact.status === "sent" ? "text-emerald-600" : "text-muted-foreground"
                                                )}>
                                                    {getStatusText(contact.status)}
                                                </span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                {/* View Report Link */}
                                <div className="px-3 py-2 border-t text-center">
                                    <button className="text-sm text-violet-600 hover:text-violet-700 font-medium cursor-pointer">
                                        View Detailed Report
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                        className="flex items-center justify-center gap-3"
                    >
                        <Button
                            variant="outline"
                            onClick={() => setIsPaused(!isPaused)}
                            className="gap-2 cursor-pointer"
                            disabled={sentCount >= totalCount}
                        >
                            <Pause className="w-4 h-4" />
                            {isPaused ? "Resume Campaign" : "Pause Campaign"}
                        </Button>
                        <Button
                            onClick={() => router.push("/dashboard")}
                            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                        >
                            Go to Dashboard
                        </Button>
                    </motion.div>

                    {/* Completion checkmark animation */}
                    <AnimatePresence>
                        {sentCount >= totalCount && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 260,
                                    damping: 20,
                                    delay: 0.5
                                }}
                                className="flex justify-center"
                            >
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                                    <CheckCircle2 className="w-10 h-10 text-white" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    )
}
