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
    Bell,
    ChevronDown,
    Menu,
    Eye,
    Calendar,
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
    const { campaign, resetCampaign } = useCampaign();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Load current campaign into list
    useEffect(() => {
        if (campaign) {
            setCampaigns([campaign]);
        }
    }, [campaign]);

    const getNextAction = (c: Campaign) => {
        if (!c.status || c.status === 'draft' || c.contacts.length === 0) {
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

    const handleDelete = (campaignId: string) => {
        if (campaign?.id === campaignId) {
            resetCampaign();
        }
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    };

    const filteredCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-screen overflow-hidden bg-slate-50">
            <div className="flex flex-col h-full">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600 hover:bg-slate-100">
                            <Menu className="h-5 w-5" />
                        </Button>
                        <h1 className="text-xl font-bold tracking-tight text-foreground">Campaigns</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search"
                                className="h-10 w-64 pl-10 bg-slate-50 border-slate-200 rounded-lg focus:bg-white"
                            />
                        </div>

                        {/* Notification Bell */}
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100 relative">
                            <Bell className="h-5 w-5 text-slate-600" />
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                        </Button>

                        {/* Mail Icon */}
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100 relative">
                            <Mail className="h-5 w-5 text-slate-600" />
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-500" />
                        </Button>

                        {/* User Profile */}
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white font-semibold text-sm">
                                LY
                            </div>
                            <div className="hidden md:flex flex-col">
                                <span className="text-sm font-medium text-foreground">Lamine Yamal</span>
                                <span className="text-xs text-muted-foreground">HR Manager</span>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mx-auto max-w-5xl">
                        {/* Page Actions */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                    {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <Link href="/campaigns/new">
                                <Button className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white">
                                    <Plus className="h-4 w-4" />
                                    New Campaign
                                </Button>
                            </Link>
                        </div>

                        {/* Campaign List or Empty State */}
                        {campaigns.length === 0 ? (
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
                            <Card className="border-border/40 bg-white shadow-sm">
                                <CardHeader className="pb-4 pt-5 px-5">
                                    <div className="flex items-center justify-between gap-4">
                                        <CardTitle className="text-lg font-semibold text-foreground">Your Campaigns</CardTitle>
                                        <div className="relative w-48">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                placeholder="Search campaigns..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="h-9 pl-9 text-sm bg-slate-50 border-slate-200 focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-5 pb-4">
                                    <div className="space-y-2">
                                        {filteredCampaigns.map((c, index) => {
                                            const status = statusConfig[c.status || 'draft'];
                                            const StatusIcon = status.icon;
                                            const nextAction = getNextAction(c);
                                            const completedEmails = c.contacts.filter(ct => (ct as any).emailStatus === 'done').length;
                                            const avatarColor = avatarColors[index % avatarColors.length];
                                            const initial = getInitials(c.name);

                                            return (
                                                <motion.div
                                                    key={c.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-slate-50 transition-colors group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {/* Avatar */}
                                                        <div className={cn(
                                                            "flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold text-sm",
                                                            avatarColor
                                                        )}>
                                                            {initial}
                                                        </div>

                                                        {/* Campaign Info */}
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-foreground text-sm">
                                                                    {c.name}
                                                                </span>
                                                                <Badge className={cn("text-xs px-2 py-0.5 border", status.color)}>
                                                                    {status.label}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Users className="h-3 w-3" />
                                                                    {c.contacts.length} contacts
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Mail className="h-3 w-3" />
                                                                    {completedEmails}/{c.contacts.length} written
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
                                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>

                                                        {nextAction && (
                                                            <Button
                                                                size="sm"
                                                                className="h-8 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                                                                asChild
                                                            >
                                                                <Link href={nextAction.href}>
                                                                    {nextAction.label}
                                                                    <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                                                                </Link>
                                                            </Button>
                                                        )}

                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-medium"
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
                                        <div className="py-8 text-center text-sm text-muted-foreground">
                                            No campaigns match your search.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
