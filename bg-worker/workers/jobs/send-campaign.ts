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
  email_subject: string;
  email_body: string;
  status: string;
  contacts: {
    email: string;
    name: string | null;
  };
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
// REDIS COMMAND OPTIMIZATION SETTINGS
// ============================================================

/**
 * Batch size for progress updates to reduce Redis commands.
 * Instead of updating progress after every email, we batch updates.
 */
const PROGRESS_UPDATE_INTERVAL = 10; // Update progress every N emails

/**
 * Batch size for Pub/Sub events to reduce Redis commands.
 * Instead of publishing after every email, we batch publish.
 */
const PUBSUB_BATCH_INTERVAL = 5; // Publish event every N emails

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
    console.log(`${logPrefix} Query: campaign_id=${campaignId}, status=pending`);

    const fetchStartTime = Date.now();
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('campaign_contacts')
      .select(`
        id,
        campaign_id,
        contact_id,
        email_subject,
        email_body,
        status,
        contacts!inner(email, name)
      `)
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    const fetchDuration = Date.now() - fetchStartTime;
    console.log(`${logPrefix} Database query completed in ${fetchDuration}ms`);

    if (fetchError) {
      console.error(`${logPrefix} ❌ Failed to fetch emails:`, {
        error: fetchError,
        code: fetchError.code,
        details: fetchError.details,
        hint: fetchError.hint,
        campaignId,
        queryTime: fetchDuration
      });
      throw new Error(`Database error: ${fetchError.message}`);
    }

    console.log(`${logPrefix} Query successful: found ${pendingEmails?.length || 0} emails`);

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
        `${emailLogPrefix} Processing: ${email.contacts.email} ` +
          `(ID: ${email.id.substring(0, 8)})`
      );

      try {
        // ─────────────────────────────────────────────────────
        // STEP 4a: SEND EMAIL VIA GMAIL API
        // ─────────────────────────────────────────────────────

        console.log(`${emailLogPrefix} 📤 Starting email send attempt...`);
        console.log(`${emailLogPrefix} Email details: to=${email.contacts.email}, subject="${email.email_subject.substring(0, 50)}..."`);
        console.log(`${emailLogPrefix} Email body length: ${email.email_body.length} characters`);

        const emailSendStartTime = Date.now();
        const sendResult = await sendEmail({
          to: email.contacts.email,
          toName: email.contacts.name || undefined,
          subject: email.email_subject,
          body: email.email_body,
          userId,
        });

        const emailSendDuration = Date.now() - emailSendStartTime;
        console.log(`${emailLogPrefix} Email send API call completed in ${emailSendDuration}ms`);
        console.log(`${emailLogPrefix} Send result: success=${sendResult.success}, messageId=${sendResult.messageId}, errorCode=${sendResult.errorCode}`);

        if (sendResult.success) {
          // ───────────────────────────────────────────────────
          // STEP 4b: EMAIL SENT SUCCESSFULLY
          // ───────────────────────────────────────────────────

          console.log(
            `${emailLogPrefix} ✅ Sent to ${email.contacts.email} ` +
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

          // NOTE: Activity creation removed to reduce database load
          // Activities are now only created for campaign completion and failures

          // Publish success event to Redis Pub/Sub (batched to reduce Redis commands)
          // Only publish every PUBSUB_BATCH_INTERVAL emails or on the last email
          if ((emailIndex + 1) % PUBSUB_BATCH_INTERVAL === 0 || emailIndex === totalEmails - 1) {
            await publishEmailSentEvent({
              userId,
              campaignId,
              emailId: email.id,
              recipientEmail: email.contacts.email,
              progress: Math.round(((emailIndex + 1) / totalEmails) * 100),
              sent: sentCount,
              failed: failedCount,
              total: totalEmails,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          // ───────────────────────────────────────────────────
          // STEP 4c: EMAIL SEND FAILED
          // ───────────────────────────────────────────────────

          console.error(
            `${emailLogPrefix} ❌ Failed to send to ${email.contacts.email}: ` +
              `${sendResult.errorCode} - ${sendResult.errorMessage}`
          );
          console.error(`${emailLogPrefix} Error details:`, {
            errorCode: sendResult.errorCode,
            errorMessage: sendResult.errorMessage,
            emailId: email.id,
            recipientEmail: email.contacts.email,
            campaignId: email.campaign_id,
            userId
          });

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

          // NOTE: Individual failure activities removed to reduce database load
          // Failures are tracked in campaign_contacts table and summarized at completion

          // Publish failure event to Redis Pub/Sub (always publish failures for visibility)
          await publishEmailFailedEvent({
            userId,
            campaignId,
            emailId: email.id,
            recipientEmail: email.contacts.email,
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
            `${email.contacts.email}:`,
          {
            error: unexpectedError,
            stack: unexpectedError instanceof Error ? unexpectedError.stack : undefined,
            emailId: email.id,
            recipientEmail: email.contacts.email,
            campaignId: email.campaign_id,
            userId,
            errorType: unexpectedError instanceof Error ? unexpectedError.constructor.name : typeof unexpectedError
          }
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
      // STEP 4e: UPDATE JOB PROGRESS (BATCHED)
      // ─────────────────────────────────────────────────────────
      // BullMQ tracks job progress, which can be retrieved via the
      // queue API for showing in dashboards.
      //
      // OPTIMIZATION: Only update progress every PROGRESS_UPDATE_INTERVAL
      // emails to reduce Redis commands. For 500 emails, this reduces
      // from 500 to ~50 Redis HSET commands.

      processedCount++;
      const progressPercentage = Math.round((processedCount / totalEmails) * 100);

      // Only update progress every N emails or on the last email
      if (processedCount % PROGRESS_UPDATE_INTERVAL === 0 || processedCount === totalEmails) {
        console.log(`${emailLogPrefix} 📊 Updating job progress: ${progressPercentage}% (${sentCount} sent, ${failedCount} failed, ${totalEmails} total)`);

        const progressUpdateStartTime = Date.now();
        await job.updateProgress({
          percentage: progressPercentage,
          sent: sentCount,
          failed: failedCount,
          total: totalEmails,
        });
        const progressUpdateDuration = Date.now() - progressUpdateStartTime;

        console.log(`${emailLogPrefix} ✅ Job progress updated in ${progressUpdateDuration}ms`);
      }

      // ─────────────────────────────────────────────────────────
      // STEP 4f: RATE LIMITING DELAY
      // ─────────────────────────────────────────────────────────
      // Gmail allows ~5 emails/second. Adding a 200ms delay between
      // emails keeps us safely under this limit.
      //
      // Don't delay after the last email (unnecessary wait).

      if (emailIndex < totalEmails - 1) {
        console.log(`${emailLogPrefix} ⏱️ Applying rate limiting delay (200ms) before next email`);
        const delayStartTime = Date.now();
        await delay(200);
        const actualDelay = Date.now() - delayStartTime;
        console.log(`${emailLogPrefix} ✅ Rate limiting delay completed (actual: ${actualDelay}ms)`);
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
      {
        error: error,
        stack: error instanceof Error ? error.stack : undefined,
        campaignId,
        userId,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts || 3,
        durationMs: Date.now() - startTime,
        sentCount,
        failedCount,
        processedCount
      }
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
  console.log(`${logPrefix} Update data:`, { status, sent_at: status === 'sent' ? new Date().toISOString() : null });

  const updateData: Record<string, unknown> = { status };

  // Set sent_at timestamp when campaign completes
  if (status === 'sent') {
    updateData.sent_at = new Date().toISOString();
  }

  const updateStartTime = Date.now();
  const { error } = await supabase
    .from('campaigns')
    .update(updateData)
    .eq('id', campaignId);

  const updateDuration = Date.now() - updateStartTime;
  console.log(`${logPrefix} Campaign status update completed in ${updateDuration}ms`);

  if (error) {
    console.error(
      `${logPrefix} ⚠️ Failed to update campaign status:`,
      {
        error: error,
        code: error.code,
        details: error.details,
        hint: error.hint,
        campaignId,
        status,
        updateTime: updateDuration
      }
    );
    // Don't throw - status update failure shouldn't stop processing
  } else {
    console.log(`${logPrefix} ✅ Campaign status updated successfully`);
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

  console.log(`${logPrefix} Updating email status: emailId=${emailId}, status=${status}, gmailMessageId=${gmailMessageId}`);
  if (errorMessage) {
    console.log(`${logPrefix} Error message: ${errorMessage}`);
  }

  const updateStartTime = Date.now();
  const { error } = await supabase
    .from('campaign_contacts')
    .update(updateData)
    .eq('id', emailId);

  const updateDuration = Date.now() - updateStartTime;
  console.log(`${logPrefix} Email status update completed in ${updateDuration}ms`);

  if (error) {
    console.error(
      `${logPrefix} ⚠️ Failed to update email status for ${emailId}:`,
      {
        error: error,
        code: error.code,
        details: error.details,
        hint: error.hint,
        emailId,
        status,
        gmailMessageId,
        errorMessage,
        updateTime: updateDuration
      }
    );
    // Don't throw - status update failure shouldn't stop processing
  } else {
    console.log(`${logPrefix} ✅ Email status updated successfully`);
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
  console.log(`${logPrefix} Creating activity: type=${type}, title="${title}"`);

  const activityData = {
    user_id: userId,
    campaign_id: campaignId,
    type,
    title,
    description,
    created_at: new Date().toISOString(),
  };

  const insertStartTime = Date.now();
  const { error } = await supabase.from('activities').insert(activityData);

  const insertDuration = Date.now() - insertStartTime;
  console.log(`${logPrefix} Activity insert completed in ${insertDuration}ms`);

  if (error) {
    // Log but don't fail - activities are nice-to-have, not critical
    console.warn(
      `${logPrefix} ⚠️ Failed to create activity:`,
      {
        error: error,
        code: error.code,
        details: error.details,
        hint: error.hint,
        activityData,
        insertTime: insertDuration
      }
    );
  } else {
    console.log(`${logPrefix} ✅ Activity created successfully`);
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
  console.log(`[PubSub] Publishing email:sent event for ${event.recipientEmail} (progress: ${event.progress}%)`);
  console.log(`[PubSub] Event data:`, {
    userId: event.userId,
    campaignId: event.campaignId.substring(0, 8),
    emailId: event.emailId.substring(0, 8),
    recipientEmail: event.recipientEmail,
    progress: event.progress,
    sent: event.sent,
    failed: event.failed,
    total: event.total
  });

  try {
    const publishStartTime = Date.now();
    await publisherRedis.publish('email:sent', JSON.stringify(event));
    const publishDuration = Date.now() - publishStartTime;
    console.log(`[PubSub] ✅ Published email:sent event in ${publishDuration}ms`);
  } catch (error) {
    console.error('[PubSub] ❌ Failed to publish email:sent event:', {
      error: error,
      stack: error instanceof Error ? error.stack : undefined,
      event: event,
      channel: 'email:sent'
    });
    // Don't throw - pub/sub failure shouldn't stop email processing
  }
}

/**
 * Publishes an email failed event to Redis Pub/Sub.
 *
 * @param event - Event data to publish
 */
async function publishEmailFailedEvent(event: EmailFailedEvent): Promise<void> {
  console.log(`[PubSub] Publishing email:failed event for ${event.recipientEmail} (${event.errorCode})`);
  console.log(`[PubSub] Error details:`, {
    userId: event.userId,
    campaignId: event.campaignId.substring(0, 8),
    emailId: event.emailId.substring(0, 8),
    recipientEmail: event.recipientEmail,
    error: event.error,
    errorCode: event.errorCode
  });

  try {
    const publishStartTime = Date.now();
    await publisherRedis.publish('email:failed', JSON.stringify(event));
    const publishDuration = Date.now() - publishStartTime;
    console.log(`[PubSub] ✅ Published email:failed event in ${publishDuration}ms`);
  } catch (error) {
    console.error('[PubSub] ❌ Failed to publish email:failed event:', {
      error: error,
      stack: error instanceof Error ? error.stack : undefined,
      event: event,
      channel: 'email:failed'
    });
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
  console.log(`[PubSub] Publishing campaign:complete event for campaign ${event.campaignId.substring(0, 8)}`);
  console.log(`[PubSub] Campaign summary:`, {
    userId: event.userId,
    campaignId: event.campaignId.substring(0, 8),
    totalSent: event.totalSent,
    totalFailed: event.totalFailed,
    duration: event.duration,
    completionRate: event.totalSent + event.totalFailed > 0 ? ((event.totalSent / (event.totalSent + event.totalFailed)) * 100).toFixed(1) + '%' : '0%'
  });

  try {
    const publishStartTime = Date.now();
    await publisherRedis.publish('campaign:complete', JSON.stringify(event));
    const publishDuration = Date.now() - publishStartTime;
    console.log(`[PubSub] ✅ Published campaign:complete event in ${publishDuration}ms`);
  } catch (error) {
    console.error('[PubSub] ❌ Failed to publish campaign:complete event:', {
      error: error,
      stack: error instanceof Error ? error.stack : undefined,
      event: event,
      channel: 'campaign:complete'
    });
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
  console.log(`${logPrefix} Counting total pending emails for batch processing...`);
  const countStartTime = Date.now();
  const { count: totalEmails, error: countError } = await supabase
    .from('campaign_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');

  const countDuration = Date.now() - countStartTime;
  console.log(`${logPrefix} Count query completed in ${countDuration}ms`);

  if (countError) {
    console.error(`${logPrefix} ❌ Failed to count emails:`, countError);
    throw new Error(`Database error: ${countError.message}`);
  }

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

      console.log(`${emailLogPrefix} Processing email from batch: ${email.contacts.email}`);

      try {
        console.log(`${emailLogPrefix} 📤 Starting email send attempt...`);
        console.log(`${emailLogPrefix} Email details: to=${email.contacts.email}, subject="${email.email_subject.substring(0, 50)}..."`);
        console.log(`${emailLogPrefix} Email body length: ${email.email_body.length} characters`);

        const emailSendStartTime = Date.now();
        const sendResult = await sendEmail({
          to: email.contacts.email,
          toName: email.contacts.name || undefined,
          subject: email.email_subject,
          body: email.email_body,
          userId,
        });

        const emailSendDuration = Date.now() - emailSendStartTime;
        console.log(`${emailLogPrefix} Email send API call completed in ${emailSendDuration}ms`);
        console.log(`${emailLogPrefix} Send result: success=${sendResult.success}, messageId=${sendResult.messageId}, errorCode=${sendResult.errorCode}`);

        if (sendResult.success) {
          await updateEmailStatus(email.id, 'sent', sendResult.messageId, null, emailLogPrefix);
          sentCount++;

          // Batch Pub/Sub events to reduce Redis commands
          if ((processedCount + 1) % PUBSUB_BATCH_INTERVAL === 0 || processedCount + 1 === totalEmails) {
            await publishEmailSentEvent({
              userId,
              campaignId,
              emailId: email.id,
              recipientEmail: email.contacts.email,
              progress: Math.round(((processedCount + 1) / totalEmails) * 100),
              sent: sentCount,
              failed: failedCount,
              total: totalEmails,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          console.error(`${emailLogPrefix} ❌ Failed to send to ${email.contacts.email}: ${sendResult.errorCode} - ${sendResult.errorMessage}`);
          console.error(`${emailLogPrefix} Error details:`, {
            errorCode: sendResult.errorCode,
            errorMessage: sendResult.errorMessage,
            emailId: email.id,
            recipientEmail: email.contacts.email,
            campaignId: email.campaign_id,
            userId
          });
          await updateEmailStatus(email.id, 'failed', null, sendResult.errorMessage, emailLogPrefix);
          failedCount++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${emailLogPrefix} ⚠️ Unexpected error sending to ${email.contacts.email}:`, {
          error: error,
          stack: error instanceof Error ? error.stack : undefined,
          emailId: email.id,
          recipientEmail: email.contacts.email,
          campaignId: email.campaign_id,
          userId,
          errorType: error instanceof Error ? error.constructor.name : typeof error
        });
        await updateEmailStatus(email.id, 'failed', null, errorMsg, emailLogPrefix);
        failedCount++;
      }

      processedCount++;
      const progressPercentage = Math.round((processedCount / totalEmails) * 100);

      // Batch progress updates to reduce Redis commands
      if (processedCount % PROGRESS_UPDATE_INTERVAL === 0 || processedCount === totalEmails) {
        console.log(`${emailLogPrefix} 📊 Updating batch job progress: ${progressPercentage}% (${sentCount} sent, ${failedCount} failed, ${totalEmails} total)`);

        const progressUpdateStartTime = Date.now();
        await job.updateProgress({
          percentage: progressPercentage,
          sent: sentCount,
          failed: failedCount,
          total: totalEmails,
        });
        const progressUpdateDuration = Date.now() - progressUpdateStartTime;

        console.log(`${emailLogPrefix} ✅ Batch job progress updated in ${progressUpdateDuration}ms`);
      }

      // Rate limiting
      console.log(`${emailLogPrefix} ⏱️ Applying batch rate limiting delay (200ms) before next email`);
      const delayStartTime = Date.now();
      await delay(200);
      const actualDelay = Date.now() - delayStartTime;
      console.log(`${emailLogPrefix} ✅ Batch rate limiting delay completed (actual: ${actualDelay}ms)`);
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
