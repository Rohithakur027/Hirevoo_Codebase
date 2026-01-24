/**
 * lib/queue/email-queue.ts
 *
 * Purpose: BullMQ queue configuration for email campaign processing
 *
 * This file creates and configures the job queue that handles asynchronous
 * email campaign processing. Jobs added here are picked up by the worker
 * process (workers/index.ts) running in a separate terminal.
 *
 * Key features:
 * - Automatic retry with exponential backoff (2s → 4s → 8s)
 * - Job deduplication (prevents sending same campaign twice)
 * - Progress tracking integration
 * - Failed job retention for debugging (7 days)
 * - Completed job cleanup (24 hours, max 1000 jobs)
 *
 * Architecture:
 * ┌─────────────────┐         ┌─────────────────┐
 * │  API Route      │ ──────► │  Redis Queue    │
 * │  (queues job)   │         │  (BullMQ)       │
 * └─────────────────┘         └────────┬────────┘
 *                                      │
 *                                      ▼
 *                             ┌─────────────────┐
 *                             │  Worker Process │
 *                             │  (picks up job) │
 *                             └─────────────────┘
 *
 * @module lib/queue/email-queue
 */

import { Queue, type JobsOptions } from 'bullmq';
import { getRedis } from './config';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Data structure for campaign send jobs.
 *
 * This interface defines the payload that gets serialized and stored
 * in Redis. Keep it minimal - only include IDs, not full objects.
 * The worker will fetch full data from the database.
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
 * Default job options applied to all jobs added to this queue.
 *
 * These settings control how jobs are processed, retried, and cleaned up.
 * Each setting is carefully chosen for production reliability.
 */
const defaultJobOptions: JobsOptions = {
  // ─────────────────────────────────────────────────────────
  // RETRY CONFIGURATION
  // ─────────────────────────────────────────────────────────
  // Number of retry attempts before marking job as failed.
  // We use 3 attempts which gives the job multiple chances to
  // succeed in case of transient errors (network issues, rate limits).
  attempts: 3,

  // Backoff strategy for retries.
  // Exponential backoff prevents overwhelming the system after failures.
  // - Attempt 1 fails → wait 2 seconds → retry
  // - Attempt 2 fails → wait 4 seconds → retry
  // - Attempt 3 fails → wait 8 seconds → final attempt
  backoff: {
    type: 'exponential',
    delay: 2000, // Base delay: 2 seconds
  },

  // ─────────────────────────────────────────────────────────
  // JOB LIFECYCLE MANAGEMENT
  // ─────────────────────────────────────────────────────────
  // How long to keep completed jobs in Redis.
  // Keeping completed jobs allows us to:
  // 1. Show job history to users
  // 2. Debug issues by examining past jobs
  // 3. Generate analytics/reports
  removeOnComplete: {
    age: 86400, // Keep for 24 hours (in seconds)
    count: 1000, // Keep max 1000 completed jobs
  },

  // How long to keep failed jobs in Redis.
  // Failed jobs are kept longer for debugging purposes.
  // You can examine failed jobs in the BullMQ dashboard or via CLI.
  removeOnFail: {
    age: 604800, // Keep for 7 days (in seconds)
    count: 5000, // Keep max 5000 failed jobs
  },

  // ─────────────────────────────────────────────────────────
  // TIMEOUT CONFIGURATION
  // ─────────────────────────────────────────────────────────
  // Maximum time a job can run before being considered stalled.
  // This prevents zombie jobs from blocking the queue forever.
  //
  // Calculation for timeout:
  // - Gmail rate limit: ~5 emails/second
  // - Max emails per campaign: ~500 (for basic plan)
  // - Processing time: 500 emails × 200ms = 100 seconds
  // - Add buffer for database operations: 10 minutes
  // - Add safety margin: 30 minutes total
  // timeout: 1800000, // 30 minutes - BullMQ Pro feature, using job-level instead
};

/**
 * Get the main email queue instance.
 *
 * This queue handles all email campaign jobs. Jobs are added by the
 * API route and processed by the worker.
 *
 * Queue name: 'emails'
 * - Used to identify this queue in Redis
 * - Multiple queues can coexist (e.g., 'emails', 'notifications', 'reports')
 */

// Lazy-loaded queue instance
let emailQueueInstance: Queue<SendCampaignJobData, SendCampaignJobResult> | null = null;

export function getEmailQueue(): Queue<SendCampaignJobData, SendCampaignJobResult> {
  if (!emailQueueInstance) {
    emailQueueInstance = new Queue<SendCampaignJobData, SendCampaignJobResult>(
      'emails',
      {
        // Use our configured Redis connection
        connection: getRedis(),

        // Apply default job options to all jobs
        defaultJobOptions,

        // ─────────────────────────────────────────────────────────
        // QUEUE-LEVEL SETTINGS
        // ─────────────────────────────────────────────────────────
        // Prefix for Redis keys. Useful when sharing Redis with other apps.
        // Keys will be: bull:hirevoo:emails:* (jobs, events, etc.)
        prefix: 'bull:hirevoo',

        // Stream configuration for job events
        streams: {
          // How long to keep job events in the stream (for monitoring)
          events: {
            maxLen: 10000, // Keep last 10,000 events
          },
        },
      }
    );
  }
  return emailQueueInstance;
}

// For backward compatibility, export the lazy-loaded instance
export const emailQueue = getEmailQueue();

// ============================================================
// QUEUE HELPER FUNCTIONS
// ============================================================

