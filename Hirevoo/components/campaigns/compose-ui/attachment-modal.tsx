"use client"

import type React from "react"

import { useState, useRef } from "react"
import { X, Upload, Cloud, Monitor, FileText, ImageIcon, File, Check } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AttachmentModalProps {
    isOpen: boolean
    onClose: () => void
    onAttach: (files: AttachedFile[]) => void
}

export type AttachedFile = {
    id: string
    name: string
    size: string
    type: string
    source: "local" | "drive"
}

export function AttachmentModal({ isOpen, onClose, onAttach }: AttachmentModalProps) {
    const [activeTab, setActiveTab] = useState<"local" | "drive">("local")
    const [selectedFiles, setSelectedFiles] = useState<AttachedFile[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Mock Google Drive files
    const driveFiles: AttachedFile[] = [
        { id: "d1", name: "Project_Proposal.pdf", size: "2.4 MB", type: "pdf", source: "drive" },
        { id: "d2", name: "Resume_2024.docx", size: "156 KB", type: "doc", source: "drive" },
        { id: "d3", name: "Portfolio_Screenshots.zip", size: "15.2 MB", type: "zip", source: "drive" },
        { id: "d4", name: "Cover_Letter.pdf", size: "89 KB", type: "pdf", source: "drive" },
        { id: "d5", name: "References.docx", size: "45 KB", type: "doc", source: "drive" },
    ]

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files) {
            const newFiles: AttachedFile[] = Array.from(files).map((file, index) => ({
                id: `local-${Date.now()}-${index}`,
                name: file.name,
                size: formatFileSize(file.size),
                type: file.name.split(".").pop() || "file",
                source: "local" as const,
            }))
            setSelectedFiles((prev) => [...prev, ...newFiles])
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B"
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
        return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const files = e.dataTransfer.files
        if (files) {
            const newFiles: AttachedFile[] = Array.from(files).map((file, index) => ({
                id: `local-${Date.now()}-${index}`,
                name: file.name,
                size: formatFileSize(file.size),
                type: file.name.split(".").pop() || "file",
                source: "local" as const,
            }))
            setSelectedFiles((prev) => [...prev, ...newFiles])
        }
    }

    const toggleDriveFile = (file: AttachedFile) => {
        const exists = selectedFiles.find((f) => f.id === file.id)
        if (exists) {
            setSelectedFiles((prev) => prev.filter((f) => f.id !== file.id))
        } else {
            setSelectedFiles((prev) => [...prev, file])
        }
    }

    const removeFile = (fileId: string) => {
        setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId))
    }

    const handleAttach = () => {
        onAttach(selectedFiles)
        setSelectedFiles([])
        onClose()
    }

    const handleClose = () => {
        setSelectedFiles([])
        onClose()
    }

    const getFileIcon = (type: string) => {
        if (["jpg", "jpeg", "png", "gif", "webp"].includes(type.toLowerCase())) {
            return <ImageIcon className="w-4 h-4 text-blue-500" />
        }
        if (["pdf"].includes(type.toLowerCase())) {
            return <FileText className="w-4 h-4 text-red-500" />
        }
        if (["doc", "docx"].includes(type.toLowerCase())) {
            return <FileText className="w-4 h-4 text-blue-600" />
        }
        return <File className="w-4 h-4 text-muted-foreground" />
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent showCloseButton={false} className="max-w-lg p-0 gap-0 overflow-hidden">
                <div className="flex items-center justify-between p-5 pb-4 border-b">
                    <h2 className="text-lg font-semibold">Attach Files</h2>
                    <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 hover:bg-muted">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab("local")}
                        className={cn(
                            "flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors",
                            activeTab === "local"
                                ? "text-violet-600 border-violet-600 bg-violet-50/50"
                                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50",
                        )}
                    >
                        <Monitor className="w-4 h-4" />
                        My Computer
                    </button>
                    <button
                        onClick={() => setActiveTab("drive")}
                        className={cn(
                            "flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors",
                            activeTab === "drive"
                                ? "text-violet-600 border-violet-600 bg-violet-50/50"
                                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50",
                        )}
                    >
                        <Cloud className="w-4 h-4" />
                        Google Drive
                    </button>
                </div>

                <div className="p-5">
                    {activeTab === "local" ? (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={cn(
                                "border-2 border-dashed rounded-xl p-8 text-center transition-all",
                                isDragging ? "border-violet-500 bg-violet-50" : "border-muted-foreground/25 hover:border-violet-400",
                            )}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileSelect}
                                className="hidden"
                                accept="*/*"
                            />
                            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                            <p className="text-sm text-foreground font-medium mb-1">Drag and drop files here</p>
                            <p className="text-xs text-muted-foreground mb-4">or</p>
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="border-violet-300 text-violet-600 hover:bg-violet-50"
                            >
                                Browse Files
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[280px] overflow-y-auto">
                            {driveFiles.map((file) => {
                                const isSelected = selectedFiles.some((f) => f.id === file.id)
                                return (
                                    <button
                                        key={file.id}
                                        onClick={() => toggleDriveFile(file)}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                                            isSelected
                                                ? "border-violet-500 bg-violet-50"
                                                : "border-muted hover:border-violet-300 hover:bg-muted/50",
                                        )}
                                    >
                                        {getFileIcon(file.type)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">{file.size}</p>
                                        </div>
                                        {isSelected && (
                                            <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {selectedFiles.length > 0 && (
                    <div className="px-5 pb-3 border-t pt-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                            {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {selectedFiles.map((file) => (
                                <div key={file.id} className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5 text-xs">
                                    {getFileIcon(file.type)}
                                    <span className="max-w-[100px] truncate">{file.name}</span>
                                    <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
                    <Button variant="ghost" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAttach}
                        disabled={selectedFiles.length === 0}
                        className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        Attach {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
