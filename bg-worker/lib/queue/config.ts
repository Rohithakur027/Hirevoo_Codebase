/**
 * lib/queue/config.ts
 *
 * Purpose: Redis connection configuration for BullMQ and Pub/Sub
 *
 * This file establishes the Redis connection used by BullMQ for job queuing
 * and by Pub/Sub for real-time event broadcasting. It exports a configured
 * ioredis client that handles connection pooling, automatic reconnection,
 * and error recovery.
 *
 * Key features:
 * - Single Redis connection shared across the application
 * - BullMQ-compatible configuration settings
 * - Automatic reconnection with exponential backoff
 * - Comprehensive connection event logging
 * - Graceful error handling
 *
 * Usage:
 * - Import `redis` for BullMQ Queue/Worker instances
 * - Import `createRedisConnection` when you need a fresh connection (e.g., Pub/Sub)
 *
 * @module lib/queue/config
 */

import Redis from 'ioredis';

/**
 * Redis connection options optimized for BullMQ and production use.
 *
 * These settings ensure reliable job processing even under network
 * instability or Redis server restarts.
 */
const redisOptions = {
  // ============================================================
  // BULLMQ REQUIRED SETTINGS
  // ============================================================
  // BullMQ uses blocking commands (BRPOPLPUSH) to wait for jobs.
  // Setting maxRetriesPerRequest to null allows these commands to
  // block indefinitely without triggering retry errors.
  maxRetriesPerRequest: null,

  // BullMQ manages its own connection state. Disabling the ready
  // check prevents ioredis from interfering with BullMQ's internal
  // connection management.
  enableReadyCheck: false,

  // ============================================================
  // CONNECTION RETRY SETTINGS
  // ============================================================
  // When Redis connection is lost, ioredis will automatically
  // attempt to reconnect. This function controls the delay between
  // reconnection attempts using exponential backoff.
  retryStrategy: (times: number): number | null => {
    // Maximum retry attempts before giving up
    const maxRetries = 50;

    if (times > maxRetries) {
      // After 50 failed attempts, stop retrying and let the error bubble up.
      // In production, this should trigger an alert to the operations team.
      console.error(
        `[Redis] Maximum reconnection attempts (${maxRetries}) exceeded. Giving up.`
      );
      return null; // Stop retrying
    }

    // Calculate delay with exponential backoff
    // Attempt 1: 100ms, Attempt 2: 200ms, Attempt 3: 400ms, etc.
    // Cap at 30 seconds to avoid extremely long delays
    const delay = Math.min(times * 100, 30000);

    console.warn(
      `[Redis] Connection lost. Attempting reconnect #${times} in ${delay}ms...`
    );

    return delay;
  },

  // ============================================================
  // TIMEOUT SETTINGS
  // ============================================================
  // Maximum time (ms) to wait for initial connection
  connectTimeout: 10000, // 10 seconds

  // Maximum time (ms) to wait for a command to complete
  // Set higher for blocking commands used by BullMQ
  commandTimeout: 60000, // 60 seconds

  // ============================================================
  // KEEP-ALIVE SETTINGS
  // ============================================================
  // Send TCP keep-alive packets every 30 seconds to detect
  // broken connections early. This is especially important
  // for cloud Redis services like Upstash.
  keepAlive: 30000, // 30 seconds

  // ============================================================
  // TLS/SSL SETTINGS
  // ============================================================
  // Upstash Redis requires TLS. The 'rediss://' protocol in the
  // connection URL automatically enables TLS, but we can also
  // set it explicitly for clarity.
  // tls: {} // Uncomment if your REDIS_URL doesn't start with 'rediss://'
};

/**
 * Validates that the REDIS_URL environment variable is set.
 * Throws an error early if not configured, preventing cryptic
 * connection errors later.
 */
function validateRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      '[Redis] REDIS_URL environment variable is not set. ' +
        'Please add REDIS_URL to your .env.local file. ' +
        'Expected format: redis://username:password@host:port or rediss://... for TLS'
    );
  }

  // Basic URL validation
  if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
    throw new Error(
      '[Redis] REDIS_URL must start with redis:// or rediss:// (for TLS). ' +
        `Received: ${redisUrl.substring(0, 20)}...`
    );
  }

  return redisUrl;
}

