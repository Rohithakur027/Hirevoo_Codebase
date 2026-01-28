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
 * Redis connection options optimized for BullMQ and Upstash Free Tier.
 *
 * IMPORTANT: These settings are specifically tuned to minimize Redis
 * command usage for Upstash's free tier (500k commands/month).
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
  // NETWORK SETTINGS (IPv6 fix for Node.js 17+)
  // ============================================================
  // Prevents DNS lookup issues on Node.js 17+ where IPv6 is
  // preferred but may not be available, causing connection failures.
  family: 0, // 0 = auto, 4 = IPv4 only, 6 = IPv6 only

  // ============================================================
  // CONNECTION RETRY SETTINGS (OPTIMIZED FOR UPSTASH FREE TIER)
  // ============================================================
  // TRUE exponential backoff to prevent reconnection loops from
  // burning through your monthly command quota.
  retryStrategy: (times: number): number | null => {
    const maxRetries = 20; // Reduced from 50 to fail faster if truly disconnected

    if (times > maxRetries) {
      console.error(
        `[Redis] Maximum reconnection attempts (${maxRetries}) exceeded. Giving up.`
      );
      return null;
    }

    // TRUE exponential backoff: 1s, 2s, 4s, 8s, 16s, 20s (capped)
    // This prevents the "10 retries per second" death spiral
    const baseDelay = 1000; // Start at 1 second (not 100ms!)
    const maxDelay = 20000; // Cap at 20 seconds
    const delay = Math.min(baseDelay * Math.pow(2, times - 1), maxDelay);

    console.warn(
      `[Redis] Connection lost. Reconnect attempt #${times} in ${delay / 1000}s...`
    );

    return delay;
  },

  // ============================================================
  // TIMEOUT SETTINGS
  // ============================================================
  connectTimeout: 15000, // 15 seconds (increased for Upstash cold starts)
  // NOTE: commandTimeout is intentionally NOT set here.
  // BullMQ uses blocking commands (BRPOPLPUSH, XREAD) that can block
  // indefinitely waiting for jobs. Setting a timeout causes errors
  // when the queue is idle. ioredis default is 0 (no timeout).

  // ============================================================
  // KEEP-ALIVE SETTINGS
  // ============================================================
  // Increased to reduce command chatter while still detecting
  // broken connections. Upstash connections are stable.
  keepAlive: 60000, // 60 seconds (was 30s)

  // ============================================================
  // TLS SETTINGS FOR UPSTASH
  // ============================================================
  // Upstash requires TLS. The 'rediss://' URL prefix enables it
  // automatically, but we add explicit config for edge cases.
  tls: {
    rejectUnauthorized: false, // Required for some Upstash regions
  },

  // ============================================================
  // RECONNECT SETTINGS
  // ============================================================
  // Don't aggressively reconnect - wait and retry gracefully
  reconnectOnError: (err: Error): boolean | 1 | 2 => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    if (targetErrors.some((e) => err.message.includes(e))) {
      console.warn(`[Redis] Reconnectable error: ${err.message}`);
      return 1; // Reconnect and retry the failed command
    }
    return false;
  },
};

/**
 * Validates that the REDIS_URL environment variable is set.
 * Throws an error early if not configured, preventing cryptic
 * connection errors later.
 */
function validateRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;
  console.log('redisUrl', redisUrl);

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
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

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
 * import { getRedis } from '@/lib/queue/config';
 * import { Queue } from 'bullmq';
 *
 * const queue = new Queue('emails', { connection: getRedis() });
 */

// Lazy-loaded Redis connection to ensure environment variables are available
let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    validateRedisUrl();
    redisInstance = createRedisConnection('bullmq-main');
  }
  return redisInstance;
}

/**
 * Returns Redis connection options for BullMQ (avoids ioredis version conflicts)
 */
export function getRedisOptions() {
  const redisUrl = validateRedisUrl();
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 0,
  };
}

// For backward compatibility, export a function that returns the Redis instance
// This ensures Redis connection is only created when actually needed
export function getRedisConnection(): Redis {
  return getRedis();
}

// Keep the old export name for backward compatibility, but make it a getter
Object.defineProperty(module.exports, 'redis', {
  get: getRedis,
  enumerable: true,
  configurable: false
});

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

  if (!redisInstance) {
    console.log('[Redis] No active connection to close');
    return;
  }

  try {
    // quit() sends the QUIT command and waits for pending commands
    await redisInstance.quit();
    console.log('[Redis] Connection closed successfully');
  } catch (error) {
    // If quit fails (e.g., connection already closed), force disconnect
    console.warn('[Redis] Graceful close failed, forcing disconnect');
    redisInstance.disconnect();
  } finally {
    redisInstance = null;
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
    const response = await getRedis().ping();
    return response === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}
