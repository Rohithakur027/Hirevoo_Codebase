/**
 * workers/jobs/send-campaign.ts
 *
 * Purpose: Core business logic for processing email campaigns
 *
 * This is the heart of the background worker system. When a job is picked
 * up from the queue, this function handles:
 * - Fetching pending emails from the database
 * - Sending each email via Gmail API
 * - Updating database records (per email and campaign-level)
 * - Publishing real-time progress updates via Redis Pub/Sub
 * - Creating activity records for audit trail
 * - Comprehensive error handling and recovery
 *
 * Key Design Decisions:
 * 1. IDEMPOTENT: Safe to retry - only processes emails with status='pending'
 * 2. RESILIENT: Individual email failures don't stop the campaign
 * 3. OBSERVABLE: Every step publishes events for real-time monitoring
 * 4. EFFICIENT: Processes in batches to manage memory for large campaigns
 *
 * Flow:
 * ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 * │ Fetch        │ → │ Send Each    │ → │ Update       │
 * │ Pending      │    │ Email via    │    │ Database &   │
 * │ Emails       │    │ Gmail API    │    │ Publish      │
 * └──────────────┘    └──────────────┘    └──────────────┘
 *
 * @module workers/jobs/send-campaign
 */

import { Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, delay } from '../../lib/services/email-service';
import { createRedisConnection } from '../../lib/queue/config';
import type { SendCampaignJobData, SendCampaignJobResult } from '../../lib/queue/email-queue';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Structure of a pending email from campaign_contacts table.
 */
interface PendingEmail {
  id: string;
  campaign_id: string;
  contact_id: string;
  recipient_email: string;
  recipient_name: string | null;
  email_subject: string;
  email_body: string;
  status: string;
}

/**
 * Progress data published to Redis Pub/Sub.
 */
interface ProgressEvent {
  userId: string;
  campaignId: string;
  emailId: string;
  recipientEmail: string;
  progress: number;
  sent: number;
  failed: number;
  total: number;
  timestamp: string;
}

/**
 * Campaign completion event published to Redis Pub/Sub.
 */
interface CampaignCompleteEvent {
  userId: string;
  campaignId: string;
  totalSent: number;
  totalFailed: number;
  duration: number; // seconds
  timestamp: string;
}

/**
 * Email failure event published to Redis Pub/Sub.
 */
interface EmailFailedEvent {
  userId: string;
  campaignId: string;
  emailId: string;
  recipientEmail: string;
  error: string;
  errorCode: string;
  timestamp: string;
}

// ============================================================
// DATABASE CLIENT
// ============================================================

/**
 * Supabase client for database operations.
 *
 * Uses service role key to bypass RLS (Row Level Security) since
 * the worker runs server-side and needs full access.
 */
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// ============================================================
// REDIS PUB/SUB CLIENT
// ============================================================

/**
 * Dedicated Redis connection for publishing events.
 *
 * We use a separate connection because:
 * 1. The main connection is used by BullMQ for job management
 * 2. Publishing is a non-blocking operation that shouldn't interfere
 */
const publisherRedis = createRedisConnection('worker-publisher');

// ============================================================
// MAIN PROCESSING FUNCTION
// ============================================================

/**
 * Processes a campaign send job.
 *
 * This is the main entry point called by the BullMQ worker.
 * It orchestrates the entire email sending flow for a campaign.
 *
 * @param job - BullMQ job containing campaignId and userId
 * @returns Summary of processed emails (success/failure counts)
 *
 * @example
 * // Called by BullMQ Worker
 * const result = await processCampaign(job);
 * // Returns: { totalProcessed: 100, successCount: 97, failureCount: 3, ... }
 */
