"use client"

import { useState } from "react"
import { X, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { SavedTemplate } from "./compose-review-page"

interface BrowseTemplatesModalProps {
    isOpen: boolean
    onClose: () => void
    onSelectTemplate: (template: { subject: string; body: string }) => void
    savedTemplates: SavedTemplate[]
}

const mockTemplates = [
    {
        id: "1",
        category: "Referral",
        tone: "Professional",
        length: "Medium",
        subject: "Exploring Opportunities at [Company]",
        body: `Hi {FirstName},

I hope this email finds you well. I am writing to express my strong interest in a software engineering position at [Company]. Having followed your work in [Specific Area], I am deeply impressed by...

Best regards,
[Your Name]`,
    },
    {
        id: "2",
        category: "Referral",
        tone: "Friendly",
        length: "Short",
        subject: "Quick Question About [Company]",
        body: `Hey {FirstName},

Hope you're doing great! I saw that you work at [Company] and I'd love to learn more about your experience there.

Would you be open to a quick chat sometime this week?

Cheers,
[Your Name]`,
    },
    {
        id: "3",
        category: "Cold Outreach",
        tone: "Professional",
        length: "Medium",
        subject: "Connecting Regarding [Position] at [Company]",
        body: `Dear {FirstName},

I hope this message finds you well. I came across your profile while researching [Company] and was impressed by your background in [Field].

I'm currently exploring opportunities in [Industry] and would greatly appreciate the chance to learn from your experience.

Best regards,
[Your Name]`,
    },
    {
        id: "4",
        category: "Follow-up",
        tone: "Professional",
        length: "Short",
        subject: "Following Up on Our Conversation",
        body: `Hi {FirstName},

I wanted to follow up on our conversation from [Date/Event]. I really enjoyed learning about your work at [Company].

As discussed, I'm attaching [Document] for your review.

Looking forward to hearing from you.

Best,
[Your Name]`,
    },
    {
        id: "5",
        category: "Networking",
        tone: "Friendly",
        length: "Medium",
        subject: "Loved Your Talk at [Event]",
        body: `Hi {FirstName},

I attended your talk at [Event] last week and found your insights on [Topic] really valuable.

I'm working on something similar and would love to connect and exchange ideas sometime.

Thanks for the inspiration!

Best,
[Your Name]`,
    },
    {
        id: "6",
        category: "Cold Outreach",
        tone: "Urgent",
        length: "Short",
        subject: "Time-Sensitive: [Opportunity] at [Company]",
        body: `Hi {FirstName},

I understand you're busy, so I'll keep this brief. I noticed [Company] is currently hiring for [Position] and I believe I'd be a great fit.

Could we connect for 10 minutes this week?

Thanks,
[Your Name]`,
    },
    {
        id: "7",
        category: "Networking",
        tone: "Professional",
        length: "Long",
        subject: "Introduction from [Mutual Connection]",
        body: `Dear {FirstName},

I hope this email finds you well. [Mutual Connection] suggested I reach out to you regarding opportunities in [Industry].

I've been following your work at [Company] for some time now, and I'm particularly impressed by your achievements in [Area]. Your approach to [Topic] aligns closely with my own professional interests.

I would be grateful for the opportunity to learn from your experience and insights. Would you be available for a brief call in the coming weeks?

Thank you for your time and consideration.

Best regards,
[Your Name]`,
    },
    {
        id: "8",
        category: "Follow-up",
        tone: "Friendly",
        length: "Short",
        subject: "Great Meeting You at [Event]!",
        body: `Hey {FirstName},

It was great meeting you at [Event] yesterday! I really enjoyed our conversation about [Topic].

Let's definitely stay in touch. Coffee sometime next week?

Best,
[Your Name]`,
    },
    {
        id: "9",
        category: "Referral",
        tone: "Professional",
        length: "Long",
        subject: "Seeking Your Guidance on [Company] Opportunities",
        body: `Dear {FirstName},

I hope this message finds you well. I recently came across your profile and was impressed by your career journey at [Company].

I'm currently seeking new opportunities in [Field] and noticed that [Company] has been at the forefront of innovation in this space. Your insights on the company culture, team dynamics, and growth opportunities would be invaluable as I consider my next career move.

If you have a few minutes to spare, I would greatly appreciate the chance to connect and learn from your experience.

Thank you for considering my request.

Warm regards,
[Your Name]`,
    },
    {
        id: "10",
        category: "Cold Outreach",
        tone: "Friendly",
        length: "Medium",
        subject: "Fellow [University/Industry] Professional Reaching Out",
        body: `Hi {FirstName},

I noticed we both share a background in [Common Ground] and I thought I'd reach out to connect!

I'm currently working on [Project/Role] and would love to hear about your experience at [Company]. Your work in [Area] seems really interesting.

Would you be open to a quick chat? No pressure at all!

Cheers,
[Your Name]`,
    },
]

const categories = ["Referral", "Cold Outreach", "Follow-up", "Networking", "Estworking"]
const tones = ["Professional", "Friendly", "Urgent"]
const lengths = ["Short", "Medium", "Long"]

export function BrowseTemplatesModal({ isOpen, onClose, onSelectTemplate, savedTemplates }: BrowseTemplatesModalProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [selectedTones, setSelectedTones] = useState<string[]>([])
    const [selectedLengths, setSelectedLengths] = useState<string[]>([])
    const [activeTab, setActiveTab] = useState<"all" | "saved">("all")
    const [currentIndex, setCurrentIndex] = useState(0)

    const filteredTemplates = mockTemplates.filter((template) => {
        const matchesSearch =
            searchQuery === "" ||
            template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.body.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(template.category)
        const matchesTone = selectedTones.length === 0 || selectedTones.includes(template.tone)
        const matchesLength = selectedLengths.length === 0 || selectedLengths.includes(template.length)
        return matchesSearch && matchesCategory && matchesTone && matchesLength
    })

    const displayedTemplates =
        activeTab === "all"
            ? filteredTemplates
            : savedTemplates.map((t) => ({
                ...t,
                category: "Saved",
                tone: "Custom",
                length: "Custom",
            }))

    const currentTemplate = displayedTemplates[currentIndex]
    const totalTemplates = displayedTemplates.length

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalTemplates - 1))
    }

    const handleNext = () => {
        setCurrentIndex((prev) => (prev < totalTemplates - 1 ? prev + 1 : 0))
    }

    const handleUseTemplate = () => {
        if (currentTemplate) {
            onSelectTemplate({
                subject: currentTemplate.subject,
                body: currentTemplate.body,
            })
            onClose()
        }
    }

    const toggleFilter = (value: string, selected: string[], setSelected: (values: string[]) => void) => {
        if (selected.includes(value)) {
            setSelected(selected.filter((v) => v !== value))
        } else {
            setSelected([...selected, value])
        }
        setCurrentIndex(0)
    }

    const handleTabChange = (tab: "all" | "saved") => {
        setActiveTab(tab)
        setCurrentIndex(0)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                showCloseButton={false}
                className="max-w-[1400px] w-[98vw] p-0 gap-0 overflow-hidden bg-background border shadow-xl"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
                    <h2 className="text-xl font-semibold text-foreground">Browse Templates</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-muted">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentIndex(0)
                            }}
                            className="pl-10 h-10 bg-muted/30 border-muted-foreground/20 rounded-lg"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 py-2 border-b bg-muted/10">
                    <div className="flex gap-6">
                        <button
                            onClick={() => handleTabChange("all")}
                            className={cn(
                                "text-sm font-medium pb-2 border-b-2 transition-colors",
                                activeTab === "all"
                                    ? "text-violet-600 border-violet-600"
                                    : "text-muted-foreground border-transparent hover:text-foreground",
                            )}
                        >
                            All Templates
                        </button>
                        <button
                            onClick={() => handleTabChange("saved")}
                            className={cn(
                                "text-sm font-medium pb-2 border-b-2 transition-colors flex items-center gap-2",
                                activeTab === "saved"
                                    ? "text-violet-600 border-violet-600"
                                    : "text-muted-foreground border-transparent hover:text-foreground",
                            )}
                        >
                            My Saved Templates
                            {savedTemplates.length > 0 && (
                                <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                                    {savedTemplates.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <div className="flex" style={{ height: "450px" }}>
                    {/* Left Sidebar - Filters */}
                    {activeTab === "all" && (
                        <div className="w-48 border-r p-5 bg-background shrink-0 overflow-y-auto">
                            {/* Category */}
                            <div className="mb-5">
                                <h4 className="font-semibold text-sm mb-3 text-foreground">Category</h4>
                                <div className="space-y-2">
                                    {categories.map((category) => (
                                        <label key={category} className="flex items-center gap-2 cursor-pointer group">
                                            <Checkbox
                                                checked={selectedCategories.includes(category)}
                                                onCheckedChange={() => toggleFilter(category, selectedCategories, setSelectedCategories)}
                                                className="border-muted-foreground/40 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                                            />
                                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                                {category}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Tone */}
                            <div className="mb-5">
                                <h4 className="font-semibold text-sm mb-3 text-foreground">Tone</h4>
                                <div className="space-y-2">
                                    {tones.map((tone) => (
                                        <label key={tone} className="flex items-center gap-2 cursor-pointer group">
                                            <Checkbox
                                                checked={selectedTones.includes(tone)}
                                                onCheckedChange={() => toggleFilter(tone, selectedTones, setSelectedTones)}
                                                className="border-muted-foreground/40 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                                            />
                                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                                {tone}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Length */}
                            <div>
                                <h4 className="font-semibold text-sm mb-3 text-foreground">Length</h4>
                                <div className="space-y-2">
                                    {lengths.map((length) => (
                                        <label key={length} className="flex items-center gap-2 cursor-pointer group">
                                            <Checkbox
                                                checked={selectedLengths.includes(length)}
                                                onCheckedChange={() => toggleFilter(length, selectedLengths, setSelectedLengths)}
                                                className="border-muted-foreground/40 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                                            />
                                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                                {length}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Right Content - Template Preview */}
                    <div className={cn("flex-1 p-5 flex flex-col", activeTab === "saved" && "w-full")}>
                        {totalTemplates > 0 && currentTemplate ? (
                            <>
                                <div className="flex-1 border rounded-xl p-5 bg-card shadow-sm flex flex-col overflow-hidden">
                                    <div className="mb-3 pb-3 border-b shrink-0">
                                        <span className="font-semibold text-foreground">Subject:</span>{" "}
                                        <span className="text-foreground">{currentTemplate.subject}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        <div className="text-muted-foreground whitespace-pre-line leading-relaxed text-sm">
                                            {currentTemplate.body}
                                        </div>
                                    </div>
                                </div>

                                {/* Navigation and Use button */}
                                <div className="flex items-center justify-between mt-4 shrink-0">
                                    <Button
                                        variant="outline"
                                        onClick={handlePrevious}
                                        disabled={totalTemplates <= 1}
                                        className="gap-1 px-4 h-10 border-foreground/30 hover:bg-muted bg-background font-medium"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Previous
                                    </Button>

                                    <span className="text-sm text-muted-foreground font-semibold">
                                        {currentIndex + 1}/{totalTemplates}
                                    </span>

                                    <Button
                                        variant="outline"
                                        onClick={handleNext}
                                        disabled={totalTemplates <= 1}
                                        className="gap-1 px-4 h-10 border-foreground/30 hover:bg-muted bg-background font-medium"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>

                                <Button
                                    onClick={handleUseTemplate}
                                    className="mt-4 w-full h-11 bg-violet-600 hover:bg-violet-700 text-white text-base font-medium rounded-lg flex items-center justify-center gap-2 shrink-0"
                                >
                                    Use This Template
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                    <Search className="w-8 h-8 opacity-40" />
                                </div>
                                <p className="text-center">
                                    {activeTab === "saved"
                                        ? "No saved templates yet. Save a template from the editor to see it here."
                                        : "No templates match your filters"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
