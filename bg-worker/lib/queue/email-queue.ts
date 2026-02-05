/**
 * BullMQ configuration for the Email Queue.
 * Handles job persistence, automated retries, and concurrency management for campaign dispatch.
 *
 * Architecture Note:
 * This queue processes essentially two types of jobs: 'send-campaign' (bulk) and 'send-reply' (transactional).
 * We use exponential backoff for retries to handle transient SMTP/provider failures gracefully.
 */

import { Queue, type JobsOptions } from 'bullmq';
import { getRedis } from './config';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Data structure for campaign send jobs.
 * Minimal payload stored in Redis; worker fetches full data.
 */
export interface SendCampaignJobData {
  /** UUID of the campaign to send */
  campaignId: string;

  /** UUID of the user who owns the campaign */
  userId: string;

  /** Timestamp when the job was queued (ISO string) */
  queuedAt: string;

  /** Optional: specific email IDs to send (for partial retry) */
  emailIds?: string[];
}

/**
 * Data structure for email reply jobs.
 */
export interface SendReplyJobData {
  campaignContactId: string;
  message: string;
  userId: string;
  queuedAt: string;
}

/**
 * Result returned by the worker when a job completes.
 * This is stored in Redis and can be retrieved later.
 */
export interface SendCampaignJobResult {
  /** Total emails that were processed */
  totalProcessed: number;

  /** Number of successfully sent emails */
  successCount: number;

  /** Number of failed emails */
  failureCount: number;

  /** Job duration in milliseconds */
  durationMs: number;

  /** Timestamp when job completed (ISO string) */
  completedAt: string;
}

// ============================================================
// QUEUE CONFIGURATION
// ============================================================

/**
 * Default job options applied to all jobs in this queue.
 * Controls processing, retries, and cleanup.
 */
/**
 * Standard configuration applied to all email jobs.
 * Balances reliability (retries) with resource management (cleanup).
 */
const defaultJobOptions: JobsOptions = {
  // Retry Strategy:
  // Exponential backoff (2s -> 4s -> 8s) handles transient failures like rate limits or socket timeouts.
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },

  // Cleanup Strategy:
  // - Completed: Keep recent history (24h) for UI feedback/debugging.
  // - Failed: Keep longer history (7d) for deep-dive investigations.
  removeOnComplete: {
    age: 24 * 60 * 60, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60, // 7 days
    count: 5000,
  },
};

/**
 * Get the main email queue instance.
 * Handles all email campaign jobs.
 * Queue name: 'emails'
 */

// Singleton instance to prevent multiple Redis connections during hot reloads.
let emailQueueInstance: Queue<SendCampaignJobData, SendCampaignJobResult> | null = null;

export function getEmailQueue(): Queue<SendCampaignJobData, SendCampaignJobResult> {
  if (!emailQueueInstance) {
    emailQueueInstance = new Queue<SendCampaignJobData, SendCampaignJobResult>(
      'emails',
      {
        connection: getRedis() as any,
        defaultJobOptions,

        // Namespace keys to avoid collisions in shared Redis environments.
        prefix: 'bull:hirevoo',

        // Keep a modest event stream history for monitoring tools.
        streams: {
          events: {
            maxLen: 10000,
          },
        },
      }
    );

    // Register event listeners for debugging (only once when queue is created)
    emailQueueInstance.on('waiting', (job) => {
      console.log(`[Queue] Job ${job.id} is waiting`);
    });

    emailQueueInstance.on('error', (error) => {
      console.error('[Queue] Queue error:', error.message);
    });
  }
  return emailQueueInstance as Queue<SendCampaignJobData, SendCampaignJobResult>;
}

// NOTE: Do NOT export emailQueue at module level - it causes build errors.
// Always use getEmailQueue() function instead.

// ============================================================
// QUEUE HELPER FUNCTIONS
// ============================================================

/**
 * Queues a campaign for background email sending.
 * Performs validation, deduplication, and adds job to queue.
 *
 * @param campaignId - UUID of the campaign to send
 * @param userId - UUID of the user who owns the campaign
 * @param options - Optional configuration for this specific job
 * @returns Object containing the job ID and queue position
 * @throws {Error} If campaign is already being processed or queue is unavailable
 */
export async function queueCampaignSend(
  campaignId: string,
  userId: string,
  options?: {
    /** Priority: 1 (highest) to 10 (lowest). Default: 5 */
    priority?: number;
    /** Delay before processing (ms). Default: 0 */
    delay?: number;
    /** Specific email IDs to send (for partial retry) */
    emailIds?: string[];
  }
): Promise<{
  jobId: string;
  queuePosition: number;
}> {
  const timestamp = new Date().toISOString();
  const logPrefix = `[Queue:${timestamp}]`;

  console.log(
    `${logPrefix} Queueing campaign send - ` +
    `Campaign: ${campaignId}, User: ${userId}`
  );

  // Idempotency: Use campaignId as the deterministic Job ID.
  // This explicitly prevents double-queuing the same campaign.
  const jobId = `campaign-${campaignId}`;
  const existingJob = await getEmailQueue().getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    // Reject if the job is actively being processed or waiting.
    if (['waiting', 'delayed', 'active'].includes(state)) {
      console.warn(
        `${logPrefix} Duplicate job rejected. Job ${jobId} is currently ${state}.`
      );
      throw new Error(
        `Campaign is currently ${state}. Please wait for it to complete.`
      );
    }

    // Allow re-run if previous job is finished (completed/failed).
    console.log(`${logPrefix} Stale job found (${state}). allowing re-queue.`);
  }

  // ─────────────────────────────────────────────────────────
  // STEP 2: PREPARE JOB DATA
  // ─────────────────────────────────────────────────────────
  const jobData: SendCampaignJobData = {
    campaignId,
    userId,
    queuedAt: timestamp,
    emailIds: options?.emailIds,
  };

  // ─────────────────────────────────────────────────────────
  // STEP 3: ADD JOB TO QUEUE
  // ─────────────────────────────────────────────────────────
  const job = await getEmailQueue().add(
    'send-campaign',
    jobData,
    {
      jobId, // Enforce idempotency
      priority: options?.priority ?? 5, // 1=High, 10=Low
      delay: options?.delay ?? 0,
    }
  );

  // Return approximate position so UI can show "You are #X in line"
  const waitingCount = await getEmailQueue().getWaitingCount();

  console.log(
    `${logPrefix} ✅ Job queued successfully - ` +
    `ID: ${job.id}, Position: ~${waitingCount + 1}`
  );

  return {
    jobId: job.id!,
    queuePosition: waitingCount + 1,
  };
}