export async function processCampaign(
  job: Job<SendCampaignJobData, SendCampaignJobResult>
): Promise<SendCampaignJobResult> {
  // ─────────────────────────────────────────────────────────
  // STEP 1: INITIALIZATION
  // ─────────────────────────────────────────────────────────

  const startTime = Date.now();
  const { campaignId, userId } = job.data;

  // Create a consistent log prefix for all messages from this job
  const logPrefix = `[Job:${job.id}][Campaign:${campaignId.substring(0, 8)}]`;

  console.log(
    `\n${'='.repeat(60)}\n` +
      `${logPrefix} 🚀 Starting campaign processing\n` +
      `${'='.repeat(60)}`
  );
  console.log(`${logPrefix} User: ${userId}`);
  console.log(`${logPrefix} Job ID: ${job.id}`);
  console.log(`${logPrefix} Attempt: ${job.attemptsMade + 1}/${job.opts.attempts || 3}`);
  console.log(`${logPrefix} Started at: ${new Date().toISOString()}`);

  // Initialize counters for tracking progress
  let sentCount = 0;
  let failedCount = 0;
  let processedCount = 0;

  try {
    // ─────────────────────────────────────────────────────────
    // STEP 2: FETCH PENDING EMAILS
    // ─────────────────────────────────────────────────────────
    // Only fetch emails that haven't been sent yet.
    // This makes the job idempotent - safe to retry without duplicates.

    console.log(`${logPrefix} Fetching pending emails from database...`);

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('campaign_contacts')
      .select('id, campaign_id, contact_id, recipient_email, recipient_name, email_subject, email_body, status')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error(`${logPrefix} ❌ Failed to fetch emails:`, fetchError);
      throw new Error(`Database error: ${fetchError.message}`);
    }

    const totalEmails = pendingEmails?.length || 0;

    // Handle case: no pending emails
    if (totalEmails === 0) {
      console.log(`${logPrefix} ℹ️ No pending emails found. Campaign may already be complete.`);

      // Update campaign status to 'sent' if it was 'sending'
      await updateCampaignStatus(campaignId, 'sent', logPrefix);

      return {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };
    }

    console.log(`${logPrefix} 📧 Found ${totalEmails} pending emails to send`);

    // ─────────────────────────────────────────────────────────
    // STEP 3: UPDATE CAMPAIGN STATUS TO 'SENDING'
    // ─────────────────────────────────────────────────────────

    await updateCampaignStatus(campaignId, 'sending', logPrefix);

    // ─────────────────────────────────────────────────────────
    // STEP 4: PROCESS EACH EMAIL
    // ─────────────────────────────────────────────────────────
    // We process emails sequentially to:
    // 1. Respect Gmail rate limits (~5 emails/second)
    // 2. Update progress after each email
    // 3. Handle errors individually without affecting other emails

    console.log(`${logPrefix} Starting email send loop...`);

    for (let emailIndex = 0; emailIndex < totalEmails; emailIndex++) {
      const email = pendingEmails[emailIndex] as PendingEmail;
      const emailLogPrefix = `${logPrefix}[${emailIndex + 1}/${totalEmails}]`;

      console.log(
        `${emailLogPrefix} Processing: ${email.recipient_email} ` +
          `(ID: ${email.id.substring(0, 8)})`
      );

      try {
        // ─────────────────────────────────────────────────────
        // STEP 4a: SEND EMAIL VIA GMAIL API
        // ─────────────────────────────────────────────────────

        const sendResult = await sendEmail({
          to: email.recipient_email,
          toName: email.recipient_name || undefined,
          subject: email.email_subject,
          body: email.email_body,
          userId,
        });

        if (sendResult.success) {
          // ───────────────────────────────────────────────────
          // STEP 4b: EMAIL SENT SUCCESSFULLY
          // ───────────────────────────────────────────────────

          console.log(
            `${emailLogPrefix} ✅ Sent to ${email.recipient_email} ` +
              `(Message ID: ${sendResult.messageId})`
          );

          // Update database: mark as sent
          await updateEmailStatus(
            email.id,
            'sent',
            sendResult.messageId,
            null,
            emailLogPrefix
          );

          // Increment success counter
          sentCount++;

          // Create activity record
          await createActivity(
            userId,
            campaignId,
            'email_sent',
            `Email sent to ${email.recipient_email}`,
            `Subject: ${email.email_subject.substring(0, 50)}...`,
            emailLogPrefix
          );

          // Publish success event to Redis Pub/Sub
          await publishEmailSentEvent({
            userId,
            campaignId,
            emailId: email.id,
            recipientEmail: email.recipient_email,
            progress: Math.round(((emailIndex + 1) / totalEmails) * 100),
            sent: sentCount,
            failed: failedCount,
            total: totalEmails,
            timestamp: new Date().toISOString(),
          });
        } else {
          // ───────────────────────────────────────────────────
          // STEP 4c: EMAIL SEND FAILED
          // ───────────────────────────────────────────────────

          console.error(
            `${emailLogPrefix} ❌ Failed to send to ${email.recipient_email}: ` +
              `${sendResult.errorCode} - ${sendResult.errorMessage}`
          );

          // Update database: mark as failed
          await updateEmailStatus(
            email.id,
            'failed',
            null,
            sendResult.errorMessage,
            emailLogPrefix
          );

          // Increment failure counter
          failedCount++;

          // Create failure activity
          await createActivity(
            userId,
            campaignId,
            'email_failed',
            `Failed to send to ${email.recipient_email}`,
            sendResult.errorMessage,
            emailLogPrefix
          );

          // Publish failure event to Redis Pub/Sub
          await publishEmailFailedEvent({
            userId,
            campaignId,
            emailId: email.id,
            recipientEmail: email.recipient_email,
            error: sendResult.errorMessage,
            errorCode: sendResult.errorCode,
            timestamp: new Date().toISOString(),
          });

          // IMPORTANT: We continue to the next email instead of failing
          // the entire job. This ensures one bad email doesn't stop
          // the whole campaign.
        }
      } catch (unexpectedError) {
        // ─────────────────────────────────────────────────────
        // STEP 4d: HANDLE UNEXPECTED ERRORS
        // ─────────────────────────────────────────────────────
        // This catches errors not handled by sendEmail() itself,
        // such as network issues during the call.

        const errorMessage =
          unexpectedError instanceof Error
            ? unexpectedError.message
            : 'Unknown error';

        console.error(
          `${emailLogPrefix} ⚠️ Unexpected error sending to ` +
            `${email.recipient_email}:`,
          unexpectedError
        );

        // Update database: mark as failed
        await updateEmailStatus(
          email.id,
          'failed',
          null,
          `Unexpected error: ${errorMessage}`,
          emailLogPrefix
        );

        failedCount++;

        // Continue to next email
      }

      // ─────────────────────────────────────────────────────────
      // STEP 4e: UPDATE JOB PROGRESS
      // ─────────────────────────────────────────────────────────
      // BullMQ tracks job progress, which can be retrieved via the
      // queue API for showing in dashboards.

      processedCount++;
      const progressPercentage = Math.round((processedCount / totalEmails) * 100);

      await job.updateProgress({
        percentage: progressPercentage,
        sent: sentCount,
        failed: failedCount,
        total: totalEmails,
      });

      // ─────────────────────────────────────────────────────────
      // STEP 4f: RATE LIMITING DELAY
      // ─────────────────────────────────────────────────────────
      // Gmail allows ~5 emails/second. Adding a 200ms delay between
      // emails keeps us safely under this limit.
      //
      // Don't delay after the last email (unnecessary wait).

      if (emailIndex < totalEmails - 1) {
        await delay(200);
      }
    }

    // ─────────────────────────────────────────────────────────
    // STEP 5: FINALIZATION
    // ─────────────────────────────────────────────────────────

    const durationMs = Date.now() - startTime;
    const durationSeconds = Math.round(durationMs / 1000);

    console.log(
      `\n${logPrefix} 🎉 Campaign processing complete!\n` +
        `${'─'.repeat(40)}\n` +
        `   Total Processed: ${processedCount}\n` +
        `   Successful: ${sentCount} ✅\n` +
        `   Failed: ${failedCount} ❌\n` +
        `   Duration: ${durationSeconds} seconds\n` +
        `${'─'.repeat(40)}`
    );

    // Update campaign status to 'sent'
    const finalStatus = failedCount === totalEmails ? 'failed' : 'sent';
    await updateCampaignStatus(campaignId, finalStatus, logPrefix);

    // Create campaign completion activity
    await createActivity(
      userId,
      campaignId,
      'campaign_complete',
      'Campaign sending completed',
      `Sent ${sentCount} of ${totalEmails} emails (${failedCount} failed) in ${durationSeconds}s`,
      logPrefix
    );

    // Publish campaign complete event
    await publishCampaignCompleteEvent({
      userId,
      campaignId,
      totalSent: sentCount,
      totalFailed: failedCount,
      duration: durationSeconds,
      timestamp: new Date().toISOString(),
    });

    // Return job result (stored by BullMQ)
    return {
      totalProcessed: processedCount,
      successCount: sentCount,
      failureCount: failedCount,
      durationMs,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    // ─────────────────────────────────────────────────────────
    // JOB-LEVEL ERROR HANDLING
    // ─────────────────────────────────────────────────────────
    // If we reach here, something went wrong at the job level
    // (not individual emails). This triggers BullMQ retry.

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(
      `${logPrefix} 💥 Job failed with error: ${errorMessage}`,
      error
    );

    // Update campaign status to indicate failure
    await updateCampaignStatus(campaignId, 'failed', logPrefix);

    // Re-throw to trigger BullMQ retry
    throw error;
  }
}

