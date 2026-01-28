// Load env vars first - optional in production (Render injects them)
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch {
  // OK in production
}

/**
 * Background worker entry point - processes email jobs from BullMQ.
 * Runs as separate process with HTTP keep-alive for Render free tier.
 */

import http from 'http';
import { Worker, QueueEvents, Job } from 'bullmq';
import { getRedis, closeRedisConnection } from '../lib/queue/config';
import { processCampaign, processCampaignInBatches } from './jobs/send-campaign';
import type { SendCampaignJobData, SendCampaignJobResult } from '../lib/queue/email-queue';

// Keep-alive HTTP server for Render free tier + health checks

const PORT = process.env.PORT || 10000;

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'bg-worker',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hirevoo Background Worker is running.');
});

httpServer.listen(PORT, () => {
  console.log(`[HTTP] Keep-alive server listening on port ${PORT}`);
});

const redis = getRedis();
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

      throw error;
    }
  },

  // Optimized for Upstash free tier
  {
    connection: redis,
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
  connection: redis,
  prefix: CONFIG.PREFIX,
  blockingTimeout: 60000, // 60s to reduce Redis usage
});

queueEvents.on('waiting', ({ jobId }) => {
  console.log(`[QueueEvents] Job ${jobId} is waiting in queue`);
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  const result = returnvalue as SendCampaignJobResult;
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

worker.on('progress', (job: Job, progress: number | object) => {
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
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🛑 SHUTDOWN SIGNAL RECEIVED: ${signal.padEnd(30)}        ║
╚═══════════════════════════════════════════════════════════════╝

⏳ Initiating graceful shutdown...
   - Stopping acceptance of new jobs
   - Waiting for current jobs to complete (max 30s)
`);

  clearInterval(healthCheckTimer);

  try {
    console.log('[Shutdown] Closing HTTP server...');
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));

    console.log('[Shutdown] Closing worker...');
    await worker.close();

    console.log('[Shutdown] Closing queue events...');
    await queueEvents.close();

    console.log('[Shutdown] Closing Redis...');
    await closeRedisConnection();

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

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  console.error('[Worker] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Worker] Unhandled rejection:', reason);
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  ✅ WORKER READY - queue: ${CONFIG.QUEUE_NAME.padEnd(32)} ║
╚═══════════════════════════════════════════════════════════════╝
`);

export { worker, queueEvents };
