import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from '@supabase/supabase-js';
import { gmailClient } from "@/lib/gmail/client";

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
        const userId = (session.user as any).id;
        console.log("[Gmail Status] Checking status for user:", userId);

        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('gmail_connected, gmail_permission_level')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("[Gmail Status] Supabase error:", error);
            return NextResponse.json({
                isConnected: false,
                permissionLevel: null,
                email: null
            });
        }

        const isConnected = !!user?.gmail_connected;
        console.log("[Gmail Status] DB Connected Flag:", isConnected);

        let gmailEmail: string | null = null;

        if (isConnected) {
            // Verify actual connectivity and fetch email using stateless client
            // Implicitly tests if refresh token is valid
            try {
                gmailEmail = await gmailClient.getConnectedEmail(userId);
                console.log("[Gmail Status] Fetched Gmail email:", gmailEmail);

                // If email fetch fails (e.g. invalid refresh token), 
                // consider disconnected or return null email
                if (!gmailEmail) {
                    console.warn("[Gmail Status] Connected in DB but failed to fetch email");
                }
            } catch (e) {
                console.error("[Gmail Status] Failed to verify connection with Gmail:", e);
            }
        }

        const response = {
            isConnected: isConnected && !!gmailEmail, // Only consider connected if gmail reachable
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
