"use client"

import { useState } from "react"
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
import { Search } from "lucide-react"

interface Campaign {
    id: string
    name: string
    location: string
    sent: number
    replyRate: string
    ctrRate: string
    createdDate: string
}

const campaigns: Campaign[] = [
    {
        id: "1",
        name: "Solaris Sparkle",
        location: "Miami, Florida",
        sent: 102,
        replyRate: "12.50%",
        ctrRate: "8.2%",
        createdDate: "Jan 12, 2024",
    },
    {
        id: "2",
        name: "Crimson Dusk",
        location: "Denver, Colorado",
        sent: 214,
        replyRate: "07.65%",
        ctrRate: "5.8%",
        createdDate: "Jan 15, 2024",
    },
    {
        id: "3",
        name: "Indigo Zephyr",
        location: "Orlando, Florida",
        sent: 143,
        replyRate: "16.40%",
        ctrRate: "11.3%",
        createdDate: "Jan 18, 2024",
    },
    {
        id: "4",
        name: "Roseate Crest",
        location: "Las Vegas, Nevada",
        sent: 185,
        replyRate: "23.64%",
        ctrRate: "15.7%",
        createdDate: "Jan 20, 2024",
    },
    {
        id: "5",
        name: "Azure Summit",
        location: "Seattle, Washington",
        sent: 256,
        replyRate: "19.22%",
        ctrRate: "12.4%",
        createdDate: "Jan 22, 2024",
    },
    {
        id: "6",
        name: "Golden Wave",
        location: "San Francisco, California",
        sent: 312,
        replyRate: "21.45%",
        ctrRate: "14.1%",
        createdDate: "Jan 25, 2024",
    },
    {
        id: "7",
        name: "Silver Storm",
        location: "Chicago, Illinois",
        sent: 178,
        replyRate: "14.88%",
        ctrRate: "9.6%",
        createdDate: "Jan 28, 2024",
    },
    {
        id: "8",
        name: "Emerald Peak",
        location: "Austin, Texas",
        sent: 289,
        replyRate: "25.10%",
        ctrRate: "16.8%",
        createdDate: "Jan 30, 2024",
    },
]

export function CampaignTable() {
    const [searchQuery, setSearchQuery] = useState("")

    const filteredCampaigns = campaigns.filter((campaign) =>
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
                        {filteredCampaigns.map((campaign) => (
                            <TableRow key={campaign.id} className="border-b border-gray-50">
                                <TableCell className="py-3">
                                    <span className="text-sm font-medium text-gray-800">
                                        {campaign.name}
                                    </span>
                                </TableCell>
                                <TableCell className="py-3">
                                    <span className="text-sm text-gray-500">{campaign.createdDate}</span>
                                </TableCell>
                                <TableCell className="py-3">
                                    <span className="text-sm text-gray-600">{campaign.ctrRate}</span>
                                </TableCell>
                                <TableCell className="py-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7 px-3 border-emerald-500 text-emerald-600 hover:bg-emerald-50 bg-transparent"
                                    >
                                        Manage
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
