"use client"

import { Search, CheckCircle2, Circle, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { Contact } from "@/components/campaigns/compose-ui/compose-review-page"

interface ContactSidebarProps {
    contacts: Contact[]
    selectedContact: Contact
    onSelectContact: (contact: Contact) => void
    searchQuery: string
    onSearchChange: (query: string) => void
}

export function ContactSidebar({
    contacts,
    selectedContact,
    onSelectContact,
    searchQuery,
    onSearchChange,
}: ContactSidebarProps) {
    const getStatusIcon = (status: Contact["status"]) => {
        switch (status) {
            case "ready":
                return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            case "pending":
                return <Clock className="w-4 h-4 text-amber-500" />
            default:
                return <Circle className="w-4 h-4 text-slate-300" />
        }
    }

    return (
        <div className="hidden md:flex w-full border-r bg-white flex-col">
            <div className="p-3 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search contacts"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-9 h-9 bg-muted/50 border-0"
                    />
                </div>
            </div>

            {/* Contact List */}
            <ScrollArea className="flex-1">
                <div className="py-1">
                    {contacts.length === 0 ? (
                        <div className="px-4 py-8 text-center text-muted-foreground text-sm">No contacts found</div>
                    ) : (
                        contacts.map((contact) => (
                            <button
                                key={contact.id}
                                onClick={() => onSelectContact(contact)}
                                className={cn(
                                    "w-full px-3 py-3 flex items-center gap-3 transition-all text-left border-l-4 border-transparent",
                                    selectedContact?.id === contact.id ? "bg-violet-100 border-l-violet-600" : "hover:bg-slate-50",
                                )}
                            >
                                {/* Avatar */}
                                <div
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0",
                                        contact.avatarColor,
                                    )}
                                >
                                    {contact.avatar}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm text-foreground truncate">{contact.name}</p>
                                        {getStatusIcon(contact.status)}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                                </div>

                                <div className="flex flex-col items-center gap-0.5">
                                    <div
                                        className={cn(
                                            "w-2.5 h-2.5 rounded-full shrink-0 transition-colors",
                                            contact.status === "ready"
                                                ? "bg-emerald-500"
                                                : contact.status === "pending"
                                                    ? "bg-amber-500"
                                                    : "bg-slate-300",
                                        )}
                                    />
                                    <span className="text-[9px] text-muted-foreground capitalize">{contact.status}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