// ============================================================
// DATABASE HELPER FUNCTIONS
// ============================================================

/**
 * Updates the status of a campaign.
 *
 * @param campaignId - UUID of the campaign
 * @param status - New status ('draft' | 'sending' | 'sent' | 'failed')
 * @param logPrefix - Log prefix for consistent logging
 */
async function updateCampaignStatus(
  campaignId: string,
  status: string,
  logPrefix: string
): Promise<void> {
  console.log(`${logPrefix} Updating campaign status to: ${status}`);

  const updateData: Record<string, unknown> = { status };

  // Set sent_at timestamp when campaign completes
  if (status === 'sent') {
    updateData.sent_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('campaigns')
    .update(updateData)
    .eq('id', campaignId);

  if (error) {
    console.error(
      `${logPrefix} ⚠️ Failed to update campaign status:`,
      error
    );
    // Don't throw - status update failure shouldn't stop processing
  }
}

/**
 * Updates the status of an individual email.
 *
 * @param emailId - UUID of the campaign_contact record
 * @param status - New status ('sent' | 'failed')
 * @param gmailMessageId - Gmail message ID (if sent successfully)
 * @param errorMessage - Error message (if failed)
 * @param logPrefix - Log prefix for consistent logging
 */
async function updateEmailStatus(
  emailId: string,
  status: 'sent' | 'failed',
  gmailMessageId: string | null,
  errorMessage: string | null,
  logPrefix: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    error_message: errorMessage,
    // Store Gmail message ID for tracking (if you have this column)
    // gmail_message_id: gmailMessageId,
  };

  const { error } = await supabase
    .from('campaign_contacts')
    .update(updateData)
    .eq('id', emailId);

  if (error) {
    console.error(
      `${logPrefix} ⚠️ Failed to update email status for ${emailId}:`,
      error
    );
    // Don't throw - status update failure shouldn't stop processing
  }
}

