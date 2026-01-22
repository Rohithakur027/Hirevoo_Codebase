/**
 * workers/index.ts
 *
 * Purpose: Main worker process entry point for background email processing
 *
 * This file runs as a separate Node.js process (Terminal 2) and is responsible
 * for picking up jobs from the BullMQ queue and processing them. It runs
 * independently of the Next.js application.
 *
 * How to run:
 *   Development: npm run worker (uses tsx watch for hot reload)
 *   Production:  npm run worker:prod
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    WORKER PROCESS                           │
 * │                                                             │
 * │  ┌─────────────────┐    ┌─────────────────┐                │
 * │  │  BullMQ Worker  │    │  QueueEvents    │                │
 * │  │  (processes     │    │  (monitors      │                │
 * │  │   jobs)         │    │   queue)        │                │
 * │  └─────────────────┘    └─────────────────┘                │
 * │           │                                                 │
 * │           ▼                                                 │
 * │  ┌─────────────────────────────────────┐                   │
 * │  │  processCampaign()                  │                   │
 * │  │  (business logic in send-campaign)  │                   │
 * │  └─────────────────────────────────────┘                   │
 * │                                                             │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *                              │ Redis
 *                              ▼
 *                       ┌─────────────┐
 *                       │   Upstash   │
 *                       │   Redis     │
 *                       └─────────────┘
 *
 * Key Responsibilities:
 * 1. Create BullMQ Worker instance to process jobs
 * 2. Handle worker lifecycle events (completed, failed, error)
 * 3. Implement graceful shutdown on SIGTERM/SIGINT
 * 4. Log all activity for monitoring and debugging
 *
 * @module workers/index
 */

import { Worker, QueueEvents, Job } from 'bullmq';
import { redis, closeRedisConnection } from '../lib/queue/config';
import { processCampaign, processCampaignInBatches } from './jobs/send-campaign';
import type { SendCampaignJobData, SendCampaignJobResult } from '../lib/queue/email-queue';

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Worker configuration constants.
 * Adjust these based on your infrastructure and Gmail API limits.
 */
const CONFIG = {
  // Queue name must match the one in email-queue.ts
  QUEUE_NAME: 'emails',

  // How many jobs to process simultaneously
  // Higher = more throughput, but more Gmail API load
  // Recommendation: Start with 1, increase after testing
  CONCURRENCY: 1,

  // Maximum job duration before considering it stalled (ms)
  // Set high for large campaigns
  LOCK_DURATION: 1800000, // 30 minutes

  // How often to renew the lock on active jobs (ms)
  LOCK_RENEW_TIME: 60000, // 1 minute

  // Redis key prefix (must match email-queue.ts)
  PREFIX: 'bull:hirevoo',

  // Threshold for using batch processing
  BATCH_THRESHOLD: 500,
};

// ============================================================
// STARTUP BANNER
// ============================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 HIREVOO EMAIL WORKER                                     ║
║                                                               ║
║   Background worker for processing email campaigns            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

📅 Started at: ${new Date().toISOString()}
📡 Redis URL: ${process.env.REDIS_URL?.substring(0, 40)}...
⚙️  Concurrency: ${CONFIG.CONCURRENCY} job(s)
📋 Queue: ${CONFIG.QUEUE_NAME}
🔒 Lock Duration: ${CONFIG.LOCK_DURATION / 1000}s

`);

// ============================================================
// WORKER CREATION
// ============================================================

/**
 * Main BullMQ Worker instance.
 *
 * The worker continuously polls Redis for new jobs and processes them
 * using the provided callback function.
 */
const worker = new Worker<SendCampaignJobData, SendCampaignJobResult>(
  CONFIG.QUEUE_NAME,

  // ─────────────────────────────────────────────────────────
  // JOB PROCESSOR FUNCTION
  // ─────────────────────────────────────────────────────────
  // This function is called for each job. It receives the job
  // and must return a result or throw an error.
  async (job: Job<SendCampaignJobData, SendCampaignJobResult>) => {
    const startTime = Date.now();
    const logPrefix = `[Worker][Job:${job.id}]`;

    console.log(`
