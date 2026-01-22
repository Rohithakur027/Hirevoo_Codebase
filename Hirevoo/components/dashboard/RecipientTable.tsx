"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Send, Eye, Zap, CheckCircle } from "lucide-react"
import { getHoursSince, formatShortDate } from "@/lib/date-helpers"
import { IndividualFollowupDialog } from "./IndividualFollowupDialog"
import { EmailChatDialog } from "./EmailChatDialog"
import { BulkFollowupDialog } from "./BulkFollowupDialog"
import type { Recipient } from "@/lib/data"

interface RecipientTableProps {
    recipients: Recipient[]
}

export function RecipientTable({ recipients: initialRecipients }: RecipientTableProps) {
    const [recipients] = useState(initialRecipients)
    const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
    const [followUpRecipient, setFollowUpRecipient] = useState<Recipient | null>(null)
    const [chatRecipient, setChatRecipient] = useState<Recipient | null>(null)
    const [showChatDialog, setShowChatDialog] = useState(false)
    const [showBulkFollowup, setShowBulkFollowup] = useState(false)

    const handleFollowUp = (recipient: Recipient) => {
        setFollowUpRecipient(recipient)
        setShowFollowUpDialog(true)
    }

    const handleViewChat = (recipient: Recipient) => {
        setChatRecipient(recipient)
        setShowChatDialog(true)
    }

    const getStatusBadge = (status: Recipient["status"]) => {
        switch (status) {
            case "Replied":
                return (
                    <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-xs px-3 py-1 h-auto shadow-none border-0 font-medium">
                        Replied
                    </Badge>
                )
            case "Opened":
                return (
                    <Badge className="bg-orange-100 text-orange-600 hover:bg-orange-200 text-xs px-3 py-1 h-auto shadow-none border border-orange-200 font-medium">
                        Opened
                    </Badge>
                )
            case "Sent":
                return (
                    <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs px-3 py-1 h-auto shadow-none border border-slate-200 font-medium">
                        Sent
                    </Badge>
                )
        }
    }

    const shouldShowFollowUp = (recipient: Recipient) => {
        return recipient.status === "Sent" || recipient.status === "Opened"
    }

    const needsFollowupCount = recipients.filter((r) => r.status !== "Replied").length

    return (
        <>
            <Card className="flex h-full flex-col border-border/40 bg-white shadow-sm">
                <CardHeader className="flex-shrink-0 pb-4 pt-5 px-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CardTitle className="text-lg font-semibold text-foreground">Email List</CardTitle>
                            <span className="text-xs text-muted-foreground bg-slate-100 px-3 py-1 rounded-full font-medium">
                                {recipients.length} contacts
                            </span>
                        </div>
                        <Button
                            className="h-9 text-sm gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow-sm"
                            onClick={() => setShowBulkFollowup(true)}
                        >
                            <Zap className="h-4 w-4" />
                            Quick Follow-up ({needsFollowupCount})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto px-0 pb-4">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b border-slate-200">
                                <th className="pb-3 w-[35%] pl-5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Contact
                                </th>
                                <th className="pb-3 w-[60px] text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    View
                                </th>
                                <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Date
                                </th>
                                <th className="pb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Status
                                </th>
                                <th className="pb-3 pr-5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {recipients.map((recipient) => (
                                <tr key={recipient.id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="py-4 pl-5">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium text-foreground">
                                                {recipient.name}
                                            </p>
                                            <p className="text-xs text-[#4553f4]">
                                                {recipient.email}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="py-4 text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-full"
                                            onClick={() => handleViewChat(recipient)}
                                            title="View conversation"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </td>
                                    <td className="py-4 text-left">
                                        <span className="text-sm text-muted-foreground">
                                            {formatShortDate(recipient.sentAt)}
                                        </span>
                                    </td>
                                    <td className="py-4 text-center">
                                        {getStatusBadge(recipient.status)}
                                    </td>
                                    <td className="py-4 pr-5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {shouldShowFollowUp(recipient) ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 px-3 text-sm text-slate-600 hover:text-[#4553f4] hover:bg-slate-100 font-medium"
                                                    onClick={() => handleFollowUp(recipient)}
                                                >
                                                    <Send className="mr-1.5 h-3.5 w-3.5" />
                                                    Follow Up
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-emerald-600 px-3 font-medium flex items-center">
                                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                                    Done
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {recipients.length === 0 && (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            No recipients found.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Individual Follow-up Dialog */}
            <IndividualFollowupDialog recipient={followUpRecipient} open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog} />

            {/* Email Chat Dialog */}
            <EmailChatDialog recipient={chatRecipient} open={showChatDialog} onOpenChange={setShowChatDialog} />

            {/* Bulk Follow-up Dialog */}
            <BulkFollowupDialog recipients={recipients} open={showBulkFollowup} onOpenChange={setShowBulkFollowup} />
        </>
    )
}
