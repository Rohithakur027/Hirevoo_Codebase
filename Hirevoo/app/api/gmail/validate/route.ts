import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gmailClient } from "@/lib/gmail/client";

/**
 * GET /api/gmail/validate
 *
 * Validates that a user's Gmail connection is active and tokens are valid.
 * This endpoint should be called before attempting to send campaigns
 * to ensure the user has a working Gmail connection.
 *
 * Response:
 * - valid: boolean - whether the connection is valid
 * - email: string | null - the connected Gmail address
 * - permissionLevel: string | null - SEND_ONLY or FULL_ACCESS
 * - error: string | null - error message if invalid
 */
export async function GET() {
    console.log("[Gmail Validate] Request received");

    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
        return NextResponse.json({
            valid: false,
            email: null,
            permissionLevel: null,
            error: "Not authenticated"
        }, { status: 401 });
    }

    const userId = (session.user as any).id;

    try {
        // Check if Gmail is connected
        const isConnected = await gmailClient.isConnected(userId);

        if (!isConnected) {
            return NextResponse.json({
                valid: false,
                email: null,
                permissionLevel: null,
                error: "Gmail not connected. Please connect your Gmail account in Settings."
            });
        }

        // Try to get a valid access token (this will refresh if needed)
        try {
            await gmailClient.getValidAccessToken(userId);
        } catch (tokenError: any) {
            console.error("[Gmail Validate] Token validation failed:", tokenError);
            return NextResponse.json({
                valid: false,
                email: null,
                permissionLevel: null,
                error: tokenError.message || "Gmail token expired. Please reconnect your Gmail account."
            });
        }

        // Get connected email
        const email = await gmailClient.getConnectedEmail(userId);

        // Get permission level from database
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: user } = await supabaseAdmin
            .from('users')
            .select('gmail_permission_level')
            .eq('id', userId)
            .single();

        console.log("[Gmail Validate] Validation successful for user:", userId);

        return NextResponse.json({
            valid: true,
            email,
            permissionLevel: user?.gmail_permission_level || null,
            error: null
        });

    } catch (error: any) {
        console.error("[Gmail Validate] Unexpected error:", error);
        return NextResponse.json({
            valid: false,
            email: null,
            permissionLevel: null,
            error: error.message || "Failed to validate Gmail connection"
        });
    }
}
