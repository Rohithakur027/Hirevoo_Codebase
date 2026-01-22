import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase/supabase";

export async function POST() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { error } = await supabase
            .from('users')
            .update({
                gmail_connected: false,
                gmail_access_token: null,
                gmail_refresh_token: null,
                gmail_token_expires_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', session.user.id);

        if (error) {
            console.error("Error disconnecting Gmail:", error);
            return NextResponse.json(
                { error: "Failed to disconnect Gmail" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error disconnecting Gmail:", error);
        return NextResponse.json(
            { error: "Failed to disconnect Gmail" },
            { status: 500 }
        );
    }
}