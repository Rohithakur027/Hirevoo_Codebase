"use client"

import { useState, useRef } from "react"
import {
    FileText,
    Save,
    Sparkles,
    Paperclip,
    Braces,
    X,
    ChevronRight,
    ChevronLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AttachmentModal, type AttachedFile } from "./attachment-modal"
import { TiptapEditor } from "./tiptap-editor"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Contact } from "./compose-review-page"

interface EmailEditorProps {
    selectedContact: Contact
    subject: string
    setSubject: (subject: string) => void
    emailBody: string
    setEmailBody: (body: string) => void
    useTemplateForAll: boolean
    setUseTemplateForAll: (value: boolean) => void
    onOpenTemplates: () => void
    onOpenAI: () => void
    onOpenSaveTemplate: () => void
    onDoneAndNext: () => void
    onPrevious: () => void
    isLastContact: boolean
    isFirstContact: boolean
    allReady: boolean
    currentIndex: number
    totalContacts: number
    campaignId?: string
    submitLabel?: string
    onSend?: () => void
}

export function EmailEditor({
    selectedContact,
    subject,
    setSubject,
    emailBody,
    setEmailBody,
    useTemplateForAll,
    setUseTemplateForAll,
    onOpenTemplates,
    onOpenAI,
    onOpenSaveTemplate,
    onDoneAndNext,
    onPrevious,
    isLastContact,
    isFirstContact,
    allReady,
    currentIndex,
    totalContacts,
    campaignId,
    submitLabel,
    onSend,
}: EmailEditorProps) {
    const [showCc, setShowCc] = useState(false)
    const [showBcc, setShowBcc] = useState(false)
    const [ccValue, setCcValue] = useState("")
    const [bccValue, setBccValue] = useState("")
    const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false)
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])

    // Handle case when no contact is selected
    if (!selectedContact) {
        return (
            <Card className="h-full flex items-center justify-center bg-card border border-border rounded-lg">
                <CardContent className="text-center">
                    <p className="text-xs sm:text-sm text-muted-foreground">Select a contact to compose an email</p>
                </CardContent>
            </Card>
        )
    }

    const handleInsertVariable = () => {
        setEmailBody(emailBody + "{FirstName}")
    }

    const handleAttachFiles = (files: AttachedFile[]) => {
        setAttachedFiles((prev) => [...prev, ...files])
    }

    const removeAttachment = (fileId: string) => {
        setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex-1 flex flex-col bg-white min-w-0 h-full">
                {/* Step Indicator Header - Only show if part of campaign flow */}
                {!submitLabel && (
                    <div className="px-4 md:px-6 py-2 border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-primary">Step 2/3</span>
                                <span className="text-xs text-muted-foreground">Compose Emails</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {currentIndex + 1} of {totalContacts} contacts
                            </span>
                        </div>
                    </div>
                )} { /* ... existing code ... */}


                {/* Header Row 1 - To Field */}
                <div className="px-4 md:px-6 py-3 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm text-muted-foreground font-medium">To</span>
                            <Badge
                                variant="secondary"
                                className="gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-foreground font-normal text-xs md:text-sm"
                            >
                                {selectedContact.name}
                                <span className="text-muted-foreground hidden sm:inline">&lt;{selectedContact.email}&gt;</span>
                            </Badge>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowCc(!showCc)}
                                    className={cn(
                                        "text-sm transition-colors cursor-pointer",
                                        showCc ? "text-violet-600 font-medium" : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    Cc
                                </button>
                                <span className="text-muted-foreground">/</span>
                                <button
                                    onClick={() => setShowBcc(!showBcc)}
                                    className={cn(
                                        "text-sm transition-colors cursor-pointer",
                                        showBcc ? "text-violet-600 font-medium" : "text-muted-foreground hover:text-foreground",
                                    )}
                                >
                                    Bcc
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs md:text-sm text-muted-foreground">Use Template for All</span>
                            <Switch checked={useTemplateForAll} onCheckedChange={setUseTemplateForAll} />
                        </div>
                    </div>

                    {showCc && (
                        <div className="flex items-center gap-4 mt-3 animate-in slide-in-from-top-2 duration-200">
                            <span className="text-sm text-muted-foreground font-medium w-6">Cc</span>
                            <div className="flex-1 flex items-center gap-2">
                                <Input
                                    value={ccValue}
                                    onChange={(e) => setCcValue(e.target.value)}
                                    placeholder="Enter email addresses..."
                                    className="h-9 flex-1"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setShowCc(false)
                                        setCcValue("")
                                    }}
                                    className="h-8 w-8 shrink-0 cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {showBcc && (
                        <div className="flex items-center gap-4 mt-3 animate-in slide-in-from-top-2 duration-200">
                            <span className="text-sm text-muted-foreground font-medium w-6">Bcc</span>
                            <div className="flex-1 flex items-center gap-2">
                                <Input
                                    value={bccValue}
                                    onChange={(e) => setBccValue(e.target.value)}
                                    placeholder="Enter email addresses..."
                                    className="h-9 flex-1"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setShowBcc(false)
                                        setBccValue("")
                                    }}
                                    className="h-8 w-8 shrink-0 cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Header Row 2 - Subject */}
                <div className="px-4 md:px-6 py-3 border-b">
                    <Input
                        placeholder="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="border-0 text-base md:text-lg font-medium px-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground"
                    />
                </div>

                {/* Toolbar Row */}
                <div className="px-4 md:px-6 py-3 border-b flex items-center justify-between bg-muted/20 overflow-x-auto">
                    <div className="flex items-center gap-2 shrink-0">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onOpenTemplates}
                                    className="gap-2 bg-background border-muted-foreground/20 hover:bg-muted hover:border-muted-foreground/30 whitespace-nowrap cursor-pointer"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span className="hidden sm:inline">Browse Templates</span>
                                    <span className="sm:hidden">Templates</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-center">
                                <p className="font-medium">100+ Professional Templates</p>
                                <p className="text-xs text-muted-foreground">Choose from proven templates to boost your response rate</p>
                            </TooltipContent>
                        </Tooltip>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onOpenSaveTemplate}
                            className="gap-2 bg-background border-muted-foreground/20 hover:bg-muted hover:border-muted-foreground/30 whitespace-nowrap cursor-pointer"
                        >
                            <Save className="w-4 h-4" />
                            <span className="hidden sm:inline">Save Template</span>
                            <span className="sm:hidden">Save</span>
                        </Button>
                    </div>
                    <Button
                        size="sm"
                        onClick={onOpenAI}
                        className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shrink-0 ml-2 cursor-pointer"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden sm:inline">AI Assistant</span>
                        <span className="sm:hidden">AI</span>
                    </Button>
                </div>

                {/* Attachments Display */}
                {attachedFiles.length > 0 && (
                    <div className="px-4 md:px-6 py-2 border-b bg-muted/10">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Attachments:</span>
                            {attachedFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-1.5 bg-background border rounded-full px-2.5 py-1 text-xs"
                                >
                                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                                    <span className="max-w-[120px] truncate">{file.name}</span>
                                    <button
                                        onClick={() => removeAttachment(file.id)}
                                        className="text-muted-foreground hover:text-destructive ml-1 cursor-pointer"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Email Body - Tiptap Editor */}
                <div className="flex-1 px-4 md:px-6 py-4 overflow-auto">
                    <TiptapEditor
                        content={emailBody}
                        onChange={setEmailBody}
                        placeholder="Write your email here..."
                    />
                </div>

                {/* Desktop Footer */}
                <div className="hidden md:flex px-6 py-3 border-t items-center justify-between bg-background">
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={onSend}
                            className={cn("bg-violet-600 hover:bg-violet-700 text-white font-medium cursor-pointer", !onSend && "hidden")}
                        >
                            Send Now
                        </Button>
                        <div className={cn("flex items-center gap-0.5 ml-2 border-l pl-3", !onSend && "ml-0 border-l-0 pl-0")}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-muted cursor-pointer"
                                onClick={() => setIsAttachmentModalOpen(true)}
                                title="Attach Files"
                            >
                                <Paperclip className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleInsertVariable}
                            className="gap-2 ml-2 bg-background border-muted-foreground/20 hover:bg-muted cursor-pointer"
                        >
                            <Braces className="w-4 h-4" />
                            Variables
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={allReady || isLastContact || submitLabel ? "default" : "outline"}
                            size="sm"
                            onClick={onDoneAndNext}
                            className={cn(
                                "gap-1.5 cursor-pointer",
                                (allReady || isLastContact || submitLabel)
                                    ? "bg-violet-600 hover:bg-violet-700 text-white"
                                    : "bg-background border-muted-foreground/20 hover:bg-muted",
                            )}
                        >
                            {submitLabel || (allReady ? "Submit Campaign" : isLastContact ? "Submit Campaign" : "Done & Next")}
                            {!allReady && !isLastContact && <ChevronRight className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {/* Mobile Footer */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
                    {/* Row 1: Actions */}
                    <div className="flex items-center justify-center gap-1 px-4 py-2 border-b">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 cursor-pointer"
                            onClick={() => setIsAttachmentModalOpen(true)}
                        >
                            <Paperclip className="w-5 h-5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleInsertVariable} className="gap-1 h-10 bg-transparent cursor-pointer">
                            <Braces className="w-4 h-4" />
                            Vars
                        </Button>
                    </div>
                    {/* Row 2: Navigation */}
                    <div className="flex items-center justify-between px-4 py-3">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onPrevious}
                            disabled={isFirstContact}
                            className="h-11 w-11 bg-transparent cursor-pointer"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <Button
                            onClick={onDoneAndNext}
                            className="flex-1 mx-3 h-11 bg-violet-600 hover:bg-violet-700 text-white font-medium cursor-pointer"
                        >
                            {allReady || isLastContact ? "Submit Campaign" : `Done & Next (${currentIndex + 1}/${totalContacts})`}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onDoneAndNext}
                            disabled={isLastContact}
                            className="h-11 w-11 bg-transparent cursor-pointer"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Spacer for mobile fixed footer */}
                <div className="h-32 md:hidden" />

                {/* Modals */}
                <AttachmentModal
                    isOpen={isAttachmentModalOpen}
                    onClose={() => setIsAttachmentModalOpen(false)}
                    onAttach={handleAttachFiles}
                />
            </div>
        </TooltipProvider>
    )
}
