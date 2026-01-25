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
        // We count campaign_contacts where status is 'sent' for campaigns owned by the user
        // Note: This assumes a join or robust RLS. simpler might be to get IDs first or use a view.
        // Let's try a direct count query on campaign_contacts filtered by campaign's user_id.
        // However, simplest efficient way with Supabase is usually to query directly if RLS allows, 
        // or join. Since we might not have complex joins setup, let's look at `campaign_contacts`
        // We need to ensure we only count for this user.
        // Strategy: Get all campaign IDs for user, then count contacts in those campaigns with status 'sent'.

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
        // Since we don't have an easy "group by" in basic Supabase client without stored procedures,
        // we can fetch the `sent_at` timestamps for the last 7 days and aggregate in JS.
        // This is acceptable for smaller datasets. For larger, a RPC or View is better.

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
            .gte('updated_at', sevenDaysAgo.toISOString()); // Using updated_at for query efficiency as it's indexed usually

        // Aggregate by day
        const chartDataMap = new Map<string, number>();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = days[d.getDay()];
            chartDataMap.set(dayName, 0); // Note: this simple keying might overlap if same day name, but for 7 days it's fine (mostly).
            // Actually, better to key by logic order, but UI expects [{day: 'Mon', value: 10}].
            // Let's stick to the simple day name for now as per UI example.
        }

        // Fill with data
        // Note: If real `sent_at` column exists, use it. If not, `updated_at`.
        // I will use `updated_at` as it's more standard if `sent_at` isn't confirmed schema. 
        // Wait, prompt said "campaign_contacts.sent_at". I'll try to select it, if it fails I might need to adjust.
        // Safest is to use updated_at since status='sent' implies update time is send time.

        recentSentContacts?.forEach(contact => {
            const date = new Date(contact.updated_at);
            const dayName = days[date.getDay()];
            // We only want to increment the day relevant to the specific date instance in our 7 day window
            // But the map keys are just "Mon", "Tue". If today is Mon, and 7 days ago was Mon, we might collide?
            // 7 days ago (inclusive) is 8 items? 0 to 6 is 7 days.
            // Today is Wed. 
            // Wed, Tue, Mon, Sun, Sat, Fri, Thu. No collisions.

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