────────────────────────────────────────────────────────────────
${logPrefix} 📥 Job received
────────────────────────────────────────────────────────────────
  Job ID:     ${job.id}
  Name:       ${job.name}
  Campaign:   ${job.data.campaignId}
  User:       ${job.data.userId}
  Queued at:  ${job.data.queuedAt}
  Attempt:    ${job.attemptsMade + 1}/${job.opts.attempts || 3}
`);

    try {
      // Determine if we should use batch processing
      // (for large campaigns to manage memory)
      const result = await processCampaign(job);

      const duration = Date.now() - startTime;

      console.log(`
${logPrefix} ✅ Job completed successfully
  Duration:   ${(duration / 1000).toFixed(1)}s
  Sent:       ${result.successCount}
  Failed:     ${result.failureCount}
────────────────────────────────────────────────────────────────
`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`
${logPrefix} ❌ Job failed
  Duration:   ${(duration / 1000).toFixed(1)}s
  Error:      ${errorMessage}
  Will Retry: ${job.attemptsMade + 1 < (job.opts.attempts || 3) ? 'Yes' : 'No'}
────────────────────────────────────────────────────────────────
`);

      // Re-throw to trigger BullMQ retry mechanism
      throw error;
    }
  },

  // ─────────────────────────────────────────────────────────
  // WORKER OPTIONS
  // ─────────────────────────────────────────────────────────
  {
    // Use our configured Redis connection
    connection: redis,

    // Number of jobs to process simultaneously
    concurrency: CONFIG.CONCURRENCY,

    // Redis key prefix
    prefix: CONFIG.PREFIX,

    // Lock settings to prevent job duplication
    lockDuration: CONFIG.LOCK_DURATION,
    lockRenewTime: CONFIG.LOCK_RENEW_TIME,

    // Stalled job checking
    // If a job doesn't complete within lockDuration, it's considered stalled
    // and can be picked up by another worker
    stalledInterval: 30000, // Check every 30 seconds
    maxStalledCount: 2, // Allow 2 stalls before marking as failed

    // Metrics collection (optional, for monitoring)
    metrics: {
      maxDataPoints: 1000, // Keep last 1000 data points
    },
  }
);

// ============================================================
// QUEUE EVENTS LISTENER
// ============================================================

/**
 * QueueEvents provides advanced monitoring capabilities.
 *
 * Unlike worker events (which fire only for jobs processed by THIS worker),
 * QueueEvents fires for ALL jobs in the queue, regardless of which worker
 * processes them. Useful for dashboards and monitoring.
 */
const queueEvents = new QueueEvents(CONFIG.QUEUE_NAME, {
  connection: redis,
  prefix: CONFIG.PREFIX,
});

// Log when jobs are waiting in queue
queueEvents.on('waiting', ({ jobId }) => {
  console.log(`[QueueEvents] Job ${jobId} is waiting in queue`);
});

// Log when jobs complete (any worker)
queueEvents.on('completed', ({ jobId, returnvalue }) => {
  const result = returnvalue as SendCampaignJobResult;
  console.log(
    `[QueueEvents] Job ${jobId} completed - ` +
      `Sent: ${result?.successCount || 0}, Failed: ${result?.failureCount || 0}`
  );
});

// Log when jobs fail (any worker)
queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[QueueEvents] Job ${jobId} failed: ${failedReason}`);
});

// Log stalled jobs (taking too long)
queueEvents.on('stalled', ({ jobId }) => {
  console.warn(`[QueueEvents] ⚠️ Job ${jobId} stalled (taking too long)`);
});

// ============================================================
// WORKER EVENT HANDLERS
// ============================================================

/**
 * Worker lifecycle events.
 * These fire only for jobs processed by THIS worker instance.
 */

