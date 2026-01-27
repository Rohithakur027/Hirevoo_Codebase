import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { gmailClient } from "@/lib/gmail/client";

export async function POST(request: Request) {
    try {
        // Read body BEFORE getServerSession — the request body stream
        // can only be consumed once, and getServerSession may consume it.
        let permissionLevel: string | undefined;
        try {
            // Clone the request in case something else already consumed the body
            // confusingly, sometime next-auth or middleware consumes it.
            const text = await request.text();
            if (text) {
                const body = JSON.parse(text);
                permissionLevel = body?.permissionLevel;
            }
        } catch (e) {
            console.log('[Gmail Connect] No valid JSON body found, using default permission level');
        }

        // Default to FULL_ACCESS if body is missing/empty
        if (!permissionLevel) {
            permissionLevel = 'FULL_ACCESS';
        }

        const session = await getServerSession(authOptions);
        console.log('[Gmail Connect] Session:', session ? 'Found' : 'Not found');
        console.log('[Gmail Connect] Session user:', session?.user ? 'Present' : 'Missing');
        console.log('[Gmail Connect] Session user.id:', session?.user?.id);
        console.log('[Gmail Connect] Session user.email:', session?.user?.email);
        console.log('[Gmail Connect] Permission level:', permissionLevel);

        if (!session || !session.user || !session.user.email) {
            console.log('[Gmail Connect] Authorization failed - no valid session');
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Validate permission level
        if (!permissionLevel || !['SEND_ONLY', 'FULL_ACCESS'].includes(permissionLevel)) {
            return NextResponse.json(
                { error: "Invalid permission level. Must be 'SEND_ONLY' or 'FULL_ACCESS'" },
                { status: 400 }
            );
        }

        const url = gmailClient.generateAuthUrl(session.user.email, permissionLevel as any);
        return NextResponse.json({ url, permissionLevel });
    } catch (error) {
        console.error("Error generating Auth URL:", error);
        return NextResponse.json(
            { error: "Failed to generate connection URL" },
            { status: 500 }
        );
    }
}

// Keep GET method for backward compatibility (default to FULL_ACCESS)
export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const url = gmailClient.generateAuthUrl(session.user.email, 'FULL_ACCESS');
        return NextResponse.json({ url, permissionLevel: 'FULL_ACCESS' });
    } catch (error) {
        console.error("Error generating Auth URL:", error);
        return NextResponse.json(
            { error: "Failed to generate connection URL" },
            { status: 500 }
        );
    }
}
