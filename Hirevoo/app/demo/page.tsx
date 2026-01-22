"use client"

import { useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AIAssistantModal } from "@/components/campaigns/compose-ui"

export default function DemoPage() {
    const [showCompose, setShowCompose] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [showAIModal, setShowAIModal] = useState(false)

    const handleSend = (data: { to: string; subject: string; body: string }) => {
        console.log("Sending email:", data)
        alert(`Email sent to: ${data.to}\nSubject: ${data.subject}\nBody: ${data.body.slice(0, 50)}...`)
        setShowCompose(false)
    }

    const handleAIAssist = () => {
        setIsGenerating(true)
        setTimeout(() => {
            setIsGenerating(false)
        }, 2000)
    }

    const handleMinimize = () => {
        alert("Minimize functionality would be implemented here")
    }

    const handleClose = () => {
        setShowCompose(false)
    }

    const handleInsertText = (text: string) => {
        alert(`AI Generated Text Inserted:\n\n${text}`)
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Demo: ComposeWindow</h1>
                    <p className="text-gray-600">Demonstrating the ComposeWindow component for email composition</p>
                </div>

                {!showCompose && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Compose Window Demo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600">
                                    Click the button below to open the compose window. This component provides a Gmail-style email composition interface with formatting tools, AI assistance, and send options.
                                </p>

                                <div className="flex gap-4">
                                    <Button onClick={() => setShowCompose(true)}>
                                        Open Compose Window
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowCompose(true)
                                            setTimeout(() => handleAIAssist(), 500)
                                        }}
                                    >
                                        Open with AI Demo
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={() => setShowAIModal(true)}
                                    >
                                        Open AI Assistant Modal
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Compose Window - Commented out as component is not available */}
                {/* {showCompose && (
                    <div className="fixed inset-0 bg-black/20 flex items-end justify-center p-4 z-50">
                        <div className="w-full max-w-4xl">
                            <ComposeWindow
                                defaultTo="sarah.johnson@techcorp.com"
                                defaultSubject="Following up on our conversation"
                                defaultBody="Hi Sarah,\n\nI wanted to follow up on our discussion about..."
                                onSend={handleSend}
                                onClose={handleClose}
                                onMinimize={handleMinimize}
                                showAIButton={true}
                                onAIAssist={handleAIAssist}
                                isGenerating={isGenerating}
                            />
                        </div>
                    </div>
                )} */}

                {/* AI Assistant Modal */}
                <AIAssistantModal
                    isOpen={showAIModal}
                    onClose={() => setShowAIModal(false)}
                    onInsertText={handleInsertText}
                />

                {/* Features Overview */}
                <Card>
                    <CardHeader>
                        <CardTitle>Compose Window Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div>
                                <h4 className="font-medium mb-2">Core Functionality</h4>
                                <ul className="space-y-1 text-gray-600">
                                    <li>• To, Subject, and Body fields</li>
                                    <li>• Send button with scheduling dropdown</li>
                                    <li>• Minimize, maximize, and close controls</li>
                                    <li>• Responsive design for different screen sizes</li>
                                    <li>• Dark mode support</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-medium mb-2">Advanced Features</h4>
                                <ul className="space-y-1 text-gray-600">
                                    <li>• Rich text formatting toolbar</li>
                                    <li>• AI assistance button (press "/" for quick access)</li>
                                    <li>• Loading states for AI generation</li>
                                    <li>• Attachment and media insertion</li>
                                    <li>• Tooltips for all toolbar buttons</li>
                                    <li>• Customizable children content area</li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Interactive Demo</h4>
                            <p className="text-sm text-blue-800">
                                Try typing in the compose window, use the formatting buttons, and test the AI assist feature.
                                Press "/" in an empty body field to trigger AI assistance. The window can be minimized, maximized, or closed.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}