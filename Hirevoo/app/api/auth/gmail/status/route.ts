import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase } from "@/lib/supabase/supabase";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('gmail_connected')
            .eq('id', session.user.id)
            .single();

        if (error) {
            console.error("Error fetching user status:", error);
            return NextResponse.json({ isConnected: false });
        }

        return NextResponse.json({ isConnected: !!user?.gmail_connected });
    } catch (error) {
        console.error("Error checking status:", error);
        return NextResponse.json({ isConnected: false });
    }
}