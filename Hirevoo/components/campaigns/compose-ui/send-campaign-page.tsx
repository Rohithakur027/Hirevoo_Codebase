"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    CheckCircle2,
    Clock,
    Loader2,
    Send,
    Pause,
    AlertCircle,
    XCircle,
    RefreshCw,
    Play
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useCampaign } from "@/context/CampaignContext"
import { useSession } from "next-auth/react"
import { bgWorkerApi, BgWorkerError } from "@/lib/bg-worker-api"
import { useCampaignProgress } from "@/hooks/useCampaignProgress"

type EmailStatus = "sent" | "sending" | "in-queue" | "pending" | "failed"

interface EmailContact {
    id: string
    email: string
    status: EmailStatus
    error?: string
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
                    strokeDasharray="6,4"
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

// Success animation component
function SuccessAnimation() {
    return (
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
    )
}

export function SendCampaignPage() {
    const router = useRouter()
    const params = useParams()
    const { campaign: currentCampaign, isLoading: isCampaignLoading } = useCampaign()
    const { data: session } = useSession()
    const routeCampaignId = params.campaignId as string
    // Use the actual persisted campaign ID if available, otherwise fall back to route param
    // This handles the case where the ID transitions from temp-xxx to the real UUID
    const campaignId = currentCampaign?.id && !currentCampaign.id.startsWith('temp-')
        ? currentCampaign.id
        : routeCampaignId
    const userId = session?.user?.id || session?.user?.email || ''

    // Check if campaign is still being saved (temp ID means not yet persisted)
    const isWaitingForPersistence = currentCampaign?.id?.startsWith('temp-') || isCampaignLoading

    // Campaign state
    const [contacts, setContacts] = useState<EmailContact[]>([])
    const [isSending, setIsSending] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [errorCode, setErrorCode] = useState<string | null>(null)
    const [jobId, setJobId] = useState<string | null>(null)
    const [hasSentRequest, setHasSentRequest] = useState(false)
    const [sendAttempts, setSendAttempts] = useState(0)

    // Real-time progress from Socket.IO
    const {
        progress,
        sent,
        failed,
        total,
        isComplete,
        isConnected,
        error: socketError,
        emailStatuses,
        failedEmails
    } = useCampaignProgress(userId, hasSentRequest ? campaignId : undefined, {
        initialTotal: currentCampaign?.contacts?.length || 0
    })

    // Initialize contacts from campaign
    useEffect(() => {
        if (currentCampaign?.contacts) {
            setContacts(
                currentCampaign.contacts.map((contact) => ({
                    id: contact.id,
                    email: contact.email,
                    status: "pending" as EmailStatus
                }))
            )
        }
    }, [currentCampaign?.contacts])

    // Update contact statuses based on real-time progress
    useEffect(() => {
        if (emailStatuses.size > 0) {
            setContacts((prevContacts) =>
                prevContacts.map((contact) => {
                    const statusUpdate = emailStatuses.get(contact.email)
                    if (statusUpdate) {
                        return {
                            ...contact,
                            status: statusUpdate.status as EmailStatus,
                            error: statusUpdate.error
                        }
                    }
                    return contact
                })
            )
        }
    }, [emailStatuses])

    // Send campaign function with debouncing and better error handling
    const sendCampaign = useCallback(async () => {
        // Comprehensive guard conditions to prevent duplicate sends
        if (!campaignId || isSending || hasSentRequest || isWaitingForPersistence) {
            console.log('[SendCampaignPage] Send blocked:', {
                noCampaignId: !campaignId,
                alreadySending: isSending,
                alreadySentRequest: hasSentRequest,
                waitingForPersistence: isWaitingForPersistence
            })
            return
        }

        // Don't send if campaign ID starts with 'temp-' - it's not persisted yet
        if (campaignId.startsWith('temp-')) {
            console.log('[SendCampaignPage] Waiting for campaign to be persisted...')
            return
        }

        // Increment send attempts for tracking
        setSendAttempts(prev => prev + 1)

        try {
            setIsSending(true)
            setError(null)
            setErrorCode(null)

            console.log('[SendCampaignPage] Sending campaign:', campaignId, 'Attempt:', sendAttempts + 1)
            const response = await bgWorkerApi.sendCampaign(campaignId)

            console.log('[SendCampaignPage] Campaign queued:', response.jobId)
            setJobId(response.jobId)
            setHasSentRequest(true)

            // Mark all contacts as in-queue initially
            setContacts((prev) =>
                prev.map((c) => ({ ...c, status: "in-queue" as EmailStatus }))
            )
        } catch (err) {
            console.error('[SendCampaignPage] Error:', err)

            if (err instanceof BgWorkerError) {
                setErrorCode(err.code)

                // Handle "already processing" errors gracefully
                if (err.isAlreadyProcessing()) {
                    // Campaign is already being sent - this is actually okay
                    // The user might have double-clicked or refreshed
                    console.log('[SendCampaignPage] Campaign already in progress, treating as success')
                    setHasSentRequest(true)
                    setError(null)
                    setErrorCode(null)
                    // Mark contacts as in-queue since campaign is already processing
                    setContacts((prev) =>
                        prev.map((c) => ({ ...c, status: "in-queue" as EmailStatus }))
                    )
                    return
                }

                // Handle "already sent" errors gracefully
                if (err.isAlreadySent()) {
                    // Campaign was already sent - show success state
                    console.log('[SendCampaignPage] Campaign already sent, showing completion')
                    setHasSentRequest(true)
                    setContacts((prev) =>
                        prev.map((c) => ({ ...c, status: "sent" as EmailStatus }))
                    )
                    setError(null)
                    setErrorCode(null)
                    return
                }

                // For other errors, show the user-friendly message
                setError(err.getUserMessage())
            } else {
                setError(err instanceof Error ? err.message : 'Failed to send campaign')
            }
        } finally {
            setIsSending(false)
        }
    }, [campaignId, isSending, hasSentRequest, isWaitingForPersistence, sendAttempts])

    // Auto-send on mount (if we have campaign data and it's persisted)
    useEffect(() => {
        if (campaignId &&
            !campaignId.startsWith('temp-') &&
            currentCampaign?.contacts?.length &&
            !hasSentRequest &&
            !error &&
            !isWaitingForPersistence) {
            // Small delay to ensure component is fully mounted
            const timer = setTimeout(() => {
                sendCampaign()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [campaignId, currentCampaign?.contacts?.length, hasSentRequest, error, sendCampaign, isWaitingForPersistence])

    // Retry function - only allow retry for certain error types
    const handleRetry = useCallback(() => {
        // Don't allow retry if campaign is already sending/sent
        if (errorCode === 'CAMPAIGN_ALREADY_SENDING' ||
            errorCode === 'ALREADY_SENDING' ||
            errorCode === 'CAMPAIGN_ALREADY_SENT' ||
            errorCode === 'ALREADY_SENT') {
            console.log('[SendCampaignPage] Cannot retry - campaign already processed')
            return
        }

        setHasSentRequest(false)
        setError(null)
        setErrorCode(null)
        setJobId(null)
        setContacts((prev) =>
            prev.map((c) => ({ ...c, status: "pending" as EmailStatus, error: undefined }))
        )
    }, [errorCode])

    const getStatusIcon = (status: EmailStatus) => {
        switch (status) {
            case "sent":
                return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            case "sending":
                return <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
            case "in-queue":
                return <Clock className="w-4 h-4 text-amber-500" />
            case "failed":
                return <XCircle className="w-4 h-4 text-red-500" />
            default:
                return <div className="w-4 h-4" />
        }
    }

    const getStatusText = (status: EmailStatus) => {
        switch (status) {
            case "sent":
                return "Sent"
            case "sending":
                return "Sending..."
            case "in-queue":
                return "In Queue"
            case "failed":
                return "Failed"
            default:
                return "Pending"
        }
    }

    const totalCount = total || contacts.length
    const sentCount = sent
    const queueCount = Math.max(0, totalCount - sentCount - failed)
    const failedCount = failed

    // Determine current state
    const isWaitingForDatabase = isWaitingForPersistence && !hasSentRequest && !error
    const isWaitingForConnection = hasSentRequest && !isConnected && !isComplete && !error
    const isActivelySending = hasSentRequest && isConnected && !isComplete && !error
    const hasFinished = isComplete

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
                    {/* Error Alert */}
                    <AnimatePresence>
                        {(error || socketError) && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-red-50 border border-red-200 rounded-lg p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-red-700 font-medium">
                                            {error || socketError}
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleRetry}
                                            className="mt-2 gap-2"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Try Again
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-center"
                    >
                        <h1 className="text-xl md:text-2xl font-bold text-foreground">
                            {hasFinished
                                ? "Campaign Sent!"
                                : isWaitingForDatabase
                                    ? "Saving Campaign..."
                                    : isSending
                                        ? "Starting Campaign..."
                                        : isWaitingForConnection
                                            ? "Connecting..."
                                            : isActivelySending
                                                ? "Sending Your Campaign..."
                                                : error
                                                    ? "Send Failed"
                                                    : "Preparing to Send..."}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {hasFinished
                                ? `${sentCount} emails sent successfully${failedCount > 0 ? `, ${failedCount} failed` : ""}.`
                                : isWaitingForDatabase
                                    ? "Saving your campaign to the database..."
                                    : isWaitingForConnection
                                        ? "Establishing real-time connection..."
                                        : isActivelySending
                                            ? "Your personalized emails are being sent."
                                            : error
                                                ? "Please try again or check your settings."
                                                : "Please wait while we prepare your campaign."}
                        </p>
                        {/* Connection status indicator */}
                        {hasSentRequest && !hasFinished && (
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    isConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                                )} />
                                <span className="text-xs text-muted-foreground">
                                    {isConnected ? "Real-time updates active" : "Connecting to server..."}
                                </span>
                            </div>
                        )}
                    </motion.div>

                    {/* Paper Plane Animation */}
                    {!hasFinished && !error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <PaperPlaneAnimation />
                        </motion.div>
                    )}

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
                                            {hasFinished ? "Campaign Complete" : "Campaign in Progress"}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-muted-foreground">
                                            Sent <span className="font-semibold text-emerald-600">({sentCount}/{totalCount})</span>
                                        </span>
                                        {failedCount > 0 && (
                                            <span className="text-muted-foreground">
                                                Failed <span className="font-semibold text-red-600">({failedCount})</span>
                                            </span>
                                        )}
                                        <span className="text-muted-foreground">
                                            In Queue <span className="font-semibold text-foreground">({queueCount})</span>
                                        </span>
                                        {isActivelySending && !isPaused && (
                                            <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                {hasSentRequest && (
                                    <div className="px-4 py-2 border-b bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-gradient-to-r from-violet-500 to-emerald-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                                />
                                            </div>
                                            <span className="text-sm font-medium text-foreground w-12 text-right">
                                                {Math.round(progress)}%
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Email List */}
                                <div className="divide-y divide-border/50 max-h-[180px] overflow-y-auto">
                                    <AnimatePresence>
                                        {contacts.map((contact, index) => (
                                            <motion.div
                                                key={contact.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                                className={cn(
                                                    "flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors",
                                                    contact.status === "failed" && "bg-red-50"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {getStatusIcon(contact.status)}
                                                    <div>
                                                        <span className="text-sm text-foreground">{contact.email}</span>
                                                        {contact.error && (
                                                            <p className="text-xs text-red-500">{contact.error}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    "text-sm",
                                                    contact.status === "sent" && "text-emerald-600",
                                                    contact.status === "failed" && "text-red-600",
                                                    contact.status === "sending" && "text-violet-600",
                                                    (contact.status === "in-queue" || contact.status === "pending") && "text-muted-foreground"
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
                        {/* Pause/Resume button - only show during active sending */}
                        {isActivelySending && (
                            <Button
                                variant="outline"
                                onClick={() => setIsPaused(!isPaused)}
                                className="gap-2 cursor-pointer"
                                disabled={hasFinished}
                            >
                                {isPaused ? (
                                    <>
                                        <Play className="w-4 h-4" />
                                        Resume Campaign
                                    </>
                                ) : (
                                    <>
                                        <Pause className="w-4 h-4" />
                                        Pause Campaign
                                    </>
                                )}
                            </Button>
                        )}

                        {/* Retry button on error */}
                        {error && (
                            <Button
                                variant="outline"
                                onClick={handleRetry}
                                className="gap-2 cursor-pointer"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </Button>
                        )}

                        <Button
                            onClick={() => router.push("/dashboard")}
                            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                        >
                            Go to Dashboard
                        </Button>
                    </motion.div>

                    {/* Completion checkmark animation */}
                    <AnimatePresence>
                        {hasFinished && <SuccessAnimation />}
                    </AnimatePresence>

                    {/* Failed emails summary */}
                    <AnimatePresence>
                        {hasFinished && failedEmails.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-amber-50 border border-amber-200 rounded-lg p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-amber-700 font-medium">
                                            {failedEmails.length} email{failedEmails.length > 1 ? 's' : ''} failed to send
                                        </p>
                                        <p className="text-amber-600 text-sm mt-1">
                                            Check the detailed report for more information.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Job ID display for debugging */}
                    {jobId && (
                        <p className="text-center text-xs text-muted-foreground">
                            Job ID: {jobId}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
