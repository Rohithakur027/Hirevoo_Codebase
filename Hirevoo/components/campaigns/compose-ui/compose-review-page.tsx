"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { ContactSidebar } from "./contact-sidebar"
import { EmailEditor } from "./email-editor"
import { BrowseTemplatesModal } from "./browse-templates-modal"
import { AIAssistantModal } from "./ai-assistant-modal"
import { SaveTemplateModal } from "./save-template-modal"
import { MobileContactSheet } from "./mobile-contact-sheet"
import { Card } from "@/components/ui/card"
import { toast, Toaster } from "sonner"
import { useCampaign } from "@/context/CampaignContext"

export type Contact = {
    id: string
    name: string
    email: string
    avatar: string
    avatarColor: string
    status: "ready" | "draft" | "pending"
}

const initialContacts: Contact[] = [
    {
        id: "1",
        name: "Aeley Shon",
        email: "hirevoorca@gmail.com",
        avatar: "AS",
        avatarColor: "bg-indigo-500",
        status: "draft",
    },
    {
        id: "2",
        name: "Robers Report",
        email: "hirevoomt@gmail.com",
        avatar: "RR",
        avatarColor: "bg-rose-400",
        status: "draft",
    },
    {
        id: "3",
        name: "Jimme Horrin",
        email: "hirevoomp@gmail.com",
        avatar: "JH",
        avatarColor: "bg-amber-500",
        status: "draft",
    },
    {
        id: "4",
        name: "Ruolan Smith",
        email: "hirevoomit@gmail.com",
        avatar: "RS",
        avatarColor: "bg-teal-500",
        status: "draft",
    },
    {
        id: "5",
        name: "Haney Mucklan",
        email: "hirevoomn@gmail.com",
        avatar: "HM",
        avatarColor: "bg-slate-500",
        status: "draft",
    },
    {
        id: "6",
        name: "Latern Hangerason",
        email: "hirevoorcc@gmail.com",
        avatar: "LH",
        avatarColor: "bg-emerald-500",
        status: "draft",
    },
]

export type SavedTemplate = {
    id: string
    name: string
    subject: string
    body: string
    createdAt: Date
}

