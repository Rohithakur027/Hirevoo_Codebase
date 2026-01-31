"use client"

import { useState, useCallback, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import {
    Bold,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Undo,
    Redo,
    Sparkles,
    Paperclip,
    Braces,
    X,
    ChevronRight,
    ChevronLeft,
    FileText,
    Save,
    Copy
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { AttachmentModal, type AttachedFile } from "./attachment-modal"
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

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: "Start writing your email here...",
                emptyEditorClass: "is-editor-empty before:content-[attr(data-placeholder)] before:text-gray-400 before:float-left before:pointer-events-none",
            }),
            Link.configure({
                openOnClick: false,
            }),
        ],
        content: emailBody,
        editorProps: {
            attributes: {
                class: "prose prose-sm sm:prose-base focus:outline-none min-h-[300px] w-full max-w-none p-4",
            },
        },
        onUpdate: ({ editor }) => {
            // Store plain text in the database, not HTML
            setEmailBody(editor.getText())
        },
    })

    // Sync editor content when emailBody changes externally (contact switch, template selection)
    useEffect(() => {
        if (editor && emailBody !== editor.getText()) {
            editor.commands.setContent(emailBody)
        }
    }, [emailBody, editor])

    const handleInsertVariable = () => {
        const firstName = selectedContact?.name?.split(' ')[0] || '{FirstName}'
        editor?.chain().focus().insertContent(firstName).run()
    }

    const toggleBold = () => editor?.chain().focus().toggleBold().run()
    const toggleItalic = () => editor?.chain().focus().toggleItalic().run()
    const toggleLink = () => {
        const previousUrl = editor?.getAttributes('link').href
        const url = window.prompt('URL', previousUrl)
        if (url === null) return
        if (url === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }
        editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
    const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run()
    const toggleOrderedList = () => editor?.chain().focus().toggleOrderedList().run()
    const undo = () => editor?.chain().focus().undo().run()
    const redo = () => editor?.chain().focus().redo().run()

    const ToolbarButton = ({ onClick, isActive, icon: Icon, title }: any) => (
        <button
            onClick={onClick}
            className={cn(
                "p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors",
                isActive ? "bg-gray-200 text-black" : ""
            )}
            title={title}
            type="button"
        >
            <Icon className="w-4 h-4" />
        </button>
    )

    const handleAttachFiles = (files: AttachedFile[]) => {
        setAttachedFiles((prev) => [...prev, ...files])
    }

    const removeAttachment = (fileId: string) => {
        setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))
    }

    if (!selectedContact) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground p-8">
                Select a contact to start composing.
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="flex-1 flex flex-col bg-white min-w-0 h-full overflow-y-auto">
                {/* Top Controls: Templates & Save */}
                <div className="px-4 md:px-6 py-3 border-b flex items-center justify-between gap-2 bg-gray-50/50">
                    {/* Use Template for All Toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="use-template-for-all"
                                    checked={useTemplateForAll}
                                    onCheckedChange={setUseTemplateForAll}
                                    className="data-[state=checked]:bg-black"
                                />
                                <label
                                    htmlFor="use-template-for-all"
                                    className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer select-none"
                                >
                                    <Copy className="w-4 h-4 text-gray-500" />
                                    <span className="hidden sm:inline">Apply to All</span>
                                </label>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px]">
                            <p>When enabled, this email content will be copied to all other contacts</p>
                        </TooltipContent>
                    </Tooltip>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={onOpenTemplates}
                            className="gap-2 bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 shadow-sm whitespace-nowrap cursor-pointer rounded-[6px] transition-all"
                        >
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="hidden sm:inline font-medium">Browse Templates</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={onOpenSaveTemplate}
                            className="gap-2 bg-white border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 shadow-sm whitespace-nowrap cursor-pointer rounded-[6px] transition-all"
                        >
                            <Save className="w-4 h-4 text-gray-500" />
                            <span className="hidden sm:inline font-medium">Save Template</span>
                        </Button>
                    </div>
                </div>

                {/* Header Section: To, Cc, Bcc */}
                <div className="px-4 md:px-6 py-4 space-y-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="font-medium text-gray-700">To:</span>
                                <Badge variant="secondary" className="font-normal bg-gray-100 text-gray-800 hover:bg-gray-200">
                                    {selectedContact.name} &lt;{selectedContact.email}&gt;
                                </Badge>
                            </div>
                            <div className="flex gap-3 text-xs">
                                <button onClick={() => setShowCc(!showCc)} className="text-gray-500 hover:text-gray-900 font-medium">Cc</button>
                                <button onClick={() => setShowBcc(!showBcc)} className="text-gray-500 hover:text-gray-900 font-medium">Bcc</button>
                            </div>
                        </div>

                        {showCc && (
                            <Input
                                placeholder="Cc: email@example.com"
                                value={ccValue}
                                onChange={e => setCcValue(e.target.value)}
                                className="h-9 text-sm"
                            />
                        )}
                        {showBcc && (
                            <Input
                                placeholder="Bcc: email@example.com"
                                value={bccValue}
                                onChange={e => setBccValue(e.target.value)}
                                className="h-9 text-sm"
                            />
                        )}

                        <Input
                            placeholder="Subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="text-lg font-medium border-0 px-0 focus-visible:ring-0 placeholder:text-gray-400"
                        />
                    </div>
                </div>

                {/* Rich Text Editor Container */}
                <div className="px-4 md:px-6 pb-6 flex-1 flex flex-col min-h-0">
                    <div className="flex-1 flex flex-col border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white hover:border-gray-300 transition-colors">

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                                <ToolbarButton onClick={toggleBold} isActive={editor?.isActive('bold')} icon={Bold} title="Bold" />
                                <ToolbarButton onClick={toggleItalic} isActive={editor?.isActive('italic')} icon={Italic} title="Italic" />
                                <ToolbarButton onClick={toggleLink} isActive={editor?.isActive('link')} icon={LinkIcon} title="Link" />
                                <div className="w-px h-4 bg-gray-300 mx-1" />
                                <ToolbarButton onClick={toggleBulletList} isActive={editor?.isActive('bulletList')} icon={List} title="Bullet List" />
                                <ToolbarButton onClick={toggleOrderedList} isActive={editor?.isActive('orderedList')} icon={ListOrdered} title="Ordered List" />
                                <div className="w-px h-4 bg-gray-300 mx-1" />
                                <ToolbarButton onClick={undo} icon={Undo} title="Undo" />
                                <ToolbarButton onClick={redo} icon={Redo} title="Redo" />
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleInsertVariable}
                                    className="h-7 px-3 text-xs bg-white hover:bg-gray-50 border-gray-300 text-gray-700 rounded-full"
                                >
                                    <Braces className="w-3 h-3 mr-1.5" />
                                    Variables
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={onOpenAI}
                                    className="h-7 px-3 text-xs bg-[#ccff00] hover:bg-[#bbe600] text-black font-medium border-0 rounded-[6px]"
                                >
                                    <Sparkles className="w-3 h-3 mr-1.5" />
                                    AI Assistant
                                </Button>
                            </div>
                        </div>

                        {/* Editor Body */}
                        <div className="flex-1 overflow-y-auto min-h-[300px] cursor-text bg-white" onClick={() => editor?.chain().focus().run()}>
                            <EditorContent editor={editor} />
                        </div>

                        {/* Attachments Section */}
                        {attachedFiles.length > 0 && (
                            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 flex flex-wrap gap-2">
                                {attachedFiles.map((file) => (
                                    <div key={file.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs text-gray-600 shadow-sm">
                                        <Paperclip className="w-3 h-3" />
                                        <span className="max-w-[150px] truncate">{file.name}</span>
                                        <button onClick={() => removeAttachment(file.id)} className="hover:text-red-500 ml-1">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 h-9 w-9 p-0 rounded-full"
                                onClick={() => setIsAttachmentModalOpen(true)}
                                title="Attach File"
                            >
                                <Paperclip className="w-5 h-5" />
                            </Button>

                            <div className="flex items-center gap-3">
                                {/* Navigation Buttons for Campaign Flow */}
                                {totalContacts > 1 && (
                                    <div className="flex items-center gap-1 mr-2 text-gray-400">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:text-gray-900 disabled:opacity-30"
                                            onClick={onPrevious}
                                            disabled={isFirstContact}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="text-xs font-medium min-w-[3rem] text-center">
                                            {currentIndex + 1} / {totalContacts}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:text-gray-900 disabled:opacity-30"
                                            onClick={onDoneAndNext}
                                            disabled={isLastContact}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}

                                <Button
                                    onClick={onSend ? onSend : onDoneAndNext}
                                    className="bg-black hover:bg-gray-800 text-white h-9 px-6 text-sm font-medium rounded-[6px]"
                                >
                                    {submitLabel || (allReady || isLastContact ? "Submit Campaign" : "Done & Next")}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <AttachmentModal
                    isOpen={isAttachmentModalOpen}
                    onClose={() => setIsAttachmentModalOpen(false)}
                    onAttach={handleAttachFiles}
                />
            </div>
        </TooltipProvider>
    )
}
