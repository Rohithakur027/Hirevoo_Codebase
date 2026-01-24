import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gmailClient } from "@/lib/gmail/client";

/**
 * POST /api/gmail/send-test
 *
 * Sends a test email to verify Gmail integration is working correctly.
 * Sends a test email to the user's own Gmail address.
 *
 * Request body (optional):
 * - to: string - recipient email (defaults to user's own email)
 *
 * Response:
 * - success: boolean
 * - messageId: string | null - Gmail message ID if successful
 * - error: string | null - error message if failed
 */
export async function POST(request: NextRequest) {
    console.log("[Gmail Send Test] Request received");

    const session = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as any).id) {
        return NextResponse.json({
            success: false,
            messageId: null,
            error: "Not authenticated"
        }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userEmail = session.user.email;

    try {
        // Parse request body
        let recipientEmail = userEmail;
        try {
            const body = await request.json();
            if (body.to) {
                recipientEmail = body.to;
            }
        } catch {
            // No body provided, use default
        }

        // Get connected Gmail email
        const senderEmail = await gmailClient.getConnectedEmail(userId);

        if (!senderEmail) {
            return NextResponse.json({
                success: false,
                messageId: null,
                error: "Gmail not connected. Please connect your Gmail account in Settings."
            });
        }

        // Send test email
        const result = await gmailClient.sendEmail(userId, {
            to: recipientEmail!,
            subject: "Test Email from Hirevoo",
            body: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1a1a1a;">Gmail Integration Test</h2>
                    <p>This is a test email to verify your Gmail integration is working correctly.</p>
                    <p style="color: #666;">
                        <strong>Sent from:</strong> ${senderEmail}<br>
                        <strong>Sent to:</strong> ${recipientEmail}<br>
                        <strong>Time:</strong> ${new Date().toISOString()}
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #888; font-size: 12px;">
                        This email was sent from Hirevoo to test your Gmail connection.
                    </p>
                </div>
            `,
        });

        if (result.success) {
            console.log("[Gmail Send Test] Test email sent successfully:", result.messageId);
            return NextResponse.json({
                success: true,
                messageId: result.messageId,
                error: null
            });
        } else {
            console.error("[Gmail Send Test] Failed to send test email:", result.errorMessage);
            return NextResponse.json({
                success: false,
                messageId: null,
                error: result.errorMessage
            });
        }

    } catch (error: any) {
        console.error("[Gmail Send Test] Unexpected error:", error);
        return NextResponse.json({
            success: false,
            messageId: null,
            error: error.message || "Failed to send test email"
        });
    }
}
