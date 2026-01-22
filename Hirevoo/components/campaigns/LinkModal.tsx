"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!url.trim()} className="bg-violet-600 hover:bg-violet-700">
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}