import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { decrypt } from '@/lib/encryption';
import { getUTCTimeISO } from '@/lib/date-helpers';

// ─── Gmail Watch Renewal Cron ───────────────────────────────────────────────
// Runs daily via Vercel Cron. Finds users whose Gmail watch expires within
// the next 24 hours and re-calls gmail.users.watch() to renew it.
//
// Gmail watches last a maximum of 7 days. If a watch expires, we stop
// receiving Pub/Sub notifications for that user's inbox — meaning reply
// tracking silently breaks. This cron prevents that.

const RENEW_BUFFER_MS = 24 * 60 * 60 * 1000; // Renew if expiring within 24h

export async function GET(request: NextRequest) {
    // ── Auth: only allow Vercel Cron or requests with the correct secret ─
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Cron:RenewWatch] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const topicName = process.env.GMAIL_TOPIC_NAME;
    if (!topicName) {
        console.error('[Cron:RenewWatch] GMAIL_TOPIC_NAME not set');
        return NextResponse.json({ error: 'GMAIL_TOPIC_NAME not configured' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // ── Find users needing renewal ──────────────────────────────────
        // Criteria:
        //   1. gmail_connected = true
        //   2. Has encrypted refresh token
        //   3. Watch is either: expired, expiring within 24h, or never set
        const cutoff = new Date(Date.now() + RENEW_BUFFER_MS).toISOString();

        const { data: users, error: queryError } = await supabase
            .from('users')
            .select('id, email, gmail_refresh_token_IV, gmail_refresh_token_content, gmail_refresh_token_tag, gmail_watch_expiration')
            .eq('gmail_connected', true)
            .not('gmail_refresh_token_content', 'is', null);

        if (queryError) {
            console.error('[Cron:RenewWatch] Query failed:', queryError);
            return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
        }

        if (!users || users.length === 0) {
            console.log('[Cron:RenewWatch] No connected Gmail users found.');
            return NextResponse.json({ success: true, renewed: 0, skipped: 0, failed: 0 });
        }

        // Filter to users who need renewal
        const needsRenewal = users.filter(u => {
            if (!u.gmail_watch_expiration) return true; // Never set up
            return new Date(u.gmail_watch_expiration).getTime() < Date.now() + RENEW_BUFFER_MS;
        });

        console.log(`[Cron:RenewWatch] ${needsRenewal.length}/${users.length} users need watch renewal.`);

        let renewed = 0;
        let failed = 0;

        for (const user of needsRenewal) {
            try {
                // Decrypt refresh token
                if (!user.gmail_refresh_token_IV || !user.gmail_refresh_token_content || !user.gmail_refresh_token_tag) {
                    console.warn(`[Cron:RenewWatch] User ${user.id} missing token parts, skipping.`);
                    failed++;
                    continue;
                }

                let refreshToken: string;
                try {
                    refreshToken = decrypt({
                        salt: user.gmail_refresh_token_IV,
                        content: user.gmail_refresh_token_content,
                        tag: user.gmail_refresh_token_tag,
                    });
                } catch (e) {
                    console.error(`[Cron:RenewWatch] Decrypt failed for user ${user.id}:`, e);
                    failed++;
                    continue;
                }

                // Authenticate with Gmail
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET
                );
                oauth2Client.setCredentials({ refresh_token: refreshToken });

                const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

                // Call watch()
                const watchResponse = await gmail.users.watch({
                    userId: 'me',
                    requestBody: {
                        topicName,
                        labelIds: ['INBOX'],
                    },
                });

                const watchExpiration = watchResponse.data.expiration;
                const watchHistoryId = watchResponse.data.historyId;

                // Save new expiration
                if (watchExpiration) {
                    await supabase
                        .from('users')
                        .update({
                            gmail_watch_expiration: new Date(Number(watchExpiration)).toISOString(),
                            gmail_history_id: watchHistoryId,
                            updated_at: getUTCTimeISO(),
                        })
                        .eq('id', user.id);
                }

                console.log(`[Cron:RenewWatch] Renewed for user ${user.id}, expires: ${watchExpiration}`);
                renewed++;

            } catch (userError: any) {
                console.error(`[Cron:RenewWatch] Failed for user ${user.id}:`, userError?.message || userError);

                // If the token is revoked, mark gmail as disconnected
                const isInvalidGrant =
                    userError?.response?.data?.error === 'invalid_grant' ||
                    userError?.message?.includes('invalid_grant');

                if (isInvalidGrant) {
                    console.warn(`[Cron:RenewWatch] Marking user ${user.id} as disconnected (invalid_grant).`);
                    await supabase
                        .from('users')
                        .update({
                            gmail_connected: false,
                            gmail_watch_expiration: null,
                            updated_at: getUTCTimeISO(),
                        })
                        .eq('id', user.id);
                }

                failed++;
            }
        }

        const skipped = users.length - needsRenewal.length;

        console.log(`[Cron:RenewWatch] Done. Renewed: ${renewed}, Skipped: ${skipped}, Failed: ${failed}`);

        return NextResponse.json({
            success: true,
            total: users.length,
            renewed,
            skipped,
            failed,
        });

    } catch (error) {
        console.error('[Cron:RenewWatch] Fatal error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
