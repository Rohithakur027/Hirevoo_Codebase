"use client"
import { useState } from "react"
import { X, Send, Copy, Check, Sparkles, Mail, FileText, MessageSquare } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface AIAssistantModalProps {
    isOpen: boolean
    onClose: () => void
    onInsertText: (text: string) => void
}

type Message = {
    id: string
    role: "user" | "assistant"
    content: string
}

const suggestionCards = [
    {
        icon: Mail,
        title: "Ask for a Referral",
        subtitle: "of João Pedro",
    },
    {
        icon: FileText,
        title: "Cover Letter Helper",
        subtitle: "Carlos Alcaraz",
    },
    {
        icon: MessageSquare,
        title: "Follow-up Email",
        subtitle: "for Declan Rice",
    },
]

export function AIAssistantModal({ isOpen, onClose, onInsertText }: AIAssistantModalProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState("")
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [creditsUsed, setCreditsUsed] = useState(0)

    const handleSend = async () => {
        if (!inputValue.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: inputValue,
        }

        setMessages((prev) => [...prev, userMessage])
        setInputValue("")
        setIsLoading(true)

        setTimeout(() => {
            const aiResponse: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `Here's a suggestion based on your request:\n\nHi {FirstName},\n\nI hope this email finds you well. I wanted to reach out regarding ${inputValue.toLowerCase().includes("referral")
                        ? "a potential opportunity at your company"
                        : "our previous conversation"
                    }.\n\nI would greatly appreciate any guidance or insights you could share.\n\nBest regards,\n[Your Name]`,
            }
            setMessages((prev) => [...prev, aiResponse])
            setCreditsUsed((prev) => Math.min(prev + 1, 5))
            setIsLoading(false)
        }, 1500)
    }

    const handleCopy = async (content: string, id: string) => {
        await navigator.clipboard.writeText(content)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleSuggestionClick = (title: string, subtitle: string) => {
        setInputValue(`${title} ${subtitle}`)
    }

    const handleInsert = (content: string) => {
        onInsertText(content)
        onClose()
    }

    const handleClose = () => {
        setMessages([])
        setInputValue("")
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent
                showCloseButton={false}
                className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden max-h-[90vh] md:max-h-[85vh] border shadow-xl bg-background"
            >
                <div className="relative bg-background min-h-[500px] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-foreground">AI Assistant</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Credits badge - small and clean */}
                            <span className="text-xs bg-rose-50 text-rose-600 px-2 py-1 rounded-full font-medium border border-rose-200">
                                Free Tier: {creditsUsed}/5 Credits Used
                            </span>
                            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 hover:bg-muted">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <ScrollArea className="flex-1 px-4 md:px-6">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10">
                                {/* Animated gradient orb - visual only */}
                                <div className="relative w-24 h-24 mb-6">
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-cyan-400 opacity-30 blur-xl animate-pulse" />
                                    <div className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 opacity-50 blur-md" />
                                    <div
                                        className="absolute inset-4 rounded-full"
                                        style={{
                                            background: "linear-gradient(135deg, #8b5cf6, #d946ef, #06b6d4)",
                                            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                            WebkitMaskComposite: "xor",
                                            maskComposite: "exclude",
                                            padding: "3px",
                                        }}
                                    />
                                </div>

                                {/* Greeting */}
                                <h2 className="text-2xl font-semibold text-foreground mb-1">Hey there</h2>
                                <p className="text-lg text-muted-foreground mb-8">How can I assist you?</p>

                                {/* Suggestion Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                                    {suggestionCards.map((card, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSuggestionClick(card.title, card.subtitle)}
                                            className="flex flex-col items-start gap-2 p-4 rounded-xl bg-muted/50 border border-border hover:bg-muted hover:border-muted-foreground/30 transition-all text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                                <card.icon className="w-4 h-4 text-violet-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{card.title}</p>
                                                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 py-4">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[85%] rounded-2xl px-4 py-3 relative group",
                                                message.role === "user"
                                                    ? "bg-violet-600 text-white"
                                                    : "bg-muted border border-border text-foreground",
                                            )}
                                        >
                                            <p className="text-sm whitespace-pre-line leading-relaxed">{message.content}</p>

                                            {message.role === "assistant" && (
                                                <div className="absolute -bottom-9 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleCopy(message.content, message.id)}
                                                        className="h-7 text-xs gap-1"
                                                    >
                                                        {copiedId === message.id ? (
                                                            <>
                                                                <Check className="w-3 h-3" />
                                                                Copied
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="w-3 h-3" />
                                                                Copy
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        onClick={() => handleInsert(message.content)}
                                                        className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
                                                    >
                                                        Insert
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-muted border border-border rounded-2xl px-4 py-3">
                                            <div className="flex gap-1.5">
                                                <span
                                                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                                                    style={{ animationDelay: "0ms" }}
                                                />
                                                <span
                                                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                                                    style={{ animationDelay: "150ms" }}
                                                />
                                                <span
                                                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                                                    style={{ animationDelay: "300ms" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Input Footer */}
                    <div className="p-4 border-t mt-auto">
                        <div className="flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2 border border-border">
                            <Sparkles className="w-4 h-4 text-violet-500" />
                            <Input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Ask AI a question or make a request..."
                                className="border-0 bg-transparent focus-visible:ring-0 flex-1 h-9 text-foreground placeholder:text-muted-foreground"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isLoading}
                                className="h-9 w-9 shrink-0 rounded-full hover:bg-violet-100 text-violet-600"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
