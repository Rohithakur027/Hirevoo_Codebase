"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SaveTemplateModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (name: string) => void
}

export function SaveTemplateModal({ isOpen, onClose, onSave }: SaveTemplateModalProps) {
    const [templateName, setTemplateName] = useState("")

    const handleSave = () => {
        if (templateName.trim()) {
            onSave(templateName.trim())
            setTemplateName("")
            onClose()
        }
    }

    const handleClose = () => {
        setTemplateName("")
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent showCloseButton={false} className="sm:max-w-md p-0 gap-0">
                <div className="flex items-center justify-between p-5 pb-4 border-b">
                    <h2 className="text-lg font-semibold">Save as Template</h2>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 hover:bg-muted">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-4 p-5">
                    <div className="space-y-2">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input
                            id="template-name"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g., Professional Introduction"
                            onKeyDown={(e) => e.key === "Enter" && handleSave()}
                            autoFocus
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Your template will be saved and available in the &quot;My Saved Templates&quot; tab.
                    </p>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t bg-muted/20">
                    <Button variant="ghost" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!templateName.trim()}
                        className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        Save Template
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
