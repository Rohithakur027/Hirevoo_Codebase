"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Clock, Send, AlertTriangle, Mail, MailOpen } from "lucide-react"
import type { Recipient } from "@/lib/data"

interface BulkFollowupDialogProps {
    recipients: Recipient[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function BulkFollowupDialog({ recipients, open, onOpenChange }: BulkFollowupDialogProps) {
    const [timeLimit, setTimeLimit] = useState("48")

    // Filter recipients who need follow-up (not replied)
    const eligibleRecipients = recipients.filter((r) => r.status !== "Replied")
    const unopenedCount = recipients.filter((r) => r.status === "Sent").length
    const openedNotReplied = recipients.filter((r) => r.status === "Opened").length

    const handleSend = () => {
        console.log(`Sending follow-ups to ${eligibleRecipients.length} recipients with ${timeLimit}h limit`)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-base flex items-center gap-2">
                        <Send className="h-4 w-4 text-primary" />
                        Quick Follow-up
                    </DialogTitle>
                </DialogHeader>

                <div className="py-3 space-y-4">
                    {/* Summary with better UI and icons */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                            <div className="p-2 rounded-full bg-muted">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground">Unopened</p>
                                <p className="text-xl font-bold text-foreground">{unopenedCount}</p>
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                            <div className="p-2 rounded-full bg-amber-500/10">
                                <MailOpen className="h-4 w-4 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-muted-foreground">Opened (no reply)</p>
                                <p className="text-xl font-bold text-foreground">{openedNotReplied}</p>
                            </div>
                        </div>
                    </div>

                    {/* Total to follow up */}
                    <div className="text-center py-2 border-y border-border/50">
                        <p className="text-[10px] text-muted-foreground">Total emails to follow up</p>
                        <p className="text-2xl font-bold text-primary">{eligibleRecipients.length}</p>
                    </div>

                    {/* Time limit options */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Who should receive a follow-up?
                        </Label>
                        <RadioGroup value={timeLimit} onValueChange={setTimeLimit} className="grid gap-2">
                            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                                <RadioGroupItem value="24" id="24h" />
                                <div className="flex-1 cursor-pointer" onClick={() => setTimeLimit("24")}>
                                    <Label htmlFor="24h" className="font-medium text-sm cursor-pointer">Since 24 hours ago</Label>
                                    <p className="text-[10px] text-muted-foreground">Sent at least a day ago</p>
                                </div>
                            </div>

                            <div className="relative flex items-center space-x-2 p-3 rounded-lg border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                                <div className="absolute -top-2 right-4 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                    Recommended
                                </div>
                                <RadioGroupItem value="48" id="48h" />
                                <div className="flex-1 cursor-pointer" onClick={() => setTimeLimit("48")}>
                                    <Label htmlFor="48h" className="font-medium text-sm cursor-pointer">Since 48 hours ago</Label>
                                    <p className="text-[10px] text-muted-foreground">Standard waiting period (Best for conversions)</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                                <RadioGroupItem value="0" id="all" />
                                <div className="flex-1 cursor-pointer" onClick={() => setTimeLimit("0")}>
                                    <Label htmlFor="all" className="font-medium text-sm cursor-pointer">Send to everyone</Label>
                                    <p className="text-[10px] text-muted-foreground">Follow up with all contacts immediately</p>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Warning for aggressive option */}
                    {timeLimit === "0" && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 text-[11px] animate-in slide-in-from-top-2">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <p>Warning: Sending follow-ups too soon (under 24h) is considered spammy and may hurt your domain reputation.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSend} className="bg-violet-600 hover:bg-violet-700 text-white">
                        <Send className="mr-2 h-3.5 w-3.5" />
                        Send Follow-ups
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
