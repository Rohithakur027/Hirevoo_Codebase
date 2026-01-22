import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { gmailClient } from "@/lib/gmail/client";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const url = gmailClient.generateAuthUrl(session.user.id);
        return NextResponse.json({ url });
    } catch (error) {
        console.error("Error generating Auth URL:", error);
        return NextResponse.json(
            { error: "Failed to generate connection URL" },
            { status: 500 }
        );
    }
}