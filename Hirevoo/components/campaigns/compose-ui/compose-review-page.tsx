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
    const [emailBody, setEmailBody] = useState("")
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [isAIModalOpen, setIsAIModalOpen] = useState(false)
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
    const [useTemplateForAll, setUseTemplateForAll] = useState(false)
    const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
    // Track which contact's data is currently loaded in the editor
    const loadedContactIdRef = useRef<string | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 2000)
        return () => clearTimeout(timer)
    }, [])

    // Helper: get the first name from a full name
    const getFirstName = useCallback((fullName: string) => {
        return fullName?.split(' ')[0] || 'there'
    }, [])

    // Helper: get default email body for a contact with their real name
    const getDefaultEmailBody = useCallback((contactName: string) => {
        const firstName = getFirstName(contactName)
        return `Hi ${firstName},\n\nI hope this email finds you well...`
    }, [getFirstName])

    // Sync subject/body when the selected contact changes
    // This loads the contact's saved email or creates a personalized default
    useEffect(() => {
        if (!campaign || !campaign.contacts || campaign.contacts.length === 0) return

        // Determine which contact is actually selected
        const effectiveContactId = currentContactId || campaign.contacts[0]?.id
        if (!effectiveContactId) return

        // Skip if we've already loaded this contact's data
        if (loadedContactIdRef.current === effectiveContactId) return

        const campaignContact = campaign.contacts.find(c => c.id === effectiveContactId)
        if (!campaignContact) return

        // Load the contact's saved email content, or create personalized defaults
        loadedContactIdRef.current = effectiveContactId
        setSubject(campaignContact.emailSubject || '')
        setEmailBody(campaignContact.emailBody || getDefaultEmailBody(campaignContact.name))
    }, [currentContactId, campaign, getDefaultEmailBody])

    // Move useCallback BEFORE any conditional returns to satisfy Rules of Hooks
    const handleSelectContact = useCallback(
        (contact: Contact) => {
            // Save current contact's email before switching
            if (campaign && loadedContactIdRef.current) {
                updateContactEmail(loadedContactIdRef.current, subject, emailBody)
            }
            // Reset loaded ref so the effect above will load the new contact's data
            loadedContactIdRef.current = null
            setCurrentContactId(contact.id)
        },
        [setCurrentContactId, campaign, updateContactEmail, subject, emailBody],
    )

    // Handle the "Apply to All" toggle change - MUST be before conditional returns
    const handleUseTemplateForAllChange = useCallback((enabled: boolean) => {
        setUseTemplateForAll(enabled)

        if (enabled && campaign?.contacts) {
            // Apply current email content to all contacts immediately
            campaign.contacts.forEach((contact) => {
                updateContactEmail(contact.id, subject, emailBody)
            })

            toast.success("Applied to all contacts!", {
                description: `Email content has been copied to all ${campaign.contacts.length} contacts. Future edits will also sync.`,
            })
        } else if (!enabled) {
            toast.info("Apply to All disabled", {
                description: "Edits will now only affect the current contact.",
            })
        }
    }, [campaign, subject, emailBody, updateContactEmail])

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

        // If "Apply to All" is enabled, apply the template to all contacts
        if (useTemplateForAll && campaign?.contacts) {
            campaign.contacts.forEach((contact) => {
                updateContactEmail(contact.id, template.subject, template.body)
            })
            toast.success("Template applied to all contacts!", {
                description: `Template has been copied to all ${campaign.contacts.length} contacts.`,
            })
        }
    }

    const handleAIInsert = (text: string) => {
        setEmailBody(text)

        // If "Apply to All" is enabled, apply to all contacts
        if (useTemplateForAll && campaign?.contacts) {
            campaign.contacts.forEach((contact) => {
                updateContactEmail(contact.id, subject, text)
            })
            toast.success("AI content applied to all contacts!", {
                description: `Content has been copied to all ${campaign.contacts.length} contacts.`,
            })
        }
    }

    const handlePrevious = () => {
        if (selectedContactIndex > 0) {
            // Save current contact's email before navigating
            if (selectedContact) {
                updateContactEmail(selectedContact.id, subject, emailBody)
            }
            const prevContact = filteredContacts[selectedContactIndex - 1]
            if (prevContact) {
                loadedContactIdRef.current = null
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

            // Save all contacts to database, passing the current contact's
            // unsaved subject/body to avoid the React state race condition
            const pendingUpdate = {
                contactId: selectedContact.id,
                subject,
                body: emailBody,
            }

            // Small delay to let the campaign ID update from temp to real
            setTimeout(async () => {
                const saved = await saveContactsToDatabase(pendingUpdate)
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
                // Reset loaded ref so the useEffect loads the next contact's saved data
                loadedContactIdRef.current = null
                setCurrentContactId(filteredContacts[nextIndex].id)
            }
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
                    setUseTemplateForAll={handleUseTemplateForAllChange}
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

            <Toaster position="bottom-right" richColors />
        </div>
    )
}
