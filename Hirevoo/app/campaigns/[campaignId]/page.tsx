'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
    Mail,
    TrendingUp,
    MessageSquare,
    ArrowLeft,
} from 'lucide-react';
import { RecipientTable } from '@/components/dashboard/RecipientTable';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Recipient } from '@/lib/data';

interface Contact {
    id: string;
    name: string;
    email: string;
    company?: string;
    role?: string;
    emailStatus: 'done' | 'draft';
    emailSubject: string;
    emailBody: string;
    sentAt?: string;
    error?: string;
}

interface Campaign {
    id: string;
    name: string;
    status: string;
    contacts: Contact[];
    createdAt: string;
    updatedAt: string;
    sentAt?: string;
}

export default function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
    // Unwrap params using React.use()
    const { campaignId } = use(params);

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCampaign = async () => {
            try {
                const response = await fetch(`/api/campaigns/${campaignId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch campaign');
                }
                const data = await response.json();
                if (data.success) {
                    console.log("Fetched campaign contacts:", data.campaign.contacts);
                    setCampaign(data.campaign);
                } else {
                    throw new Error(data.error || 'Failed to fetch campaign');
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load campaign details');
            } finally {
                setIsLoading(false);
            }
        };

        if (campaignId) {
            fetchCampaign();
        }
    }, [campaignId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !campaign) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-red-500 max-w-md text-center">{error || 'Campaign not found'}</p>
                <Link href="/campaigns" className="text-sm text-emerald-600 hover:underline">
                    Back to Campaigns
                </Link>
            </div>
        );
    }

    // Calculate stats
    const totalOutreach = campaign.contacts.filter(c => c.emailStatus === 'done' || (c as any).status === 'sent').length;
    const totalOpened = 0; // Placeholder
    const totalReplied = 0; // Placeholder

    // Map contacts to Recipient format for the table
    const mappedRecipients: Recipient[] = campaign.contacts.map(c => ({
        id: c.id,
        name: c.name || '',
        email: c.email || '',
        status: (c.emailStatus === 'done' || (c as any).status === 'sent') ? 'Sent' : 'Pending',
        sentAt: c.sentAt || campaign.sentAt || campaign.createdAt || new Date().toISOString(),
        avatar: "/placeholder.svg",
        initials: (c.name || c.email || "?").substring(0, 2).toUpperCase()
    }));

    const formatNumber = (num: number) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <header className="flex items-center gap-4 px-8 pt-6 pb-6 flex-shrink-0">
                <Link href="/campaigns" className="text-gray-400 hover:text-gray-600 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{campaign.name}</h1>
                    <p className="text-sm text-gray-500 font-medium">Campaign Overview</p>
                </div>
            </header>

            {/* Main Content Area - Fixed Height Container */}
            <div className="flex-1 flex overflow-hidden px-8 pb-8 gap-6">

                {/* Left Column - Stats & Table */}
                <main className="flex-1 flex flex-col overflow-hidden gap-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-6 flex-shrink-0">
                        {/* Total Outreach Card */}
                        <div className="rounded-[16px] p-4 h-[155px] flex flex-col justify-between" style={{ backgroundColor: "#cec4ff" }}>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                    <Mail className="w-3 h-3 text-violet-700" />
                                </div>
                                <span className="text-xs font-medium text-black">Total Outreach</span>
                            </div>
                            <div className="flex flex-col items-center justify-center flex-1">
                                {totalOutreach === 0 ? (
                                    <p className="text-sm text-black/60">No Data to Display</p>
                                ) : (
                                    <>
                                        <p className="text-2xl font-bold text-black">
                                            {formatNumber(totalOutreach)}
                                        </p>
                                        <p className="text-[10px] text-gray-600">Emails sent</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Total Opened Card */}
                        <div className="rounded-[16px] p-4 h-[155px] flex flex-col justify-between" style={{ backgroundColor: "#aac9ff" }}>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                    <TrendingUp className="w-3 h-3 text-emerald-700" />
                                </div>
                                <span className="text-xs font-medium text-black">Total Opened</span>
                            </div>
                            <div className="flex flex-col items-center justify-center flex-1">
                                {totalOpened === 0 ? (
                                    <p className="text-sm text-black/60">No Data to Display</p>
                                ) : (
                                    <>
                                        <p className="text-2xl font-bold text-black">
                                            {formatNumber(totalOpened)}
                                        </p>
                                        <p className="text-[10px] text-gray-600">Emails opened</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Total Replied Card */}
                        <div className="rounded-[16px] p-4 h-[155px] flex flex-col justify-between" style={{ backgroundColor: "#93e4b9" }}>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-white/30 rounded-md flex items-center justify-center">
                                    <MessageSquare className="w-3 h-3 text-amber-700" />
                                </div>
                                <span className="text-xs font-medium text-black">Total Replied</span>
                            </div>
                            <div className="flex flex-col items-center justify-center flex-1">
                                {totalReplied === 0 ? (
                                    <p className="text-sm text-black/60">No Data to Display</p>
                                ) : (
                                    <>
                                        <p className="text-2xl font-bold text-black">
                                            {formatNumber(totalReplied)}
                                        </p>
                                        <p className="text-[10px] text-gray-600">Replies received</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Recipient Table - Flex Grow & Scrollable */}
                    <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <RecipientTable recipients={mappedRecipients} />
                    </div>
                </main>

                {/* Right Sidebar - Recent Activity */}
                <aside className="w-[300px] flex-shrink-0 flex flex-col overflow-hidden h-full">
                    <RecentActivity />
                </aside>
            </div>
        </div>
    );
}
