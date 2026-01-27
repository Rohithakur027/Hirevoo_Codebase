import { NextRequest, NextResponse } from 'next/server';
import { gmailClient } from '@/lib/gmail/client';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { getUTCTimeISO } from "@/lib/date-helpers";

// Create a Supabase client with service role key for admin operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    console.log("[Gmail Callback] Init:", { code: !!code, error, state });

    if (error) {
        return NextResponse.redirect(new URL(`/settings?error=${error}`, request.url));
    }
    if (!code) {
        return NextResponse.redirect(new URL('/settings?error=missing_code', request.url));
    }

    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.redirect(new URL('/settings?error=unauthorized', request.url));
    }

    const userEmail = session.user.email;

    // Parse permission level from state (format: "userId:permissionLevel")
    let permissionLevel = 'FULL_ACCESS';
    if (state && state.includes(':')) {
        const parts = state.split(':');
        const parsedPermissionLevel = parts[parts.length - 1];
        // Validate permission level
        if (['SEND_ONLY', 'FULL_ACCESS'].includes(parsedPermissionLevel)) {
            permissionLevel = parsedPermissionLevel;
        }
    }

    try {
        console.log('[Gmail Callback] Starting token exchange...');
        const tokens = await gmailClient.getTokensFromCode(code);
        console.log('[Gmail Callback] Tokens received:', {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            expiryDate: tokens.expiry_date
        });

        if (!tokens.access_token) {
            console.error('No access token returned from Google');
            return NextResponse.redirect(new URL('/settings?error=no_access_token', request.url));
        }

        console.log('[Gmail Callback] Fetching user profile...');
        const { email: connectedEmail } = await gmailClient.getUserProfile(tokens.access_token);
        console.log('[Gmail Callback] Connected email:', connectedEmail);

        const expiresAt = tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null;

        console.log('[Gmail Callback] Updating user in database...', {
            userEmail: session.user.email,
            userId: (session.user as any).id,
            permissionLevel,
            hasAccessToken: !!tokens.access_token
        });

        // Encrypt refresh token if present
        let encryptedToken: { salt: string | null, content: string | null, tag: string | null } = { salt: null, content: null, tag: null };
        if (tokens.refresh_token) {
            const { salt, content, tag } = encrypt(tokens.refresh_token);
            encryptedToken = { salt, content, tag };
        }

        // Prepare update data
        const updateData: any = { // Use any to bypass strict type checking for new columns
            gmail_connected: true,
            gmail_permission_level: permissionLevel,
            updated_at: getUTCTimeISO(),
        };

        // Only update refresh token if we received a new one (Google doesn't always send it)
        if (tokens.refresh_token) {
            updateData.gmail_refresh_token_IV = encryptedToken.salt;
            updateData.gmail_refresh_token_content = encryptedToken.content;
            updateData.gmail_refresh_token_tag = encryptedToken.tag;
        }

        let updateError;
        let updatedRows = 0;

        // Try to update by ID first if available (most reliable)
        const userId = (session.user as any).id;
        if (userId) {
            // First verify the user exists in the DB
            const { data: existingUser, error: lookupError } = await supabase
                .from('users')
                .select('id, email, gmail_connected')
                .eq('id', userId)
                .single();

            console.log('[Gmail Callback] User lookup by ID:', { userId, existingUser, lookupError });

            if (existingUser) {
                const { error, data } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('id', userId)
                    .select();
                updateError = error;
                updatedRows = data?.length || 0;
                console.log('[Gmail Callback] Update by ID result:', { error, updatedRows, data });
            } else {
                console.warn('[Gmail Callback] No user found with ID:', userId, '— trying email fallback');
            }
        }

        // Fallback to email if ID update didn't work
        if (updatedRows === 0) {
            console.log('[Gmail Callback] Falling back to email update for:', userEmail);
            const { error, data } = await supabase
                .from('users')
                .update(updateData)
                .eq('email', userEmail)
                .select();
            updateError = error;
            updatedRows = data?.length || 0;
            console.log('[Gmail Callback] Update by email result:', { error, updatedRows, data });
        }

        if (updateError) {
            console.error('[Gmail Callback] Database update error:', updateError);
            return NextResponse.redirect(new URL('/settings?error=database_error', request.url));
        }

        if (updatedRows === 0) {
            console.error('[Gmail Callback] No rows updated! User not found by ID or email. userId:', userId, 'email:', userEmail);
            return NextResponse.redirect(new URL('/settings?error=user_not_found', request.url));
        }

        // Verify the update actually persisted
        const { data: verifyUser } = await supabase
            .from('users')
            .select('id, gmail_connected, gmail_permission_level')
            .eq('email', userEmail)
            .single();
        console.log('[Gmail Callback] Verification read after update:', verifyUser);

        console.log('[Gmail Callback] Database update successful, rows updated:', updatedRows);

        // ── Start Gmail Push Notifications (Watch) ──────────────────────
        // Uses the fresh tokens to subscribe to inbox changes via Pub/Sub.
        // Non-blocking: if this fails, the user is still connected — they
        // just won't get real-time reply tracking until the watch is set up.
        if (permissionLevel === 'FULL_ACCESS') {
            try {
                const topicName = process.env.GMAIL_TOPIC_NAME;
                if (!topicName) {
                    console.warn('[Gmail Callback] GMAIL_TOPIC_NAME not set — skipping watch setup.');
                } else {
                    const oauth2Client = new google.auth.OAuth2(
                        process.env.GOOGLE_CLIENT_ID,
                        process.env.GOOGLE_CLIENT_SECRET
                    );
                    oauth2Client.setCredentials({
                        access_token: tokens.access_token,
                        refresh_token: tokens.refresh_token,
                    });

                    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

                    const watchResponse = await gmail.users.watch({
                        userId: 'me',
                        requestBody: {
                            topicName,
                            labelIds: ['INBOX'],
                        },
                    });

                    const watchExpiration = watchResponse.data.expiration;
                    const watchHistoryId = watchResponse.data.historyId;

                    console.log('[Gmail Callback] Watch started:', {
                        expiration: watchExpiration,
                        historyId: watchHistoryId,
                    });

                    // Save the watch expiration so we can renew before it expires
                    const resolvedUserId = userId || verifyUser?.id;
                    if (resolvedUserId && watchExpiration) {
                        await supabase
                            .from('users')
                            .update({
                                gmail_watch_expiration: new Date(Number(watchExpiration)).toISOString(),
                                gmail_history_id: watchHistoryId,
                                updated_at: getUTCTimeISO(),
                            })
                            .eq('id', resolvedUserId);

                        console.log('[Gmail Callback] Watch expiration saved for user:', resolvedUserId);
                    }
                }
            } catch (watchError) {
                // Do NOT fail the auth flow — the user is connected, just without live notifications
                console.error('[Gmail Callback] Watch setup failed (non-fatal):', watchError);
            }
        } else {
            console.log('[Gmail Callback] SEND_ONLY permission — skipping watch (no read scope).');
        }

        return NextResponse.redirect(new URL('/settings?success=gmail_connected', request.url));

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url));
    }
}
