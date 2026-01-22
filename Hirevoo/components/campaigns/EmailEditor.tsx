"use client"

import { useState, useEffect, useCallback } from "react"
import {
  User,
  Building2,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Bold,
  Italic,
  Link2,
  Paperclip,
  Smile,
  AlertCircle,
  ImageIcon,
  Lock,
  PenTool,
  MoreVertical,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CampaignContact } from "@/types"
import { AIAssistantModal } from "./AIAssistantModal"

interface EmailEditorProps {
  contact: CampaignContact | null
  onSaveDraft: (contactId: string, subject: string, body: string) => void
  onMarkDone: (contactId: string, subject: string, body: string) => void
  onGenerateEmail?: (prompt: string, tone: string) => void
  onCopyToEditor?: (text: string) => void
  isGeneratingEmail?: boolean
}

export function EmailEditor({
  contact,
  onSaveDraft,
  onMarkDone,
  onGenerateEmail,
  onCopyToEditor,
  isGeneratingEmail,
}: EmailEditorProps) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)

  useEffect(() => {
    if (contact) {
      setSubject(contact.emailSubject || "")
      setBody(contact.emailBody || "")
    } else {
      setSubject("")
      setBody("")
    }
  }, [contact?.id])

  useEffect(() => {
    if (!contact || (!subject && !body)) return

    const timer = setTimeout(() => {
      onSaveDraft(contact.id, subject, body)
    }, 1000)

    return () => clearTimeout(timer)
  }, [subject, body, contact?.id])

  const handleSaveDraft = useCallback(() => {
    if (!contact) return
    setIsSaving(true)
    onSaveDraft(contact.id, subject, body)
    setTimeout(() => setIsSaving(false), 500)
  }, [contact, subject, body, onSaveDraft])

  const handleMarkDone = useCallback(() => {
    if (!contact || !subject || !body) return
    onMarkDone(contact.id, subject, body)
  }, [contact, subject, body, onMarkDone])

  const handleCopyToEditorFromAI = (text: string) => {
    const lines = text.split("\n")
    const newSubject = lines[0] || ""
    const newBody = lines.slice(1).join("\n")
    setSubject(newSubject)
    setBody(newBody)
    if (contact) {
      onSaveDraft(contact.id, newSubject, newBody)
    }
    setIsAIModalOpen(false)
  }


  if (!contact) {
    return (
      <Card className="h-full flex items-center justify-center bg-card border border-border rounded-lg">
        <CardContent className="text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">Select a contact to compose an email</p>
        </CardContent>
      </Card>
    )
  }

  const isDone = contact.emailStatus === "done"
  const canMarkDone = subject.trim() && body.trim()

  return (
    <Card className="h-full flex flex-col border border-border bg-card rounded-lg overflow-hidden">
      <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 border-b border-border space-y-1.5 sm:space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm font-semibold text-foreground">Email Editor</h2>
            <span className="text-xs text-muted-foreground">• AI assisted</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsAIModalOpen(true)}
              variant="ghost"
              size="sm"
              className="h-6 sm:h-7 px-2 sm:px-3 text-xs gap-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              AI
            </Button>
            {isDone && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 h-5 sm:h-6 text-xs flex items-center gap-1 px-2 py-0.5">
                <CheckCircle className="w-3 h-3" />
                Done
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-xs">{contact.name}</p>
            <p className="text-muted-foreground truncate text-xs">{contact.email}</p>
          </div>
          {contact.company && (
            <div className="hidden sm:flex items-center gap-1 text-muted-foreground flex-shrink-0">
              <Building2 className="w-3 h-3" />
              <span className="truncate text-xs">{contact.company}</span>
            </div>
          )}
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col pt-2 sm:pt-3 px-2.5 sm:px-4 space-y-2 sm:space-y-3 overflow-hidden">
        {/* Subject input */}
        <div className="space-y-1">
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject line..."
            className={cn("text-xs sm:text-sm h-7 sm:h-8 px-2 py-1", isDone && "bg-muted")}
          />
        </div>

        {/* Body textarea - takes remaining space */}
        <div className="flex-1 flex flex-col space-y-1 min-h-0">
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email here..."
            className={cn("flex-1 min-h-[300px] sm:min-h-[400px] resize-none text-xs sm:text-sm p-2", isDone && "bg-muted")}
          />
        </div>

        <div className="flex items-center gap-1 pt-2 border-t border-border flex-wrap">
          <Button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="gap-1 h-7 sm:h-8 text-xs px-2 sm:px-3 bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
          >
            {isSaving ? "Saving..." : "Send"}
          </Button>

          <div className="flex items-center gap-0.5 sm:gap-1 ml-auto flex-wrap justify-end">
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="Bold">
              <Bold className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="Italic">
              <Italic className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60"
              title="Attachment"
            >
              <Paperclip className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="Link">
              <Link2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="Emoji">
              <Smile className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="Alert">
              <AlertCircle className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="Image">
              <ImageIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="Confidential">
              <Lock className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="Signature">
              <PenTool className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>


            <Button variant="ghost" size="sm" className="h-6 sm:h-7 w-6 sm:w-7 p-0 hover:bg-muted/60" title="More">
              <MoreVertical className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 sm:h-7 w-6 sm:w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Delete"
            >
              <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Button
            onClick={handleMarkDone}
            disabled={!canMarkDone}
            className={cn(
              "gap-1 flex-1 h-7 sm:h-8 text-xs px-2 sm:px-3",
              isDone ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700",
            )}
          >
            {isDone ? (
              <>
                <CheckCircle className="w-3 h-3" />
                <span className="hidden sm:inline">Done</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Done & Next</span>
                <span className="sm:hidden">Done</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </Button>
        </div>
      </CardContent>

      {/* AI Assistant Modal */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onGenerateEmail={onGenerateEmail}
        onCopyToEditor={handleCopyToEditorFromAI}
        isLoading={isGeneratingEmail}
      />

    </Card>
  )
}
