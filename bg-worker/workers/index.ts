// Load env vars first - optional in production (Render injects them)
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch {
  // OK in production
}

/**
 * Background worker - processes email jobs from BullMQ.
 * Runs integrated with Next.js (same process, no separate port needed).
 */

import { Worker, QueueEvents, Job } from 'bullmq';
import { getRedisOptions } from '../lib/queue/config';
import { processCampaign } from './jobs/send-campaign';
import type { SendCampaignJobData, SendCampaignJobResult } from '../lib/queue/email-queue';

const redisOpts = getRedisOptions();
const CONFIG = {
  QUEUE_NAME: 'emails',
  CONCURRENCY: 1,
  LOCK_DURATION: 1800000, // 30 min
  LOCK_RENEW_TIME: 60000, // 1 min
  PREFIX: 'bull:hirevoo',
  BATCH_THRESHOLD: 500,
};

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

const worker = new Worker<SendCampaignJobData, SendCampaignJobResult>(
  CONFIG.QUEUE_NAME,
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
      let result;
      if (job.name === 'send-reply') {
        const { processReply } = await import('./jobs/send-reply');
        result = await processReply(job as any);
      } else {
        result = await processCampaign(job);
      }

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

      throw error;
    }
  },

  // Optimized for Upstash free tier
  {
    connection: redisOpts,
    concurrency: CONFIG.CONCURRENCY,
    prefix: CONFIG.PREFIX,
    lockDuration: CONFIG.LOCK_DURATION,
    lockRenewTime: CONFIG.LOCK_RENEW_TIME,
    drainDelay: 10000, // 10s poll interval when idle (default 5ms burns quota)
    stalledInterval: 300000, // 5 min
    maxStalledCount: 2,
    removeOnComplete: { count: 100, age: 24 * 3600 },
    removeOnFail: { count: 50, age: 7 * 24 * 3600 },
  }
);

// Queue-wide events (fires for all jobs, not just this worker)
const queueEvents = new QueueEvents(CONFIG.QUEUE_NAME, {
  connection: redisOpts,
  prefix: CONFIG.PREFIX,
  blockingTimeout: 60000, // 60s to reduce Redis usage
});

queueEvents.on('waiting', ({ jobId }) => {
  console.log(`[QueueEvents] Job ${jobId} is waiting in queue`);
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  const result = typeof returnvalue === 'string'
    ? JSON.parse(returnvalue) as SendCampaignJobResult
    : returnvalue as SendCampaignJobResult;
  console.log(
    `[QueueEvents] Job ${jobId} completed - ` +
    `Sent: ${result?.successCount || 0}, Failed: ${result?.failureCount || 0}`
  );
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[QueueEvents] Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('stalled', ({ jobId }) => {
  console.warn(`[QueueEvents] ⚠️ Job ${jobId} stalled (taking too long)`);
});

// Worker events (this instance only)
worker.on('completed', (job: Job, result: SendCampaignJobResult) => {
  console.log(
    `[Worker] Job ${job.id} completed - ` +
    `${result.successCount} sent, ${result.failureCount} failed ` +
    `in ${(result.durationMs / 1000).toFixed(1)}s`
  );
});

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

worker.on('error', (error: Error) => {
  console.error('[Worker] Worker error:', error.message);
});

worker.on('active', (job: Job) => {
  console.log(`[Worker] Job ${job.id} is now active`);
});

worker.on('progress', (job, progress) => {
  const progressData = typeof progress === 'object' ? progress : { percentage: progress };
  const pct = typeof progress === 'object' && 'percentage' in progress ? (progress as { percentage: number }).percentage : 0;
  // Only log at 25% intervals
  if (pct % 25 === 0 || pct === 100) {
    console.log(
      `[Worker] Job ${job.id} progress: ${pct}%`,
      JSON.stringify(progressData)
    );
  }
});

worker.on('stalled', (jobId: string) => {
  console.warn(`[Worker] ⚠️ Job ${jobId} is stalled`);
});

// Health check every 5 min
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;

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

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[Worker] Shutdown signal received: ${signal}`);
  clearInterval(healthCheckTimer);

  try {
    console.log('[Worker] Closing worker...');
    await worker.close();

    console.log('[Worker] Closing queue events...');
    await queueEvents.close();

    console.log('[Worker] Graceful shutdown complete');
  } catch (error) {
    console.error('[Worker] Error during shutdown:', error);
  }
}

// =======================================================
// EXPORT & STARTUP LOGIC
// =======================================================

// Singleton tracker to prevent multiple startup in dev
let isWorkerStarted = false;

export async function startWorker() {
  if (isWorkerStarted) {
    console.log('[Worker] Worker already started, skipping initialization.');
    return;
  }

  isWorkerStarted = true;
  console.log('[Worker] Initializing worker in integrated mode...');

  // Resume the worker if it was created but not running
  if (!worker.isRunning()) {
    await worker.resume();
  } else {
    // It might be running but let's make sure it's not paused
    // In BullMQ, new Worker() usually starts automatically.
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🚀 HIREVOO EMAIL WORKER STARTED                              ║
║  Mode: Integrated (Next.js)                                   ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { worker, queueEvents };