/**
 * Queues a reply to be sent.
 *
 * @param campaignContactId - ID of the campaign_contact record
 * @param message - The reply body
 * @param userId - ID of the user sending the reply
 */
export async function queueReplySend(
  campaignContactId: string,
  message: string,
  userId: string
): Promise<{ jobId: string; queuePosition: number }> {
  const timestamp = new Date().toISOString();

  // Unique ID per attempt ensures we don't accidentally dedupe legitimate rapid-fire replies
  const jobId = `reply-${campaignContactId}-${Date.now()}`;

  const jobData: SendReplyJobData = {
    campaignContactId,
    message,
    userId,
    queuedAt: timestamp
  };

  const job = await getEmailQueue().add(
    'send-reply',
    jobData as any, // Cast to any because the queue relies on the main job type generics
    {
      jobId,
      priority: 1, // High priority: Replies should feel "instant" compared to bulk campaigns
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 3600 // Keep failed replies for 24h
      }
    }
  );

  const waitingCount = await getEmailQueue().getWaitingCount();

  console.log(`[Queue] Queued reply for contact ${campaignContactId}`);

  return {
    jobId: job.id!,
    queuePosition: waitingCount + 1
  };
}

/**
 * Gets the current status of a campaign job.
 *
 * @param campaignId - UUID of the campaign
 * @returns Job status including progress, or null if not found
 */
export async function getCampaignJobStatus(campaignId: string): Promise<{
  jobId: string;
  state: string;
  progress: number;
  data: SendCampaignJobData;
  result?: SendCampaignJobResult;
  failedReason?: string;
  attemptsMade: number;
  timestamp: string;
} | null> {
  const jobId = `campaign-${campaignId}`;
  const job = await getEmailQueue().getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress =
    typeof job.progress === 'number'
      ? job.progress
      : (job.progress as { percentage?: number })?.percentage ?? 0;

  return {
    jobId: job.id!,
    state,
    progress,
    data: job.data,
    result: job.returnvalue as SendCampaignJobResult | undefined,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Cancels a pending campaign job.
 * Only cancels jobs that haven't started processing.
 *
 * @param campaignId - UUID of the campaign to cancel
 * @returns true if cancelled, false if not found or already processing
 */
export async function cancelCampaignJob(campaignId: string): Promise<boolean> {
  const jobId = `campaign-${campaignId}`;
  const job = await getEmailQueue().getJob(jobId);

  if (!job) {
    console.log(`[Queue] Cancel requested but job ${jobId} not found`);
    return false;
  }

  const state = await job.getState();

  // Safety Check: We do not interrupt active jobs to avoid inconsistent state (e.g., half-sent campaigns).
  if (state === 'active') {
    console.warn(`[Queue] Cannot cancel job ${jobId} - processed has already begun. State: ${state}`);
    return false;
  }

  // Remove the job from the queue
  await job.remove();
  console.log(`[Queue] Job ${jobId} cancelled successfully`);
  return true;
}

/**
 * Gets queue health metrics.
 *
 * @returns Queue statistics
 */
export async function getQueueHealth(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
}> {
  const queue = getEmailQueue();
  const [waiting, active, completed, failed, delayed, isPaused] =
    await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    isPaused,
  };
}

/**
 * Pauses the queue (stops processing new jobs).
 * Active jobs will complete.
 */
export async function pauseQueue(): Promise<void> {
  await getEmailQueue().pause();
  console.log('[Queue] Email queue paused');
}

/**
 * Resumes a paused queue.
 */
export async function resumeQueue(): Promise<void> {
  await getEmailQueue().resume();
  console.log('[Queue] Email queue resumed');
}

/**
 * Cleans up old jobs from the queue.
 * Run periodically to free up Redis memory.
 *
 * @param olderThanMs - Remove jobs older than this (default: 7 days)
 */
export async function cleanupOldJobs(
  olderThanMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<{
  completedRemoved: number;
  failedRemoved: number;
}> {
  const queue = getEmailQueue();
  const [completedRemoved, failedRemoved] = await Promise.all([
    queue.clean(olderThanMs, 1000, 'completed'),
    queue.clean(olderThanMs, 1000, 'failed'),
  ]);

  console.log(
    `[Queue] Cleanup complete - ` +
    `Removed ${completedRemoved.length} completed, ` +
    `${failedRemoved.length} failed jobs`
  );

  return {
    completedRemoved: completedRemoved.length,
    failedRemoved: failedRemoved.length,
  };
}

// ============================================================
// QUEUE EVENT LOGGING (for debugging)
// NOTE: Event listeners are registered lazily inside getEmailQueue()
// to avoid build-time errors. See the getEmailQueue() function.
// ============================================================