/**
 * Creates an activity record for audit trail.
 *
 * Activities provide a history of what happened, useful for:
 * 1. User-facing activity feed
 * 2. Debugging issues
 * 3. Analytics
 *
 * @param userId - UUID of the user
 * @param campaignId - UUID of the campaign
 * @param type - Activity type
 * @param title - Short description
 * @param description - Detailed description
 * @param logPrefix - Log prefix for consistent logging
 */
async function createActivity(
  userId: string,
  campaignId: string,
  type: 'email_sent' | 'email_failed' | 'campaign_complete',
  title: string,
  description: string,
  logPrefix: string
): Promise<void> {
  const { error } = await supabase.from('activities').insert({
    user_id: userId,
    campaign_id: campaignId,
    type,
    title,
    description,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Log but don't fail - activities are nice-to-have, not critical
    console.warn(
      `${logPrefix} ⚠️ Failed to create activity:`,
      error.message
    );
  }
}

// ============================================================
// REDIS PUB/SUB PUBLISHING FUNCTIONS
// ============================================================

/**
 * Publishes an email sent event to Redis Pub/Sub.
 *
 * The Socket.IO server in the Next.js process subscribes to this
 * channel and broadcasts to connected clients for real-time updates.
 *
 * @param event - Event data to publish
 */
async function publishEmailSentEvent(event: ProgressEvent): Promise<void> {
  try {
    await publisherRedis.publish('email:sent', JSON.stringify(event));
  } catch (error) {
    console.warn('[PubSub] Failed to publish email:sent event:', error);
    // Don't throw - pub/sub failure shouldn't stop email processing
  }
}

/**
 * Publishes an email failed event to Redis Pub/Sub.
 *
 * @param event - Event data to publish
 */
async function publishEmailFailedEvent(event: EmailFailedEvent): Promise<void> {
  try {
    await publisherRedis.publish('email:failed', JSON.stringify(event));
  } catch (error) {
    console.warn('[PubSub] Failed to publish email:failed event:', error);
  }
}

/**
 * Publishes a campaign complete event to Redis Pub/Sub.
 *
 * @param event - Event data to publish
 */
async function publishCampaignCompleteEvent(
  event: CampaignCompleteEvent
): Promise<void> {
  try {
    await publisherRedis.publish('campaign:complete', JSON.stringify(event));
  } catch (error) {
    console.warn('[PubSub] Failed to publish campaign:complete event:', error);
  }
}

// ============================================================
// BATCH PROCESSING FOR LARGE CAMPAIGNS
// ============================================================

/**
 * Batch size for processing large campaigns.
 *
 * When campaigns have thousands of emails, we fetch and process
 * in batches to avoid memory issues and allow for checkpointing.
 */
const BATCH_SIZE = 100;

/**
 * Processes a large campaign in batches.
 *
 * This is an alternative to the main processCampaign function
 * for campaigns with > 500 emails. It processes in batches
 * to manage memory and provide more granular progress updates.
 *
 * @param job - BullMQ job containing campaignId and userId
 * @returns Summary of processed emails
 */
export async function processCampaignInBatches(
  job: Job<SendCampaignJobData, SendCampaignJobResult>
): Promise<SendCampaignJobResult> {
  const startTime = Date.now();
  const { campaignId, userId } = job.data;
  const logPrefix = `[Job:${job.id}][Campaign:${campaignId.substring(0, 8)}]`;

  console.log(`${logPrefix} Processing large campaign in batches of ${BATCH_SIZE}`);

  let sentCount = 0;
  let failedCount = 0;
  let processedCount = 0;
  let offset = 0;
  let hasMore = true;

  // Get total count first
  const { count: totalEmails } = await supabase
    .from('campaign_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');

  if (!totalEmails || totalEmails === 0) {
    console.log(`${logPrefix} No pending emails found`);
    return {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      durationMs: Date.now() - startTime,
      completedAt: new Date().toISOString(),
    };
  }

  console.log(`${logPrefix} Total pending emails: ${totalEmails}`);
  await updateCampaignStatus(campaignId, 'sending', logPrefix);

  while (hasMore) {
    console.log(
      `${logPrefix} Fetching batch at offset ${offset} (${BATCH_SIZE} emails)`
    );

    const { data: batch, error } = await supabase
      .from('campaign_contacts')
      .select('id, campaign_id, contact_id, recipient_email, recipient_name, email_subject, email_body, status')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`${logPrefix} Failed to fetch batch:`, error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!batch || batch.length === 0) {
      hasMore = false;
      break;
    }

    // Process this batch
    for (const email of batch as PendingEmail[]) {
      const emailLogPrefix = `${logPrefix}[${processedCount + 1}/${totalEmails}]`;

      try {
        const sendResult = await sendEmail({
          to: email.recipient_email,
          toName: email.recipient_name || undefined,
          subject: email.email_subject,
          body: email.email_body,
          userId,
        });

        if (sendResult.success) {
          await updateEmailStatus(email.id, 'sent', sendResult.messageId, null, emailLogPrefix);
          sentCount++;

          await publishEmailSentEvent({
            userId,
            campaignId,
            emailId: email.id,
            recipientEmail: email.recipient_email,
            progress: Math.round(((processedCount + 1) / totalEmails) * 100),
            sent: sentCount,
            failed: failedCount,
            total: totalEmails,
            timestamp: new Date().toISOString(),
          });
        } else {
          await updateEmailStatus(email.id, 'failed', null, sendResult.errorMessage, emailLogPrefix);
          failedCount++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await updateEmailStatus(email.id, 'failed', null, errorMsg, emailLogPrefix);
        failedCount++;
      }

      processedCount++;
      await job.updateProgress({
        percentage: Math.round((processedCount / totalEmails) * 100),
        sent: sentCount,
        failed: failedCount,
        total: totalEmails,
      });

      // Rate limiting
      await delay(200);
    }

    // Move to next batch
    offset += BATCH_SIZE;

    // Check if there might be more
    if (batch.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  const durationMs = Date.now() - startTime;
  const finalStatus = failedCount === totalEmails ? 'failed' : 'sent';

  await updateCampaignStatus(campaignId, finalStatus, logPrefix);
  await publishCampaignCompleteEvent({
    userId,
    campaignId,
    totalSent: sentCount,
    totalFailed: failedCount,
    duration: Math.round(durationMs / 1000),
    timestamp: new Date().toISOString(),
  });

  console.log(
    `${logPrefix} Batch processing complete: ` +
      `${sentCount} sent, ${failedCount} failed in ${Math.round(durationMs / 1000)}s`
  );

  return {
    totalProcessed: processedCount,
    successCount: sentCount,
    failureCount: failedCount,
    durationMs,
    completedAt: new Date().toISOString(),
  };
}
