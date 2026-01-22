"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LinkModalProps {
    isOpen: boolean
    onClose: () => void
    onInsert: (url: string, text: string) => void
}

export function LinkModal({ isOpen, onClose, onInsert }: LinkModalProps) {
    const [url, setUrl] = useState("")
    const [displayText, setDisplayText] = useState("")

    const handleInsert = () => {
        if (url.trim()) {
            onInsert(url.trim(), displayText.trim() || url.trim())
            setUrl("")
            setDisplayText("")
            onClose()
        }
    }

    const handleClose = () => {
        setUrl("")
        setDisplayText("")
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent showCloseButton={false} className="sm:max-w-md p-0 gap-0">
                <div className="flex items-center justify-between p-5 pb-4 border-b">
                    <h2 className="text-lg font-semibold">Insert Link</h2>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 hover:bg-muted">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-4 p-5">
                    <div className="space-y-2">
                        <Label htmlFor="url">URL</Label>
                        <Input
                            id="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="display-text">Display Text (optional)</Label>
                        <Input
                            id="display-text"
                            value={displayText}
                            onChange={(e) => setDisplayText(e.target.value)}
                            placeholder="Click here"
                            onKeyDown={(e) => e.key === "Enter" && handleInsert()}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t bg-muted/20">
                    <Button variant="ghost" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleInsert}
                        disabled={!url.trim()}
                        className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        Insert
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
