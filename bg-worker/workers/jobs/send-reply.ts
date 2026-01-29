/**
 * Job processor for sending email replies.
 * Handles sending "Re: <Subject>" emails and logging them to chat history.
 *
 * @module workers/jobs/send-reply
 */

import { Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../../lib/services/email-service';
import type { SendReplyJobData } from '../../lib/queue/email-queue';
import { appendTrackingPixel } from '../../lib/tracking';

// ============================================================
// DATABASE CLIENT
// ============================================================

import { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (!supabaseInstance) {
        supabaseInstance = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
        );
    }
    return supabaseInstance;
}

// ============================================================
// MAIN PROCESSOR
// ============================================================

export async function processReply(
    job: Job<SendReplyJobData>
): Promise<any> {
    const { campaignContactId, message, userId } = job.data;
    const logPrefix = `[ReplyJob:${job.id}]`;

    console.log(`${logPrefix} Starting reply processing for contact ${campaignContactId}`);

    try {
        // 1. Fetch Contact & Original Email Details
        const { data: contactData, error: fetchError } = await getSupabase()
            .from('campaign_contacts')
            .select(`
        id,
        campaign_id,
        contact_id,
        email_subject,
        contacts!inner (email, name)
      `)
            .eq('id', campaignContactId)
            .single();

        if (fetchError || !contactData) {
            throw new Error(`Failed to fetch contact data: ${fetchError?.message || 'Contact not found'}`);
        }

        const contact = Array.isArray(contactData.contacts) ? contactData.contacts[0] : contactData.contacts;
        const recipientEmail = contact.email;
        const recipientName = contact.name;
        const originalSubject = contactData.email_subject || 'No Subject';
        const replySubject = originalSubject.startsWith('Re:')
            ? originalSubject
            : `Re: ${originalSubject}`;

        // 2. Prepare Email Body (Convert newlines to HTML br)
        const htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">${message.replace(/\n/g, '<br>')}</div>`;

        // Append tracking pixel
        // We reuse the campaign_contact_id for tracking open events on this reply too
        const htmlWithTracking = appendTrackingPixel(htmlBody, campaignContactId);

        // 3. Send Email
        console.log(`${logPrefix} Sending email to ${recipientEmail}`);

        const sendResult = await sendEmail({
            to: recipientEmail,
            toName: recipientName || undefined,
            subject: replySubject,
            body: htmlWithTracking,
            userId,
        });

        if (!sendResult.success) {
            throw new Error(`Failed to send email: ${sendResult.errorMessage}`);
        }

        console.log(`${logPrefix} ✅ Email sent successfully. MessageID: ${sendResult.messageId}`);

        // 4. Log to Chat History (chat_messages)
        // This allows the UI to show the message immediately as "Sent" history
        const { error: chatError } = await getSupabase()
            .from('chat_messages')
            .insert({
                campaign_contact_id: campaignContactId,
                direction: 'outbound',
                body_text: message,
                gmail_message_id: sendResult.messageId,
                gmail_thread_id: sendResult.threadId,
                created_at: new Date().toISOString()
            });

        if (chatError) {
            console.error(`${logPrefix} ⚠️ Failed to insert chat_message:`, chatError);
        }

        // 5. Log to Audit Log (campaign_emails) 
        // Keeps a record of all emails sent for a campaign
        const { error: logError } = await getSupabase()
            .from('campaign_emails')
            .insert({
                campaign_id: contactData.campaign_id,
                contact_id: contactData.contact_id,
                email_subject: replySubject,
                email_body: message, // Store plain text
                status: 'sent',
                sent_at: new Date().toISOString(),
                gmail_message_id: sendResult.messageId,
                gmail_thread_id: sendResult.threadId,
            });

        if (logError) {
            console.error(`${logPrefix} ⚠️ Failed to insert campaign_email log:`, logError);
        }

        // 6. Create Activity Feed Item
        const { error: activityError } = await getSupabase()
            .from('activities')
            .insert({
                user_id: userId,
                campaign_id: contactData.campaign_id,
                type: 'email_sent',
                title: 'Replied to candidate',
                description: `Replied to ${recipientEmail}: "${message.substring(0, 50)}..."`,
                metadata: {
                    campaign_contact_id: campaignContactId,
                    email_subject: replySubject
                }
            });

        if (activityError) {
            console.error(`${logPrefix} ⚠️ Failed to create activity:`, activityError);
        }

        return { success: true, messageId: sendResult.messageId };

    } catch (error: any) {
        console.error(`${logPrefix} ❌ Job failed:`, error);
        throw error;
    }
}