/**
 * Queues a campaign for background email sending.
 *
 * This is the main entry point called by the API route when a user
 * clicks "Send Campaign". It performs validation, deduplication,
 * and adds the job to the queue.
 *
 * @param campaignId - UUID of the campaign to send
 * @param userId - UUID of the user who owns the campaign
 * @param options - Optional configuration for this specific job
 * @returns Object containing the job ID and queue position
 *
 * @example
 * // In API route
 * const result = await queueCampaignSend(campaignId, userId);
 * return Response.json({
 *   success: true,
 *   jobId: result.jobId,
 *   message: 'Campaign queued for sending'
 * });
 *
 * @throws {Error} If campaign is already being processed
 * @throws {Error} If queue is unavailable
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

  // ─────────────────────────────────────────────────────────
  // STEP 1: CHECK FOR DUPLICATE JOBS (IDEMPOTENCY)
  // ─────────────────────────────────────────────────────────
  // Prevent queuing the same campaign multiple times.
  // This can happen if user double-clicks or refreshes during loading.
  //
  // We use campaignId as the job ID, which ensures uniqueness.
  // BullMQ will reject adding a job with an existing ID.

  const jobId = `campaign-${campaignId}`;

  // Check if this campaign already has an active job
  const existingJob = await emailQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    // If job is still active (waiting, delayed, or being processed)
    if (['waiting', 'delayed', 'active'].includes(state)) {
      console.warn(
        `${logPrefix} Campaign ${campaignId} already has active job ` +
          `(ID: ${jobId}, State: ${state}). Rejecting duplicate.`
      );

      throw new Error(
        `Campaign is already being processed. ` +
          `Current status: ${state}. Please wait for it to complete.`
      );
    }

    // If job completed or failed, we allow re-queuing
    // (e.g., user wants to retry a failed campaign)
    console.log(
      `${logPrefix} Previous job for campaign ${campaignId} found ` +
        `in state: ${state}. Allowing re-queue.`
    );
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
  const job = await emailQueue.add(
    'send-campaign', // Job name (for filtering/monitoring)
    jobData,
    {
      // Use campaignId as job ID for idempotency
      jobId,

      // Priority: lower number = higher priority
      // Default: 5 (medium priority)
      // Premium users could get priority 1-2
      priority: options?.priority ?? 5,

      // Optional delay before processing
      delay: options?.delay ?? 0,

      // Job-specific timeout override (30 minutes)
      // This is the max time the job can run
    }
  );

  // ─────────────────────────────────────────────────────────
  // STEP 4: GET QUEUE POSITION
  // ─────────────────────────────────────────────────────────
  // This gives the user an idea of when their job will be processed
  const waitingCount = await emailQueue.getWaitingCount();

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
 * Gets the current status of a campaign job.
 *
 * Use this to show progress to the user or check if a campaign
 * has been processed.
 *
 * @param campaignId - UUID of the campaign
 * @returns Job status including progress, or null if not found
 *
 * @example
 * const status = await getCampaignJobStatus(campaignId);
 * if (status?.state === 'active') {
 *   console.log(`Progress: ${status.progress}%`);
 * }
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
  const job = await emailQueue.getJob(jobId);

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
 *
 * Can only cancel jobs that haven't started processing yet.
 * Once a job is active, it cannot be cancelled (would leave
 * emails in inconsistent state).
 *
 * @param campaignId - UUID of the campaign to cancel
 * @returns true if cancelled, false if not found or already processing
 *
 * @example
 * const cancelled = await cancelCampaignJob(campaignId);
 * if (!cancelled) {
 *   console.log('Job already processing, cannot cancel');
 * }
 */
export async function cancelCampaignJob(campaignId: string): Promise<boolean> {
  const jobId = `campaign-${campaignId}`;
  const job = await emailQueue.getJob(jobId);

  if (!job) {
    console.log(`[Queue] Cancel requested but job ${jobId} not found`);
    return false;
  }

  const state = await job.getState();

  // Can only cancel jobs that haven't started
  if (state === 'active') {
    console.warn(
      `[Queue] Cannot cancel job ${jobId} - already processing. ` +
        `State: ${state}`
    );
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
 * Use this for monitoring dashboards and health checks.
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
  const [waiting, active, completed, failed, delayed, isPaused] =
    await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
      emailQueue.getDelayedCount(),
      emailQueue.isPaused(),
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
 *
 * Use during maintenance or when you need to stop processing.
 * Active jobs will complete, but no new jobs will be picked up.
 */
export async function pauseQueue(): Promise<void> {
  await emailQueue.pause();
  console.log('[Queue] Email queue paused');
}

/**
 * Resumes a paused queue.
 */
export async function resumeQueue(): Promise<void> {
  await emailQueue.resume();
  console.log('[Queue] Email queue resumed');
}

/**
 * Cleans up old jobs from the queue.
 *
 * Run this periodically (e.g., daily cron) to free up Redis memory.
 *
 * @param olderThanMs - Remove jobs older than this (default: 7 days)
 */
export async function cleanupOldJobs(
  olderThanMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<{
  completedRemoved: number;
  failedRemoved: number;
}> {
  const [completedRemoved, failedRemoved] = await Promise.all([
    emailQueue.clean(olderThanMs, 1000, 'completed'),
    emailQueue.clean(olderThanMs, 1000, 'failed'),
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
// ============================================================

// Log when jobs are waiting
emailQueue.on('waiting', (job) => {
  console.log(`[Queue] Job ${job.id} is waiting`);
});

// Log queue errors
emailQueue.on('error', (error) => {
  console.error('[Queue] Queue error:', error.message);
});
