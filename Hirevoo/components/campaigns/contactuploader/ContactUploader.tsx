"use client"

import React, { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import Papa from "papaparse"
import { Check, Trash2, CheckCircle, User, FileText, HardDrive, AlertCircle, Upload, X } from "lucide-react"
import { useCampaign } from "@/context/CampaignContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface Recipient {
  id: string
  email: string
  name?: string
  company?: string
  role?: string
  isValid: boolean
}


export default function UploadContacts() {
  const router = useRouter()
  const { createCampaign, updateCampaignName, isLoading: isSaving, error: saveError } = useCampaign()

  const [campaignName, setCampaignName] = useState("")
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [manualEmail, setManualEmail] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState("")
  const [googleSheetUrl, setGoogleSheetUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [importHint, setImportHint] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Email validation
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Parse bulk emails
  const parseBulkEmails = (text: string): { emails: string[]; names: string[] } => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    const emails: string[] = []
    const names: string[] = []

    for (const line of lines) {
      const emailMatch = line.match(/([^\s<]+@[^\s>]+)/)
      if (emailMatch) {
        const email = emailMatch[1]
        const nameMatch = line.match(/^([^<]+)</)
        const name = nameMatch ? nameMatch[1].trim() : email.split('@')[0]
        emails.push(email)
        names.push(name)
      }
    }
    return { emails, names }
  }

  // Add single email
  const handleAddEmail = () => {
    if (manualEmail.trim()) {
      const newRecipient: Recipient = {
        id: crypto.randomUUID(),
        email: manualEmail.trim(),
        name: manualEmail.split('@')[0],
        isValid: isValidEmail(manualEmail.trim()),
      }
      setRecipients((prev) => [...prev, newRecipient])
      setManualEmail("")
    }
  }


  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) handleFileUpload(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  })

  // Handle file upload
  const handleFileUpload = (file: File) => {
    setIsUploading(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedContacts: Recipient[] = []
        results.data.forEach((row: any) => {
          const emailKey = Object.keys(row).find(key => key.toLowerCase().includes('email'))
          if (emailKey && row[emailKey]) {
            const email = row[emailKey].toString().trim()
            if (isValidEmail(email)) {
              const nameKey = Object.keys(row).find(key => key.toLowerCase().includes('name'))
              const companyKey = Object.keys(row).find(key => key.toLowerCase().includes('company'))
              const roleKey = Object.keys(row).find(key => key.toLowerCase().includes('role') || key.toLowerCase().includes('title'))
              
              parsedContacts.push({
                id: crypto.randomUUID(),
                email,
                name: nameKey ? row[nameKey]?.toString().trim() : email.split('@')[0],
                company: companyKey ? row[companyKey]?.toString().trim() : undefined,
                role: roleKey ? row[roleKey]?.toString().trim() : undefined,
                isValid: true,
              })
            }
          }
        })
        setRecipients((prev) => [...prev, ...parsedContacts])
        setIsUploading(false)
        alert(`Successfully uploaded ${parsedContacts.length} contacts`)
      },
      error: () => {
        alert('Failed to parse file. Please check the format.')
        setIsUploading(false)
      }
    })
  }

  // Google Drive integration using Google Picker API
  const handleConnectGoogleDrive = () => {
    alert('Google Drive integration: Please set up OAuth 2.0 credentials to enable this feature. For now, you can use the file upload option.')
  }

  // Import from Google Sheet
  const handleImportSheet = async () => {
    if (!googleSheetUrl.trim()) {
      setImportHint('Please add the public view URL')
      return
    }

    // Basic URL validation
    if (!googleSheetUrl.includes('docs.google.com/spreadsheets')) {
      setImportHint('Please enter a valid Google Sheets URL')
      return
    }

    // Clear any previous hints
    setImportHint('')

    alert('Google Sheets import: Make sure the sheet is publicly accessible. This requires Google Sheets API setup.')
  }

  const handleDelete = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id))
  }

  const removeDuplicates = () => {
    const seen = new Set()
    const deduplicated = recipients.filter(r => {
      if (seen.has(r.email.toLowerCase())) return false
      seen.add(r.email.toLowerCase())
      return true
    })
    const removed = recipients.length - deduplicated.length
    setRecipients(deduplicated)
    if (removed > 0) alert(`Removed ${removed} duplicate(s)`)
    else alert('No duplicates found')
  }

  const handleEditEmail = (id: string, email: string) => {
    setEditingId(id)
    setEditingEmail(email)
  }

  const handleSaveEdit = (id: string) => {
    if (editingEmail.trim()) {
      setRecipients((prev) =>
        prev.map((r) => r.id === id ? { 
          ...r, 
          email: editingEmail.trim(), 
          name: editingEmail.split('@')[0],
          isValid: isValidEmail(editingEmail.trim()) 
        } : r)
      )
    }
    setEditingId(null)
    setEditingEmail("")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingEmail("")
  }

  const validCount = recipients.filter((r) => r.isValid).length
  
  // Calculate duplicates
  const findDuplicates = () => {
    const emailCounts = recipients.reduce((acc: any, r) => {
      const email = r.email.toLowerCase()
      acc[email] = (acc[email] || 0) + 1
      return acc
    }, {})
    
    return Object.values(emailCounts).reduce((sum: number, count: any) => {
      return sum + (count > 1 ? count - 1 : 0)
    }, 0)
  }
  
  const duplicateCount = findDuplicates()

  return (
    <div className="h-screen bg-[#e8eaef] flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="bg-white px-4 py-2 shadow-sm flex items-center justify-between flex-shrink-0">
        <h1 className="text-sm font-semibold text-gray-800">Step 1/3 Upload Contacts</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Campaign Details</span>
          <Input
            value={campaignName}
            onChange={(e: any) => {
              setCampaignName(e.target.value)
              updateCampaignName(e.target.value)
            }}
            placeholder={new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            className="h-8 w-40 text-xs"
          />
          <div className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-300 bg-gray-50">
            <User className="h-4 w-4 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout, No Page Scroll */}
      <div className="flex-1 p-1 grid grid-cols-2 gap-2 overflow-hidden min-h-0">
        
        {/* Left Column - All Input Options Stacked Vertically */}
        <div className="space-y-2 flex flex-col h-full justify-start">
          
          {/* Add Recipients Card */}
          <Card className="flex-shrink">
            <CardHeader className="py-2">
              <CardTitle className="text-sm font-semibold text-gray-800">Add Recipients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 py-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-600 font-medium">Enter Manually</label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Add Email"
                    value={manualEmail}
                    onChange={(e: any) => setManualEmail(e.target.value)}
                    onKeyPress={(e: any) => e.key === "Enter" && handleAddEmail()}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    onClick={handleAddEmail}
                    className="bg-[#7c3aed] text-white px-3 h-8 text-xs hover:bg-[#6d28d9] font-medium"
                  >
                    Add Email
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Google Sheet Card */}
          <Card className="flex-shrink">
            <CardHeader className="py-2">
              <CardTitle className="text-sm font-semibold text-gray-800">Link Google Sheet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 py-2">
              <label className="text-xs text-gray-600 font-medium">Google Sheet URL</label>
              <Input
                type="url"
                placeholder="Add only public view sheet with one column heading as email"
                value={googleSheetUrl}
                onChange={(e: any) => {
                  setGoogleSheetUrl(e.target.value)
                  if (importHint) setImportHint('')
                }}
                className="h-8 text-sm"
              />
              <p className="text-xs text-gray-500">Please ensure the sheet is publicly accessible</p>
              {importHint && (
                <p className="text-xs text-red-500 font-medium">{importHint}</p>
              )}
              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleImportSheet}
                  className="bg-[#7c3aed] text-white hover:bg-[#6d28d9] h-8 text-xs px-4 font-medium"
                >
                  Import Sheet
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upload File Card */}
          <Card className="flex-shrink">
            <CardHeader className="py-2">
              <CardTitle className="text-sm font-semibold text-gray-800">Upload File</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border-2 border-[#7c3aed] text-[#7c3aed] bg-white flex items-center justify-center gap-1 h-10 text-xs font-medium hover:bg-purple-50 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Browse from Computer
                </Button>
                <Button
                  onClick={handleConnectGoogleDrive}
                  className="flex-1 border-2 border-[#7c3aed] text-[#7c3aed] bg-white flex items-center justify-center gap-1 h-10 text-xs font-medium hover:bg-purple-50 transition-colors"
                >
                  <HardDrive className="h-4 w-4" />
                  Connect Google Drive
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Recipient List with Isolated Scroll */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="py-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-800">Recipient List</CardTitle>
            </div>
            <p className="text-xs text-gray-500 mt-1">Recipient Lists</p>
            {duplicateCount > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg mt-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-800 flex-1">
                  {duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''} found
                </span>
                <Button 
                  onClick={removeDuplicates} 
                  className="border border-amber-400 bg-white text-amber-700 h-7 text-xs px-3 hover:bg-amber-50 font-medium"
                >
                  Remove
                </Button>
              </div>
            )}
          </CardHeader>
          
          {/* Scrollable Email List - ISOLATED SCROLL */}
          <div className="flex-1 overflow-y-auto px-2 min-h-0">
            {recipients.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                No recipients added yet
              </div>
            ) : (
              <div className="space-y-2 py-3">
                {recipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    {editingId === recipient.id ? (
                      <div className="flex-1 flex gap-2">
                        <Input
                          value={editingEmail}
                          onChange={(e: any) => setEditingEmail(e.target.value)}
                          className="h-8 text-sm flex-1"
                          onKeyPress={(e: any) => {
                            if (e.key === 'Enter') handleSaveEdit(recipient.id)
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                          autoFocus
                        />
                        <Button 
                          onClick={() => handleSaveEdit(recipient.id)} 
                          className="bg-[#7c3aed] text-white h-8 px-3 text-xs font-medium"
                        >
                          Save
                        </Button>
                        <Button 
                          onClick={handleCancelEdit} 
                          className="border border-gray-300 bg-white text-gray-700 h-8 px-3 text-xs hover:bg-gray-50 font-medium"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 ${
                            recipient.isValid ? "bg-green-500" : "bg-red-500"
                          }`}>
                            <Check className="h-3 w-3 text-white" />
                          </div>
                          <div className={`text-sm truncate ${recipient.isValid ? "text-gray-800" : "text-red-500"}`}>
                            {recipient.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <button
                            onClick={() => handleEditEmail(recipient.id, recipient.email)}
                            className="rounded-full p-1.5 text-blue-500 hover:bg-blue-100 transition-colors"
                            title="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(recipient.id)}
                            className="rounded-full p-1.5 text-red-500 hover:bg-red-100 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="border-t border-gray-200 p-2 flex-shrink-0 space-y-3 bg-gray-50">
            <div className="text-xs text-gray-500">
              {recipients.length} contacts added
            </div>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-gray-800">{validCount}</span>
              <Button
                className="bg-[#7c3aed] text-white px-6 h-11 text-sm font-medium hover:bg-[#6d28d9] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                disabled={validCount === 0 || isCreating || isSaving}
                onClick={async () => {
                  setIsCreating(true)
                  try {
                    // Convert recipients to CampaignContact format
                    const contacts = recipients
                      .filter(r => r.isValid)
                      .map(r => ({
                        id: r.id,
                        name: r.name || '',
                        email: r.email,
                        company: r.company || undefined,
                        role: r.role || undefined,
                        emailStatus: 'draft' as const
                      }))

                    // Create campaign with contacts (this automatically saves to database)
                    const campaign = createCampaign(campaignName || 'New Campaign', contacts)

                    // Navigate to compose page with the temporary ID
                    // The ID will be updated to the real database ID once save completes
                    router.push(`/campaigns/${campaign.id}/compose`)
                  } catch (error) {
                    console.error('Failed to create campaign:', error)
                    alert('Failed to create campaign. Please try again.')
                  } finally {
                    setIsCreating(false)
                  }
                }}
              >
                {isCreating || isSaving ? 'Creating...' : 'Next Step: Compose Emails'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}