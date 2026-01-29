import { useState, useEffect, useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Check, Clock, X, Send, ExternalLink } from "lucide-react"
import type { Recipient, Message } from "@/lib/data"

interface EmailChatDialogProps {
    recipient: Recipient | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EmailChatDialog({ recipient, open, onOpenChange }: EmailChatDialogProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const scrollEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (open && recipient) {
            fetchConversation(recipient.campaignContactId || recipient.id)
        } else {
            setMessages([])
        }
    }, [open, recipient])

    // Scroll to bottom when messages load
    useEffect(() => {
        if (messages.length > 0) {
            scrollEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages])

    const fetchConversation = async (campaignContactId: string) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/emails/conversation?campaignContactId=${campaignContactId}`)
            if (res.ok) {
                const data = await res.json()
                setMessages(data.messages || [])
            }
        } catch (error) {
            console.error("Failed to fetch conversation:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const formatDateHeader = (isoString: string) => {
        const date = new Date(isoString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return "Today";
        } else if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        } else {
            return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
        }
    }

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const StatusIcon = ({ status }: { status?: Message["status"] }) => {
        if (!status) return null // Incoming messages don't have status

        switch (status) {
            case "read":
                return (
                    <div className="flex relative w-[16px] h-[10px]">
                        <Check className="w-[14px] h-[14px] text-[#53bdeb] absolute left-0 bottom-[-2px] stroke-[2.5]" />
                        <Check className="w-[14px] h-[14px] text-[#53bdeb] absolute left-[5px] bottom-[-2px] stroke-[2.5]" />
                    </div>
                )
            case "delivered":
                return <Check className="w-[14px] h-[14px] text-gray-400 stroke-[2.5]" />
            case "sent":
                return <Check className="w-[14px] h-[14px] text-gray-400 stroke-[2.5]" />
            case "failed":
                return (
                    <div className="flex items-center justify-center w-[14px] h-[14px] bg-red-500 rounded-full">
                        <span className="text-white text-[10px] font-bold">!</span>
                    </div>
                )
            default: // pending
                return <Clock className="w-3 h-3 text-gray-400" />
        }
    }

    const [newMessage, setNewMessage] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    const adjustHeight = () => {
        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = "auto"
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
        }
    }

    useEffect(() => {
        adjustHeight()
    }, [newMessage])

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !recipient) return

        const tempId = `temp-${Date.now()}`
        const tempMessage: Message = {
            id: tempId,
            from: "user",
            content: newMessage.trim(),
            timestamp: new Date().toISOString(),
            status: undefined // undefined implies pending
        }

        // Optimistic update
        setMessages(prev => [...prev, tempMessage])
        setNewMessage("")

        // Scroll to bottom
        setTimeout(() => {
            scrollEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 100)

        // Adjust height immediately since we cleared the input
        setTimeout(() => {
            adjustHeight()
        }, 0)

        try {
            // Call our new API route
            const res = await fetch('/api/emails/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignContactId: recipient.campaignContactId || recipient.id,
                    message: tempMessage.content
                })
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                // Handle error - set status to failed
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, status: "failed" }
                        : msg
                ))
                console.error("Failed to send reply:", data.error)
            } else {
                // Success - set status to sent
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId
                        ? { ...msg, status: "sent" }
                        : msg
                ))
            }

        } catch (error) {
            console.error("Error sending reply:", error)
            setMessages(prev => prev.map(msg =>
                msg.id === tempId
                    ? { ...msg, status: "failed" }
                    : msg
            ))
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    if (!recipient) return null

    // Group messages by date
    const groupedMessages: { date: string, msgs: Message[] }[] = [];
    messages.forEach(msg => {
        const date = new Date(msg.timestamp).toDateString();
        const lastGroup = groupedMessages[groupedMessages.length - 1];
        if (lastGroup && new Date(lastGroup.msgs[0].timestamp).toDateString() === date) {
            lastGroup.msgs.push(msg);
        } else {
            groupedMessages.push({ date, msgs: [msg] });
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] flex flex-col h-[600px] p-0 gap-0 overflow-hidden [&>button]:hidden">
                <DialogHeader className="p-4 border-b border-slate-100 bg-white shadow-sm z-10 flex flex-row items-center gap-3 space-y-0 justify-between">
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <div className="relative flex-shrink-0">
                            <Avatar className="h-10 w-10 border border-slate-100">
                                <AvatarImage src={recipient.avatar} />
                                <AvatarFallback className="bg-emerald-100 text-emerald-700">{recipient.initials}</AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                        </div>
                        <div className="flex flex-col gap-0.5 overflow-hidden justify-center">
                            <DialogTitle className="font-semibold text-gray-900 leading-none truncate text-sm m-0">
                                {recipient.email}
                            </DialogTitle>
                        </div>
                        <button
                            onClick={() => {
                                const url = recipient.gmailThreadId
                                    ? `https://mail.google.com/mail/u/0/#all/${recipient.gmailThreadId}`
                                    : `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(recipient.email)}`
                                window.open(url, '_blank')
                            }}
                            className="ml-auto mr-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors flex items-center gap-1.5 flex-shrink-0"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open in Gmail</span>
                        </button>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-1 rounded-full hover:bg-slate-100 transition-colors flex-shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </DialogHeader>

                <div className="flex-1 bg-[#f8fafc] relative overflow-hidden flex flex-col">
                    <div className="flex-1 bg-[#f8fafc] relative flex flex-col min-h-0">

                        <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full pt-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full pt-20 text-gray-400 text-sm italic">
                                    No conversation history yet.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 pb-4">
                                    {groupedMessages.map((group, groupIndex) => (
                                        <div key={groupIndex} className="flex flex-col gap-2">
                                            <div className="flex justify-center my-4 sticky top-0 z-10">
                                                <span className="bg-white/80 backdrop-blur-sm shadow-sm text-gray-500 text-[11px] font-medium px-3 py-1 rounded-full border border-gray-100">
                                                    {formatDateHeader(group.msgs[0].timestamp)}
                                                </span>
                                            </div>
                                            {group.msgs.map((msg) => {
                                                const isMe = msg.from === "user"
                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                                                    >
                                                        <div
                                                            className={`
                                                            max-w-[80%] rounded-[20px] px-3 py-2 shadow-sm text-sm relative group
                                                            ${isMe
                                                                    ? "bg-black text-white rounded-tr-none"
                                                                    : "bg-white text-gray-900 rounded-tl-none border border-gray-100"
                                                                }
                                                        `}
                                                        >
                                                            <p className="whitespace-pre-wrap leading-relaxed pb-4 text-[13.5px]">{msg.content}</p>

                                                            <div className="absolute bottom-1 right-2 flex items-center gap-[3px]">
                                                                <span className={`text-[10px] ${isMe ? "text-white/60" : "text-gray-400"}`}>{formatTime(msg.timestamp)}</span>
                                                                {isMe && <StatusIcon status={msg.status || (recipient.status === "Replied" || recipient.status === "Opened" ? "read" : "sent")} />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                    <div ref={scrollEndRef} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-slate-100 flex items-end gap-2 z-20 flex-shrink-0">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            className="flex-1 min-h-[40px] max-h-[200px] resize-none border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-slate-300 focus:ring-0 bg-slate-50 placeholder:text-slate-400 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                            rows={1}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim()}
                            className="h-[40px] w-[40px] flex items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        >
                            <Send className="w-5 h-5 ml-0.5" />
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