export function ComposeReviewPage() {
    const router = useRouter()
    const params = useParams()
    const campaignId = params?.campaignId as string || 'new-campaign'
    const {
        campaign,
        updateContactEmail,
        markContactDone,
        saveContactsToDatabase,
        isLoading: isSaving,
        error: saveError,
        currentContactId,
        setCurrentContactId,
        completedCount,
        totalCount
    } = useCampaign()

    // Track avatar colors consistently
    const avatarColorsRef = useRef<Map<string, string>>(new Map())

    // ALL HOOKS MUST BE CALLED AT THE TOP LEVEL, BEFORE ANY CONDITIONAL LOGIC
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [subject, setSubject] = useState("")
    const [emailBody, setEmailBody] = useState("Hi {FirstName},\n\nI hope this email finds you well...")
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isAIModalOpen, setIsAIModalOpen] = useState(false)
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
    const [useTemplateForAll, setUseTemplateForAll] = useState(false)
    const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 2000)
        return () => clearTimeout(timer)
    }, [])

    // Move useCallback BEFORE any conditional returns to satisfy Rules of Hooks
    const handleSelectContact = useCallback(
        (contact: Contact) => {
            setCurrentContactId(contact.id)
        },
        [setCurrentContactId],
    )

    // Show loading while waiting for campaign
    if (isLoading || !campaign || !campaign.contacts || campaign.contacts.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading campaign...</p>
                </div>
            </div>
        )
    }

    // Convert campaign contacts to the Contact format used by the UI
    const avatarColors = ['indigo', 'rose', 'amber', 'teal', 'slate', 'emerald']
    const contacts: Contact[] = campaign.contacts.map((c, index) => {
        // Get or create consistent avatar color for this contact
        if (!avatarColorsRef.current.has(c.id)) {
            avatarColorsRef.current.set(c.id, `bg-${avatarColors[index % avatarColors.length]}-500`)
        }
        return {
            id: c.id,
            name: c.name,
            email: c.email,
            avatar: c.name.split(' ').map(n => n[0]).join('').toUpperCase(),
            avatarColor: avatarColorsRef.current.get(c.id)!,
            status: c.emailStatus === 'done' ? 'ready' as const :
                   c.emailStatus === 'draft' ? 'draft' as const : 'pending' as const
        }
    })

    // Don't use local state for contacts - use campaign context
    const setContacts = () => {} // Not needed since we use campaign context

    const filteredContacts = contacts.filter(
        (contact) =>
            contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            contact.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    const currentContact = currentContactId ? contacts.find(c => c.id === currentContactId) : null
    const selectedContactIndex = currentContact ? filteredContacts.findIndex(c => c.id === currentContact.id) : 0
    const selectedContact = currentContact || filteredContacts[0] || contacts[0] || null

    const isLastContact = selectedContact ? selectedContactIndex === filteredContacts.length - 1 : false
    const isFirstContact = selectedContact ? selectedContactIndex === 0 : true

    const allReady = completedCount === totalCount

    const handleSelectTemplate = (template: { subject: string; body: string }) => {
        setSubject(template.subject)
        setEmailBody(template.body)
    }

    const handleAIInsert = (text: string) => {
        setEmailBody(text)
    }

    const handlePrevious = () => {
        if (selectedContactIndex > 0) {
            const prevContact = filteredContacts[selectedContactIndex - 1]
            if (prevContact) {
                setCurrentContactId(prevContact.id)
            }
        }
    }

    const handleDoneAndNext = async () => {
        if (!selectedContact) {
            toast.error("No contact selected")
            return
        }

        // Save the email content
        updateContactEmail(selectedContact.id, subject, emailBody)

        // Mark contact as done
        markContactDone(selectedContact.id)

        if (completedCount + 1 >= totalCount) {
            toast.success("Campaign Submitted!", {
                description: "Saving to database and redirecting...",
            })

            // Save all contacts to database before navigating to send page
            // Small delay to ensure state is updated
            setTimeout(async () => {
                const saved = await saveContactsToDatabase()
                if (saved) {
                    // Use the actual campaign ID (which may have been updated from temp ID)
                    const actualCampaignId = campaign?.id || campaignId
                    router.push(`/campaigns/${actualCampaignId}/send`)
                } else {
                    toast.error("Failed to save campaign", {
                        description: "Please try again or check your connection.",
                    })
                }
            }, 100)
        } else {
            // Move to next contact
            const nextIndex = selectedContactIndex + 1
            if (nextIndex < filteredContacts.length) {
                setCurrentContactId(filteredContacts[nextIndex].id)
            }
            // Reset for next contact
            setEmailBody("Hi {FirstName},\n\nI hope this email finds you well...")
            setSubject("")
            toast.success("Email saved!", {
                description: `Email for ${selectedContact.name} has been marked as ready.`,
            })
        }
    }

    const handleSaveTemplate = (name: string) => {
        const newTemplate: SavedTemplate = {
            id: Date.now().toString(),
            name,
            subject,
            body: emailBody,
            createdAt: new Date(),
        }
        setSavedTemplates((prev) => [...prev, newTemplate])
        toast.success("Template Saved!", {
            description: `"${name}" has been saved to My Saved Templates.`,
        })
    }

    return (
        <div className="h-screen bg-gray-50 gap-4 p-4 grid grid-cols-3">
            {/* Contact List Column */}
            <div className="flex flex-col overflow-hidden bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="hidden md:block">
                    <ContactSidebar
                        contacts={filteredContacts}
                        selectedContact={selectedContact}
                        onSelectContact={handleSelectContact}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </div>

                <MobileContactSheet
                    contacts={filteredContacts}
                    selectedContact={selectedContact}
                    onSelectContact={handleSelectContact}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
            </div>

            {/* Email Editor Column */}
            <div className="flex flex-col overflow-hidden bg-white rounded-lg border border-gray-200 shadow-sm col-span-2">
                <EmailEditor
                    selectedContact={selectedContact}
                    subject={subject}
                    setSubject={setSubject}
                    emailBody={emailBody}
                    setEmailBody={setEmailBody}
                    useTemplateForAll={useTemplateForAll}
                    setUseTemplateForAll={setUseTemplateForAll}
                    onOpenTemplates={() => setIsTemplateModalOpen(true)}
                    onOpenAI={() => setIsAIModalOpen(true)}
                    onOpenSaveTemplate={() => setIsSaveModalOpen(true)}
                    onDoneAndNext={handleDoneAndNext}
                    onPrevious={handlePrevious}
                    isLastContact={isLastContact}
                    isFirstContact={isFirstContact}
                    allReady={allReady}
                    currentIndex={selectedContactIndex}
                    totalContacts={filteredContacts.length}
                    campaignId={campaignId}
                />
            </div>

            <BrowseTemplatesModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSelectTemplate={handleSelectTemplate}
                savedTemplates={savedTemplates}
            />

            <AIAssistantModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onInsertText={handleAIInsert} />

            <SaveTemplateModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleSaveTemplate}
            />

            <Toaster position="bottom-left" richColors />
        </div>
    )
}
