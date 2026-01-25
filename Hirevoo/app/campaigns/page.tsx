'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { useCampaign, type Campaign } from '@/context/CampaignContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus,
    Mail,
    Users,
    Send,
    Clock,
    CheckCircle2,
    Edit3,
    Trash2,
    ArrowRight,
    Search,
    Eye,
    User,
    Settings,
    LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Edit3 },
    composing: { label: 'Composing', color: 'bg-amber-100 text-amber-600 border-amber-200', icon: Edit3 },
    ready: { label: 'Ready', color: 'bg-blue-100 text-blue-600 border-blue-200', icon: Clock },
    sending: { label: 'Sending', color: 'bg-indigo-100 text-indigo-600 border-indigo-200', icon: Send },
    sent: { label: 'Sent', color: 'bg-emerald-100 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
};

// Avatar colors for campaigns
const avatarColors = [
    "bg-emerald-500",
    "bg-[#4553f4]",
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-purple-500",
];

function getInitials(name: string): string {
    return name
        .split(" ")
        .map(word => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 1);
}

export default function CampaignsPage() {
    const { data: session, status: sessionStatus } = useSession();
    const isLoadingSession = sessionStatus === "loading";
    const user = session?.user;
    const { resetCampaign } = useCampaign();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const userInitials = user?.name
        ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
        : "NW";

    // Fetch campaigns from API
    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                const response = await fetch('/api/campaigns');
                if (response.ok) {
                    const data = await response.json();
                    setCampaigns(data.campaigns || []);
                }
            } catch (error) {
                console.error("Failed to fetch campaigns:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (sessionStatus === 'authenticated') {
            fetchCampaigns();
        }
    }, [sessionStatus]);

    const getNextAction = (c: Campaign) => {
        const contactsCount = c.contacts?.length || 0;
        if (!c.status || c.status === 'draft' || contactsCount === 0) {
            return { label: 'Upload Contacts', href: '/campaigns/new' };
        }
        if (c.status === 'composing') {
            return { label: `Continue`, href: `/campaigns/${c.id}/compose` };
        }
        if (c.status === 'ready') {
            return { label: 'Send', href: `/campaigns/${c.id}/send` };
        }
        return null;
    };

    const handleDelete = async (campaignId: string) => {
        // Optimistic update
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));

        try {
            // TODO: Implement delete API call here if needed, or rely on context
            // For now just local state update as per original code pattern, 
            // but normally we would delete from backend too.
        } catch (error) {
            console.error("Failed to delete campaign", error);
        }
    };

    const filteredCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full">
            {/* Header - Unified with Dashboard */}
            <header className="flex items-center justify-between px-8 pt-4 pb-4 bg-gray-50 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Campaigns</h1>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                        {(() => {
                            const date = new Date()
                            const day = date.getDate()
                            const month = date.toLocaleString('default', { month: 'short' })
                            const year = date.getFullYear()

                            const suffix = (day: number) => {
                                if (day > 3 && day < 21) return 'th'
                                switch (day % 10) {
                                    case 1: return "st"
                                    case 2: return "nd"
                                    case 3: return "rd"
                                    default: return "th"
                                }
                            }
                            return `${day}${suffix(day)} ${month} ${year}`
                        })()}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="pl-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                    <div className="text-right">
                                        {isLoadingSession ? (
                                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                                        ) : (
                                            <p className="text-sm font-medium text-gray-800">{user?.name || "Guest User"}</p>
                                        )}
                                    </div>
                                    <Avatar className="w-8 h-8">
                                        <AvatarImage src={user?.image || "/placeholder.svg"} />
                                        <AvatarFallback>{userInitials}</AvatarFallback>
                                    </Avatar>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem className="cursor-pointer">
                                    <User className="w-4 h-4 mr-2" />
                                    Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="cursor-pointer text-red-600">
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Log Out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {/* Main Content Body */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
                <div className="mx-auto max-w-6xl">
                    {/* Page Actions */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                                {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <Link href="/campaigns/new">
                            <Button className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[6px] px-4 font-medium h-9">
                                <Plus className="h-4 w-4" />
                                New Campaign
                            </Button>
                        </Link>
                    </div>

                    {/* Campaign List or Empty State */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : campaigns.length === 0 ? (
                        <Card className="border-border/40 bg-white shadow-sm">
                            <CardContent className="py-16">
                                <EmptyState
                                    icon={Mail}
                                    title="No campaigns yet"
                                    description="Create your first campaign to start sending personalized emails at scale."
                                    action={{
                                        label: 'Create Campaign',
                                        onClick: () => window.location.href = '/campaigns/new',
                                    }}
                                />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-0 bg-white shadow-sm ring-1 ring-gray-100 rounded-xl">
                            <CardHeader className="pb-4 pt-5 px-5 border-b border-gray-50">
                                <div className="flex items-center justify-between gap-4">
                                    <CardTitle className="text-lg font-semibold text-gray-800">Your Campaigns</CardTitle>
                                    <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                        <Input
                                            placeholder="Search campaigns..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="h-9 pl-9 text-sm bg-gray-50 border-gray-100 focus:bg-white focus:ring-emerald-500/20 focus:border-emerald-500"
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-5 py-2">
                                <div className="space-y-1">
                                    {filteredCampaigns.map((c, index) => {
                                        const status = statusConfig[c.status || 'draft'];
                                        const nextAction = getNextAction(c);
                                        const contacts = c.contacts || [];
                                        const completedEmails = contacts.filter(ct => (ct as any).emailStatus === 'done').length;
                                        const avatarColor = avatarColors[index % avatarColors.length];
                                        const initial = getInitials(c.name);

                                        return (
                                            <motion.div
                                                key={c.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    {/* Avatar */}
                                                    <div className={cn(
                                                        "flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold text-sm shadow-sm",
                                                        avatarColor
                                                    )}>
                                                        {initial}
                                                    </div>

                                                    {/* Campaign Info */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-gray-900 text-sm">
                                                                {c.name}
                                                            </span>
                                                            <Badge className={cn("text-[10px] px-1.5 py-0 font-medium border-0", status.color)}>
                                                                {status.label}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <Users className="h-3 w-3 text-gray-400" />
                                                                {c.contacts?.length || 0} contacts
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Mail className="h-3 w-3 text-gray-400" />
                                                                {completedEmails}/{c.contacts?.length || 0} sent
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(c.id)}
                                                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>

                                                    {nextAction && (
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-[6px]"
                                                            asChild
                                                        >
                                                            <Link href={nextAction.href}>
                                                                {nextAction.label}
                                                                <ArrowRight className="ml-1.5 w-3 h-3" />
                                                            </Link>
                                                        </Button>
                                                    )}

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 px-3 text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50 bg-transparent rounded-[6px]"
                                                        asChild
                                                    >
                                                        <Link href={`/campaigns/${c.id}`}>
                                                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                                                            View
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                                {filteredCampaigns.length === 0 && campaigns.length > 0 && (
                                    <div className="py-12 text-center text-sm text-gray-500">
                                        No campaigns match your search.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