/**
 * Creates a new Redis connection instance.
 *
 * Use this when you need a separate connection (e.g., for Pub/Sub).
 * Redis Pub/Sub requires dedicated connections because once a
 * connection enters subscribe mode, it can only receive messages.
 *
 * @param connectionName - Optional name for logging/debugging
 * @returns A new Redis connection instance
 *
 * @example
 * // For Pub/Sub subscriber (needs dedicated connection)
 * const subscriber = createRedisConnection('pubsub-subscriber');
 * subscriber.subscribe('email:sent');
 */
export function createRedisConnection(connectionName?: string): Redis {
  const redisUrl = validateRedisUrl();

  const connection = new Redis(redisUrl, {
    ...redisOptions,
    // Add connection name for easier debugging in Redis CLI
    // Run `CLIENT LIST` in redis-cli to see named connections
    connectionName: connectionName || 'hirevoo-unnamed',
  });

  // ============================================================
  // CONNECTION EVENT HANDLERS
  // ============================================================
  // These handlers provide visibility into connection state changes,
  // which is crucial for debugging production issues.

  connection.on('connect', () => {
    // Fired when a connection is established to Redis server
    // Note: This doesn't mean the connection is ready for commands yet
    console.log(
      `[Redis:${connectionName || 'default'}] ` +
        `Connection established to Redis server`
    );
  });

  connection.on('ready', () => {
    // Fired when Redis is ready to accept commands
    // This is the event that indicates full operational status
    console.log(
      `[Redis:${connectionName || 'default'}] ` +
        `✅ Connection ready. Redis is accepting commands.`
    );
  });

  connection.on('error', (error: Error) => {
    // Fired on any connection error
    // ioredis will automatically attempt to reconnect based on retryStrategy
    console.error(
      `[Redis:${connectionName || 'default'}] ` +
        `❌ Connection error: ${error.message}`
    );

    // In production, you might want to send this to an error tracking service
    // like Sentry, Datadog, or your monitoring solution
  });

  connection.on('close', () => {
    // Fired when the connection is closed
    // This could be intentional (calling quit()) or due to an error
    console.warn(
      `[Redis:${connectionName || 'default'}] ` +
        `Connection closed`
    );
  });

  connection.on('reconnecting', (delayMs: number) => {
    // Fired when ioredis is attempting to reconnect
    console.log(
      `[Redis:${connectionName || 'default'}] ` +
        `Reconnecting in ${delayMs}ms...`
    );
  });

  connection.on('end', () => {
    // Fired when no more reconnection attempts will be made
    // This happens after retryStrategy returns null
    console.error(
      `[Redis:${connectionName || 'default'}] ` +
        `Connection ended. No more reconnection attempts.`
    );
  });

  return connection;
}

/**
 * Primary Redis connection for BullMQ queues and workers.
 *
 * This is a singleton connection that should be shared across
 * the application for queue operations. BullMQ handles connection
 * pooling internally, so one connection is sufficient.
 *
 * @example
 * import { redis } from '@/lib/queue/config';
 * import { Queue } from 'bullmq';
 *
 * const queue = new Queue('emails', { connection: redis });
 */
export const redis = createRedisConnection('bullmq-main');

/**
 * Gracefully closes the Redis connection.
 *
 * Call this during application shutdown to ensure all pending
 * commands complete before the connection is closed.
 *
 * @example
 * // In your shutdown handler
 * process.on('SIGTERM', async () => {
 *   await closeRedisConnection();
 *   process.exit(0);
 * });
 */
export async function closeRedisConnection(): Promise<void> {
  console.log('[Redis] Closing connection gracefully...');

  try {
    // quit() sends the QUIT command and waits for pending commands
    await redis.quit();
    console.log('[Redis] Connection closed successfully');
  } catch (error) {
    // If quit fails (e.g., connection already closed), force disconnect
    console.warn('[Redis] Graceful close failed, forcing disconnect');
    redis.disconnect();
  }
}

/**
 * Health check function to verify Redis connectivity.
 *
 * Use this in health check endpoints or startup validation.
 *
 * @returns true if Redis is connected and responding
 *
 * @example
 * // In an API health check route
 * const redisHealthy = await isRedisHealthy();
 * if (!redisHealthy) {
 *   return Response.json({ status: 'unhealthy' }, { status: 503 });
 * }
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    // PING returns 'PONG' if the connection is healthy
    const response = await redis.ping();
    return response === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}
