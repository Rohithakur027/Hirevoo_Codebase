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
    BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomNav } from '@/components/layout/BottomNav';

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
            // Note: Implement delete API call if needed, or rely on context
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
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative bg-gray-50">
            {/* Mobile Header */}
            <div className="md:hidden px-4 pt-6 pb-2">
                <div className="flex items-start justify-between mb-1">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-1">Campaigns</h1>
                        <p className="text-sm text-gray-400 font-medium mb-3">
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
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-200/50 rounded-full mb-6">
                            <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-600">{campaigns.length} campaigns</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-100/80 rounded-full pl-2 pr-3 py-1 mt-1">
                        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-700">
                            {userInitials}
                        </div>
                        <span className="text-xs uppercase text-gray-700 font-bold tracking-wide truncate max-w-[100px]">{user?.name || "ROHIT THAKUR"}</span>
                    </div>
                </div>

                <Link href="/campaigns/new" className="block w-full mb-4">
                    <Button className="w-full bg-black text-white hover:bg-gray-900 h-12 rounded-full text-[15px] font-medium shadow-lg shadow-black/5">
                        <Plus className="w-4 h-4 mr-1.5" />
                        New Campaign
                    </Button>
                </Link>

                <div className="relative mb-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 pl-11 bg-gray-100/80 border-0 rounded-2xl text-base placeholder:text-gray-500 focus-visible:ring-0 focus-visible:bg-white transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Desktop Header */}
            <header className="hidden md:flex items-center justify-between px-8 pt-4 pb-4 bg-gray-50 flex-shrink-0">
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
                {/* ... (Existing Desktop Header Right Side) ... */}
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
            <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-24 md:pb-8 min-h-0 bg-gray-50">
                <div className="mx-auto max-w-6xl">
                    {/* Desktop Page Actions */}
                    <div className="hidden md:flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                                {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <Link href="/campaigns/new">
                            <Button className="gap-2 bg-black hover:bg-gray-800 text-white rounded-[6px] px-4 font-medium h-9">
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
                        <div className="space-y-3 md:space-y-0">
                            {/* Mobile List View */}
                            <div className="md:hidden space-y-3">
                                {filteredCampaigns.map((c, index) => {
                                    const status = statusConfig[c.status || 'draft'];
                                    const initial = getInitials(c.name);
                                    const completedEmails = c.contacts?.filter(ct => (ct as any).emailStatus === 'done').length || 0;
                                    const avatarColor = avatarColors[index % avatarColors.length];

                                    return (
                                        <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    {/* Avatar Circle */}
                                                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium text-sm", avatarColor)}>
                                                        {initial}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <h3 className="font-bold text-gray-900 truncate text-base leading-tight">{c.name}</h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium", status.color.replace('border', ''))}>
                                                                {status.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleDelete(c.id)}
                                                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>

                                                    <Link href={`/campaigns/${c.id}`}>
                                                        <Button variant="outline" size="sm" className="h-8 px-4 rounded-full border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs font-bold shadow-sm">
                                                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                                                            View
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-gray-500 font-medium pl-[52px]">
                                                <span className="flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5 text-gray-400" />
                                                    {c.contacts?.length || 0} contacts
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                    {completedEmails}/{c.contacts?.length || 0} sent
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Desktop Card View */}
                            <Card className="hidden md:block border-0 bg-white shadow-sm ring-1 ring-gray-100 rounded-xl">
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
                                                                className="h-8 px-3 text-xs bg-black hover:bg-gray-800 text-white rounded-[6px]"
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
                                                            className="h-8 px-3 text-xs border-black text-black hover:bg-gray-50 bg-transparent rounded-[6px]"
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
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Navigation */}
            <BottomNav />
        </div>
    );
}
