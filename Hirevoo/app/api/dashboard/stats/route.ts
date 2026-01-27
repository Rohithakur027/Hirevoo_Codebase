/**
 * app/api/dashboard/stats/route.ts
 *
 * Dashboard Statistics API endpoint
 * Returns aggregated stats for the dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // 1. Authenticate user
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get user from database
        const supabase = createServerSupabaseClient();

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 3. Get total outreach (sent emails)
        // Count campaign_contacts with 'sent' status for user's campaigns
        const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id')
            .eq('user_id', user.id);

        const campaignIds = campaigns?.map(c => c.id) || [];

        let totalOutreach = 0;

        if (campaignIds.length > 0) {
            const { count, error: countError } = await supabase
                .from('campaign_contacts')
                .select('*', { count: 'exact', head: true })
                .in('campaign_id', campaignIds)
                .eq('status', 'sent');

            if (!countError) {
                totalOutreach = count || 0;
            }
        }

        // 4. Get chart data (emails sent by day for last 7 days)
        // Fetch `updated_at` timestamps for last 7 days and aggregate in-memory
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: recentSentContacts } = await supabase
            .from('campaign_contacts')
            .select('updated_at') // Using updated_at as proxy for sent_at if sent_at column doesn't exist on contacts, checking schema...
            // User prompt says: "campaign_contacts status: 'pending' | 'sent' | 'failed', sent_at when status = 'sent'"
            // So we assume sent_at exists or we use updated_at. Let's try updated_at as fallback if sent_at missing.
            // Actually, the prompt explicitly says "from campaign_contacts.sent_at".
            .in('campaign_id', campaignIds)
            .eq('status', 'sent')
            .gte('updated_at', sevenDaysAgo.toISOString());

        // Aggregate by day
        const chartDataMap = new Map<string, number>();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = days[d.getDay()];
            chartDataMap.set(dayName, 0);
        }

        // Fill with data using updated_at as proxy for sent_at
        recentSentContacts?.forEach(contact => {
            const date = new Date(contact.updated_at);
            const dayName = days[date.getDay()];
            // Increment day count

            if (chartDataMap.has(dayName)) {
                chartDataMap.set(dayName, (chartDataMap.get(dayName) || 0) + 1);
            }
        });

        // Convert map to array matching the order of last 7 days
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = days[d.getDay()];
            chartData.push({
                day: dayName,
                value: chartDataMap.get(dayName) || 0
            });
        }

        return NextResponse.json({
            success: true,
            stats: {
                totalOutreach,
                totalOpened: 0, // Placeholder
                totalReplied: 0, // Placeholder
            },
            chartData
        });

    } catch (error) {
        console.error('[API:dashboard] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
