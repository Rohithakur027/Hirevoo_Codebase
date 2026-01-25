"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Recipient } from "@/lib/data"
import { useState } from "react"
import { Send } from "lucide-react"

interface IndividualFollowupDialogProps {
    recipient: Recipient | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function IndividualFollowupDialog({ recipient, open, onOpenChange }: IndividualFollowupDialogProps) {
    const [message, setMessage] = useState("")

    if (!recipient) return null

    const handleSend = () => {
        // Logic to send followup would go here
        console.log("Sending followup to", recipient.email, message)
        setMessage("")
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>Follow up with {recipient.name}</span>
                    </DialogTitle>
                    <DialogDescription>
                        Send a quick follow-up email to keep the conversation going.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-md border">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={recipient.avatar} />
                            <AvatarFallback>{recipient.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="text-sm font-medium">{recipient.name}</div>
                            <div className="text-xs text-muted-foreground">{recipient.email}</div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input id="subject" defaultValue={`Re: Previous conversation`} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                            id="message"
                            placeholder="Type your follow-up message here..."
                            className="h-[150px]"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSend} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                        <Send className="w-4 h-4 mr-2" />
                        Send Email
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
