import { NextRequest, NextResponse } from 'next/server';
import { gmailClient } from '@/lib/gmail/client';
import { supabase } from '@/lib/supabase/supabase';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL(`/dashboard/settings?error=${error}`, request.url));
    }
    if (!code) {
        return NextResponse.redirect(new URL('/dashboard/settings?error=missing_code', request.url));
    }

    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.redirect(new URL('/dashboard/settings?error=unauthorized', request.url));
    }

    const userEmail = session.user.email;

    try {
        const tokens = await gmailClient.getTokensFromCode(code);


        if (!tokens.access_token) {
            console.error('No access token returned from Google');
            return NextResponse.redirect(new URL('/dashboard/settings?error=no_access_token', request.url));
        }

        const { email: connectedEmail } = await gmailClient.getUserProfile(tokens.access_token);

        const expiresAt = tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null;

        const { error: updateError } = await supabase
            .from('users')
            .update({
                gmail_connected: true,
                gmail_access_token: tokens.access_token,
                gmail_refresh_token: tokens.refresh_token,
                gmail_token_expires_at: expiresAt,
                updated_at: new Date().toISOString(),
            })
            .eq('email', userEmail);

        if (updateError) {
            console.error('Error updating user:', updateError);
            return NextResponse.redirect(new URL('/dashboard/settings?error=database_error', request.url));
        }

        return NextResponse.redirect(new URL('/dashboard', request.url));

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.redirect(new URL('/dashboard/settings?error=token_exchange_failed', request.url));
    }
}