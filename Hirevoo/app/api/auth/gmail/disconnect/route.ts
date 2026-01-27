import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase/supabase";
import { decrypt } from "@/lib/encryption";
import { getUTCTimeISO } from "@/lib/date-helpers";

export async function POST() {
    console.log("[Gmail Disconnect] Starting disconnect process");

    const session = await getServerSession(authOptions);
    console.log("[Gmail Disconnect] Session:", session ? "present" : "missing");
    console.log("[Gmail Disconnect] Session user:", session?.user ? "present" : "missing");
    console.log("[Gmail Disconnect] Session user ID:", session?.user?.id);

    if (!session || !session.user || !session.user.email) {
        console.error("[Gmail Disconnect] Authorization failed - invalid session");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 1. Get current tokens from database using email instead of user ID
        console.log("[Gmail Disconnect] Fetching user tokens from database");
        console.log("[Gmail Disconnect] Querying for user email:", session.user.email);

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, gmail_refresh_token_IV, gmail_refresh_token_content, gmail_refresh_token_tag')
            .eq('email', session.user.email)
            .single();

        console.log("[Gmail Disconnect] Database query result:", {
            userFound: !!user,
            userId: user?.id,
            userEmail: user?.email,
            hasEncryptedToken: !!(user?.gmail_refresh_token_content),
            error: userError?.message,
            errorCode: userError?.code,
            errorDetails: userError?.details
        });

        if (userError || !user) {
            console.error("Error fetching user tokens:", userError);
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // 2. Revoke token at Google (if we have an encrypted token to decrypt and revoke)
        if (user.gmail_refresh_token_content && user.gmail_refresh_token_IV && user.gmail_refresh_token_tag) {
            try {
                console.log("[Gmail Disconnect] Decrypting refresh token for revocation...");

                const refreshToken = decrypt({
                    salt: user.gmail_refresh_token_IV,
                    content: user.gmail_refresh_token_content,
                    tag: user.gmail_refresh_token_tag
                });

                console.log("[Gmail Disconnect] Revoking token at Google...");

                const revokeResponse = await fetch('https://oauth2.googleapis.com/revoke', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        token: refreshToken,
                    }),
                });

                console.log("[Gmail Disconnect] Google revoke response status:", revokeResponse.status);

                if (revokeResponse.ok) {
                    console.log("[Gmail Disconnect] Token successfully revoked at Google");
                } else {
                    console.log("[Gmail Disconnect] Token revocation failed with status:", revokeResponse.status);
                    const errorText = await revokeResponse.text().catch(() => 'Unknown error');
                    console.log("[Gmail Disconnect] Revoke error:", errorText);
                }
            } catch (error) {
                console.warn("[Gmail Disconnect] Failed to revoke token at Google:", error);
            }
        } else {
            console.log("[Gmail Disconnect] No encrypted tokens found to revoke");
        }

        // 3. Clean up database regardless of Google revocation result
        console.log("[Gmail Disconnect] Cleaning up database...");

        const updateData = {
            gmail_connected: false,
            gmail_refresh_token_IV: null,
            gmail_refresh_token_content: null,
            gmail_refresh_token_tag: null,
            gmail_permission_level: null,
            updated_at: getUTCTimeISO(),
        };

        console.log("[Gmail Disconnect] Update data:", updateData);
        console.log("[Gmail Disconnect] Updating user ID:", user.id);

        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', user.id);

        console.log("[Gmail Disconnect] Database update result:", {
            success: !updateError,
            error: updateError?.message
        });

        if (updateError) {
            console.error("Error updating database:", updateError);
            return NextResponse.json(
                { error: `Database error: ${updateError.message}` },
                { status: 500 }
            );
        }

        console.log("[Gmail Disconnect] Successfully disconnected Gmail");
        return NextResponse.json({
            success: true,
            message: "Gmail disconnected successfully"
        });

    } catch (error) {
        console.error("Error disconnecting Gmail:", error);
        return NextResponse.json(
            { error: "Failed to disconnect Gmail" },
            { status: 500 }
        );
    }
}