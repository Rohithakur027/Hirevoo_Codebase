import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Search, Loader2, FolderOpen } from "lucide-react"
import Link from "next/link"

interface Campaign {
    id: string
    name: string
    status: string
    contactCount: number
    createdAt: string
    updatedAt: string
    sentAt: string | null
}

export function CampaignTable() {
    const [searchQuery, setSearchQuery] = useState("")
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                const response = await fetch('/api/campaigns')
                if (response.ok) {
                    const data = await response.json()
                    setCampaigns(data.campaigns || [])
                }
            } catch (error) {
                console.error("Failed to fetch campaigns:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchCampaigns()
    }, [])

    const filteredCampaigns = campaigns.filter((campaign) =>
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Format date helper
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Recent Campaigns</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-3 h-8 w-48 text-sm rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
                <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow className="border-b border-gray-100">
                            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-2">
                                Campaign Name
                            </TableHead>
                            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-2">
                                Date of Creation
                            </TableHead>
                            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-2">
                                CTR Rate
                            </TableHead>
                            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider py-2">
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <div className="flex items-center justify-center text-gray-500">
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        Loading campaigns...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredCampaigns.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-48 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center p-6">
                                        <div className="bg-gray-50 p-4 rounded-2xl mb-3">
                                            <div className="relative">
                                                <FolderOpen className="w-8 h-8 text-gray-300" />
                                                <Plus className="w-3 h-3 text-gray-400 absolute -bottom-1 -right-1 bg-white rounded-full" />
                                            </div>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900">No Recent Campaigns.</p>
                                        <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                                            Click '+ Create New Campaign' to get started.
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCampaigns.map((campaign) => (
                                <TableRow key={campaign.id} className="border-b border-gray-50">
                                    <TableCell className="py-3">
                                        <span className="text-sm font-medium text-gray-800">
                                            {campaign.name}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <span className="text-sm text-gray-500">{formatDate(campaign.createdAt)}</span>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <span className="text-sm text-gray-400">—</span>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Link href={`/campaigns/${campaign.id}`}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-7 px-3 border-emerald-500 text-emerald-600 hover:bg-emerald-50 bg-transparent"
                                            >
                                                Manage
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