// Fired when worker successfully completes a job
worker.on('completed', (job: Job, result: SendCampaignJobResult) => {
  console.log(
    `[Worker] Job ${job.id} completed - ` +
      `${result.successCount} sent, ${result.failureCount} failed ` +
      `in ${(result.durationMs / 1000).toFixed(1)}s`
  );
});

// Fired when worker fails to process a job
worker.on('failed', (job: Job | undefined, error: Error) => {
  if (job) {
    console.error(
      `[Worker] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts || 3}):`,
      error.message
    );
  } else {
    console.error('[Worker] Job failed (job undefined):', error.message);
  }
});

// Fired on worker-level errors (not job-specific)
worker.on('error', (error: Error) => {
  console.error('[Worker] Worker error:', error.message);
});

// Fired when a job is active (being processed)
worker.on('active', (job: Job) => {
  console.log(`[Worker] Job ${job.id} is now active`);
});

// Fired when job progress is updated
worker.on('progress', (job: Job, progress: number | object) => {
  const progressData = typeof progress === 'object' ? progress : { percentage: progress };
  console.log(
    `[Worker] Job ${job.id} progress:`,
    JSON.stringify(progressData)
  );
});

// Fired when a job is stalled
worker.on('stalled', (jobId: string) => {
  console.warn(`[Worker] ⚠️ Job ${jobId} is stalled`);
});

// ============================================================
// HEALTH MONITORING
// ============================================================

/**
 * Periodic health check and statistics logging.
 * Logs memory usage and worker status every 5 minutes.
 */
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

const healthCheckTimer = setInterval(async () => {
  const memoryUsage = process.memoryUsage();
  const memoryMB = {
    heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1),
    heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(1),
    rss: (memoryUsage.rss / 1024 / 1024).toFixed(1),
  };

  console.log(`
[Health Check] ${new Date().toISOString()}
  Memory: ${memoryMB.heapUsed}MB used / ${memoryMB.heapTotal}MB heap / ${memoryMB.rss}MB RSS
  Worker: ${worker.isRunning() ? 'Running ✅' : 'Stopped ❌'}
`);
}, HEALTH_CHECK_INTERVAL);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

/**
 * Graceful shutdown handler.
 *
 * When the process receives SIGTERM or SIGINT:
 * 1. Stop accepting new jobs
 * 2. Wait for current job to complete (up to 30 seconds)
 * 3. Close Redis connections
 * 4. Exit cleanly
 *
 * This prevents job corruption during deployments or restarts.
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🛑 SHUTDOWN SIGNAL RECEIVED: ${signal.padEnd(30)}        ║
╚═══════════════════════════════════════════════════════════════╝

⏳ Initiating graceful shutdown...
   - Stopping acceptance of new jobs
   - Waiting for current jobs to complete (max 30s)
`);

  // Clear health check timer
  clearInterval(healthCheckTimer);

  try {
    // Close the worker (waits for current jobs to complete)
    console.log('[Shutdown] Closing worker...');
    await worker.close();
    console.log('[Shutdown] Worker closed');

    // Close queue events listener
    console.log('[Shutdown] Closing queue events listener...');
    await queueEvents.close();
    console.log('[Shutdown] Queue events closed');

    // Close Redis connection
    console.log('[Shutdown] Closing Redis connection...');
    await closeRedisConnection();
    console.log('[Shutdown] Redis connection closed');

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  ✅ GRACEFUL SHUTDOWN COMPLETE                                ║
╚═══════════════════════════════════════════════════════════════╝
`);

    process.exit(0);
  } catch (error) {
    console.error('[Shutdown] Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('[Worker] Uncaught exception:', error);
  // Don't exit - let the worker continue processing
  // The specific job will fail and be retried
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Worker] Unhandled rejection:', reason);
  // Don't exit - let the worker continue processing
});

// ============================================================
// WORKER READY
// ============================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  ✅ WORKER READY                                              ║
║                                                               ║
║  Watching for jobs on queue: ${CONFIG.QUEUE_NAME.padEnd(29)} ║
║                                                               ║
║  Press Ctrl+C to stop gracefully                              ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Export worker for testing purposes
export { worker, queueEvents };
