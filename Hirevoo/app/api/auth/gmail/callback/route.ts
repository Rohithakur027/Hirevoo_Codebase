import { NextRequest, NextResponse } from 'next/server';
import { gmailClient } from '@/lib/gmail/client';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";

// Create a Supabase client with service role key for admin operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // Contains userId:permissionLevel

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
            gmail_access_token: tokens.access_token,
            gmail_token_expires_at: expiresAt,
            gmail_permission_level: permissionLevel,
            updated_at: new Date().toISOString(),
        };

        // Only update refresh token if we received a new one (Google doesn't always send it)
        if (tokens.refresh_token) {
            updateData.gmail_refresh_token_salt = encryptedToken.salt;
            updateData.gmail_refresh_token_content = encryptedToken.content;
            updateData.gmail_refresh_token_tag = encryptedToken.tag;
            // Clear old column if it exists/is allocated
            updateData.gmail_refresh_token = null;
        }

        let updateError;

        // Try to update by ID first if available (most reliable)
        if ((session.user as any).id) {
            const { error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', (session.user as any).id);
            updateError = error;
        } else {
            // Fallback to email
            console.log('[Gmail Callback] No user ID in session, falling back to email update');
            const { error } = await supabase
                .from('users')
                .update(updateData)
                .eq('email', userEmail);
            updateError = error;
        }

        if (updateError) {
            console.error('[Gmail Callback] Database update error:', updateError);
            return NextResponse.redirect(new URL('/settings?error=database_error', request.url));
        }

        console.log('[Gmail Callback] Database update successful');

        return NextResponse.redirect(new URL('/settings?success=gmail_connected', request.url));

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url));
    }
}
