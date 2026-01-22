"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Bold, Italic, Link2, List, ListOrdered, Undo, Redo } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect } from "react"

interface TiptapEditorProps {
    content: string
    onChange: (content: string) => void
    placeholder?: string
    onOpenLinkModal?: () => void
}

export function TiptapEditor({ content, onChange, placeholder = "Write your email here...", onOpenLinkModal }: TiptapEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-violet-600 underline cursor-pointer",
                },
            }),
            Placeholder.configure({
                placeholder,
                emptyEditorClass: "is-editor-empty",
            }),
        ],
        content,
        editorProps: {
            attributes: {
                class:
                    "prose prose-sm sm:prose max-w-none focus:outline-none min-h-[200px] md:min-h-[300px] text-sm md:text-base leading-relaxed",
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
    })

    // Sync external content changes
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content)
        }
    }, [content, editor])

    if (!editor) {
        return (
            <div className="min-h-[200px] md:min-h-[300px] flex items-center justify-center text-muted-foreground">
                Loading editor...
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-1 pb-3 border-b mb-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(
                        "h-8 w-8 cursor-pointer transition-colors",
                        editor.isActive("bold") ? "bg-violet-100 text-violet-700" : "hover:bg-muted"
                    )}
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="w-4 h-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(
                        "h-8 w-8 cursor-pointer transition-colors",
                        editor.isActive("italic") ? "bg-violet-100 text-violet-700" : "hover:bg-muted"
                    )}
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="w-4 h-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        if (onOpenLinkModal) {
                            onOpenLinkModal()
                        } else {
                            const url = window.prompt("Enter URL:")
                            if (url) {
                                editor.chain().focus().setLink({ href: url }).run()
                            }
                        }
                    }}
                    className={cn(
                        "h-8 w-8 cursor-pointer transition-colors",
                        editor.isActive("link") ? "bg-violet-100 text-violet-700" : "hover:bg-muted"
                    )}
                    title="Insert Link"
                >
                    <Link2 className="w-4 h-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={cn(
                        "h-8 w-8 cursor-pointer transition-colors",
                        editor.isActive("bulletList") ? "bg-violet-100 text-violet-700" : "hover:bg-muted"
                    )}
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={cn(
                        "h-8 w-8 cursor-pointer transition-colors",
                        editor.isActive("orderedList") ? "bg-violet-100 text-violet-700" : "hover:bg-muted"
                    )}
                    title="Numbered List"
                >
                    <ListOrdered className="w-4 h-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className="h-8 w-8 cursor-pointer hover:bg-muted disabled:opacity-50"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo className="w-4 h-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className="h-8 w-8 cursor-pointer hover:bg-muted disabled:opacity-50"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo className="w-4 h-4" />
                </Button>
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} className="flex-1 overflow-auto" />

            <style jsx global>{`
        .tiptap {
          outline: none;
        }
        .tiptap p {
          margin: 0.5em 0;
        }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .tiptap ul,
        .tiptap ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .tiptap li {
          margin: 0.25em 0;
        }
      `}</style>
        </div>
    )
}

// Helper function to insert link into editor from external modal
export function insertLinkToEditor(editor: ReturnType<typeof useEditor>, url: string, text?: string) {
    if (!editor) return

    if (text) {
        editor.chain().focus().insertContent(`<a href="${url}">${text}</a>`).run()
    } else {
        editor.chain().focus().setLink({ href: url }).run()
    }
}
