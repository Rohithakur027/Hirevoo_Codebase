import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth';
import { gmailClient } from '@/lib/gmail/client';
import { getUTCTimeISO } from '@/lib/date-helpers';
import { appendTrackingPixel } from '@/lib/tracking';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Converts plain text to basic HTML for email sending.
 */
function plainTextToHtml(text: string): string {
    if (!text) return '';

    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const htmlBody = escaped.replace(/\n/g, '<br>');

    return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${htmlBody}</div>`;
}

/**
 * POST /api/campaign/send
 *
 * Sends a single email using the authenticated user's Gmail account.
 * Uses stateless token architecture: decrypt refresh token → get ephemeral access token → send.
 *
 * Request body:
 * - to: string (recipient email)
 * - subject: string
 * - htmlContent: string (HTML body)
 * - campaignId?: string (optional, for logging to campaign_emails)
 * - contactId?: string (optional, for activity logging)
 */
export async function POST(req: Request) {
    try {
        // 1. Authenticate the user
        const session = await getServerSession(authOptions);

        if (!session?.user?.email || !(session.user as any).id) {
            return NextResponse.json(
                { success: false, error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const userId = (session.user as any).id;

        // 2. Parse and validate request body
        const { to, subject, htmlContent, campaignId, contactId } = await req.json();

        if (!to || !subject || !htmlContent) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: to, subject, htmlContent' },
                { status: 400 }
            );
        }

        // 3. Verify Gmail is connected
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('gmail_connected')
            .eq('id', userId)
            .single();

        if (userError || !user?.gmail_connected) {
            return NextResponse.json(
                { success: false, error: 'Gmail not connected. Please connect your Gmail account in Settings.' },
                { status: 400 }
            );
        }

        // 4. Convert plain text to HTML for email sending
        let emailHtml = plainTextToHtml(htmlContent);

        // 4b. Append tracking pixel if this is a campaign email
        // Require campaign_contacts.id for the pixel URL
        if (campaignId && contactId) {
            const { data: cc } = await supabase
                .from('campaign_contacts')
                .select('id')
                .eq('campaign_id', campaignId)
                .eq('contact_id', contactId)
                .maybeSingle();

            if (cc) {
                emailHtml = appendTrackingPixel(emailHtml, cc.id);
            }
        }

        // 5. Send email via GmailClient (handles decrypt → refresh → send)
        const result = await gmailClient.sendEmail(userId, {
            to,
            subject,
            body: emailHtml,
        });

        if (!result.success) {
            console.error('[Campaign Send] Email send failed:', result.errorMessage);
            return NextResponse.json(
                { success: false, error: result.errorMessage, code: result.errorCode },
                { status: result.errorCode === 'INVALID_RECIPIENT' ? 400 : 500 }
            );
        }

        // 5. Post-send logging
        // Log to campaign_emails if campaignId is provided
        if (campaignId) {
            const { error: emailLogError } = await supabase
                .from('campaign_emails')
                .insert({
                    campaign_id: campaignId,
                    contact_id: contactId || null,
                    user_id: userId,
                    gmail_message_id: result.messageId,
                    gmail_thread_id: result.threadId,
                    status: 'sent',
                    sent_at: getUTCTimeISO(),
                });

            if (emailLogError) {
                console.error('[Campaign Send] Failed to log to campaign_emails:', emailLogError);
                // Non-fatal: email was still sent successfully
            }
        }

        // Log activity
        const { error: activityError } = await supabase
            .from('activities')
            .insert({
                user_id: userId,
                campaign_id: campaignId || null,
                contact_id: contactId || null,
                type: 'sent',
                title: 'Email sent',
                description: `Email sent to ${to}: "${subject}"`,
            });

        if (activityError) {
            console.error('[Campaign Send] Failed to log activity:', activityError);
            // Non-fatal: email was still sent successfully
        }

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
            threadId: result.threadId,
        });

    } catch (error: any) {
        console.error('[Campaign Send] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
