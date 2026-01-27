import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    CheckCircle2,
    Clock,
    Loader2,
    AlertCircle,
    RefreshCw,
    ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useCampaign } from "@/context/CampaignContext"
import { useSession } from "next-auth/react"
import { bgWorkerApi, BgWorkerError } from "@/lib/bg-worker-api"

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

    // Use persisted ID if available, else route param
    const campaignId = currentCampaign?.id && !currentCampaign.id.startsWith('temp-')
        ? currentCampaign.id
        : routeCampaignId

    // Check if campaign is persisting (temp ID)
    const isWaitingForPersistence = currentCampaign?.id?.startsWith('temp-') || isCampaignLoading

    // Campaign state
    const [contacts, setContacts] = useState<EmailContact[]>([])
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [errorCode, setErrorCode] = useState<string | null>(null)
    const [hasQueued, setHasQueued] = useState(false)
    const [sendAttempts, setSendAttempts] = useState(0)

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

    // Send campaign function - Trigger only
    const sendCampaign = useCallback(async () => {
        // Guard conditions
        if (!campaignId || isSending || hasQueued || isWaitingForPersistence) {
            return
        }

        if (campaignId.startsWith('temp-')) {
            return
        }

        setSendAttempts(prev => prev + 1)

        try {
            setIsSending(true)
            setError(null)
            setErrorCode(null)

            console.log('[SendCampaignPage] Queuing campaign:', campaignId)
            await bgWorkerApi.sendCampaign(campaignId)

            // Show queued state on success
            setHasQueued(true)

            // Mark all contacts as in-queue
            setContacts((prev) =>
                prev.map((c) => ({ ...c, status: "in-queue" as EmailStatus }))
            )
        } catch (err) {
            console.error('[SendCampaignPage] Error:', err)

            if (err instanceof BgWorkerError) {
                setErrorCode(err.code)

                // Handle "already processing" or "already sent" as success/queued
                if (err.isAlreadyProcessing() || err.isAlreadySent()) {
                    setHasQueued(true)
                    setError(null)
                    setErrorCode(null)
                    setContacts((prev) =>
                        prev.map((c) => ({ ...c, status: "in-queue" as EmailStatus }))
                    )
                    return
                }

                setError(err.getUserMessage())
            } else {
                setError(err instanceof Error ? err.message : 'Failed to send campaign')
            }
        } finally {
            setIsSending(false)
        }
    }, [campaignId, isSending, hasQueued, isWaitingForPersistence])

    // Auto-send on mount
    useEffect(() => {
        if (campaignId &&
            !campaignId.startsWith('temp-') &&
            currentCampaign?.contacts?.length &&
            !hasQueued &&
            !error &&
            !isWaitingForPersistence) {
            const timer = setTimeout(() => {
                sendCampaign()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [campaignId, currentCampaign?.contacts?.length, hasQueued, error, sendCampaign, isWaitingForPersistence])

    const handleRetry = useCallback(() => {
        setHasQueued(false)
        setError(null)
        setErrorCode(null)
        setContacts((prev) =>
            prev.map((c) => ({ ...c, status: "pending" as EmailStatus, error: undefined }))
        )
    }, [])

    return (
        <div className="h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="px-6 py-3 border-b bg-white border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-primary border-b-2 border-primary pb-1">Step 3/3</span>
                        <span className="text-sm font-medium text-foreground">Send Campaign</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="max-w-2xl w-full space-y-4">
                    {/* Error Alert */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-red-50 border border-red-200 rounded-lg p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-red-700 font-medium">{error}</p>
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

                    {/* Status Title & Description */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-center"
                    >
                        <h1 className="text-xl md:text-2xl font-bold text-foreground">
                            {hasQueued
                                ? "Campaign Queued Successfully"
                                : isSending
                                    ? "Starting Campaign..."
                                    : "Preparing to Send..."}
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm max-w-md mx-auto leading-relaxed">
                            {hasQueued
                                ? "Your emails have been added to the queue. You can safely close this tab, we'll handle the delivery in the background."
                                : "Please wait while we initialize your campaign..."}
                        </p>
                    </motion.div>

                    {/* Animation */}
                    {!error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="py-6"
                        >
                            {hasQueued ? <SuccessAnimation /> : <PaperPlaneAnimation />}
                        </motion.div>
                    )}

                    {/* Contacts List Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                    >
                        <Card className="shadow-lg border-border/50">
                            <CardContent className="p-0">
                                {/* Card Header */}
                                <div className="px-4 py-3 border-b bg-gray-50/50 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700">
                                        Queued Emails
                                    </span>
                                    <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                                        {contacts.length} / {contacts.length} Queued
                                    </span>
                                </div>

                                {/* Email List */}
                                <div className="divide-y divide-border/50 max-h-[200px] overflow-y-auto">
                                    {contacts.map((contact) => (
                                        <div
                                            key={contact.id}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                                                    {contact.email.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm text-gray-700">{contact.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                                <span className="text-xs font-medium text-amber-600">Queued</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                        className="flex items-center justify-center pt-4"
                    >
                        {hasQueued && (
                            <Button
                                onClick={() => router.push("/dashboard")}
                                className="gap-2 bg-black hover:bg-gray-800 text-white min-w-[200px] rounded-[6px]"
                            >
                                Go to Dashboard
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
