import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Create a Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    console.log("[Gmail Status] Request received");

    const session = await getServerSession(authOptions);
    console.log("[Gmail Status] Session:", session ? "Found" : "Not found");

    if (session?.user) {
        console.log("[Gmail Status] User ID:", (session.user as any).id);
    }

    if (!session || !session.user || !(session.user as any).id) {
        console.log("[Gmail Status] Unauthorized - returning 401");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("[Gmail Status] Fetching user data from Supabase for user:", (session.user as any).id);

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('gmail_connected, gmail_permission_level, gmail_access_token')
            .eq('id', (session.user as any).id)
            .single();

        if (error) {
            console.error("[Gmail Status] Supabase error:", error);
            return NextResponse.json({
                isConnected: false,
                permissionLevel: null,
                email: null
            });
        }

        console.log("[Gmail Status] User data:", {
            gmail_connected: user?.gmail_connected,
            gmail_permission_level: user?.gmail_permission_level,
            has_access_token: !!user?.gmail_access_token
        });

        // If connected, fetch the Gmail email address
        let gmailEmail: string | null = null;
        if (user?.gmail_connected && user?.gmail_access_token) {
            try {
                const oauth2Client = new google.auth.OAuth2();
                oauth2Client.setCredentials({ access_token: user.gmail_access_token });

                const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
                const profile = await gmail.users.getProfile({ userId: 'me' });
                gmailEmail = profile.data.emailAddress || null;
                console.log("[Gmail Status] Fetched Gmail email:", gmailEmail);
            } catch (gmailError) {
                console.error("[Gmail Status] Error fetching Gmail profile:", gmailError);
                // Token might be expired, but we still report as connected
                // The refresh will happen when they try to use Gmail
            }
        }

        const response = {
            isConnected: !!user?.gmail_connected,
            permissionLevel: user?.gmail_permission_level || null,
            email: gmailEmail
        };

        console.log("[Gmail Status] Returning:", response);
        return NextResponse.json(response);
    } catch (error) {
        console.error("[Gmail Status] Unexpected error:", error);
        return NextResponse.json({
            isConnected: false,
            permissionLevel: null,
            email: null
        });
    }
}
