/**
 * app/api/health/route.ts (bg-worker)
 * 
 * Health check endpoint for the background worker service.
 * Checks connectivity to:
 * - Redis (BullMQ queue)
 * - Supabase database
 * - Worker process status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// DATABASE CLIENT (lazy initialization)
// ============================================================

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
    );
  }
  return supabase;
}

// ============================================================
// HEALTH CHECK FUNCTIONS
// ============================================================

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Check Redis connectivity via a simple ping
 */
async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    // Dynamic import to avoid issues when Redis is not configured
    const { getRedis } = await import('@/lib/queue/config');
    const redis = getRedis();
    
    const response = await redis.ping();
    const latencyMs = Date.now() - start;

    if (response === 'PONG') {
      return {
        status: latencyMs < 500 ? 'healthy' : 'degraded',
        latencyMs,
        details: {
          response,
          redisUrl: process.env.REDIS_URL?.substring(0, 30) + '...',
        },
      };
    }

    return {
      status: 'unhealthy',
      latencyMs,
      error: `Unexpected response: ${response}`,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

/**
 * Check Supabase database connectivity
 */
async function checkSupabase(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const { error } = await getSupabase()
      .from('users')
      .select('count')
      .limit(1)
      .single();

    const latencyMs = Date.now() - start;

    // "0 rows" error is actually OK - just means no users yet
    if (error && !error.message.includes('0 rows')) {
      return {
        status: 'unhealthy',
        latencyMs,
        error: error.message,
      };
    }

    return {
      status: latencyMs < 1000 ? 'healthy' : 'degraded',
      latencyMs,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check queue status
 */
async function checkQueue(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const { getEmailQueue } = await import('@/lib/queue/email-queue');
    const queue = getEmailQueue();
    
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    const latencyMs = Date.now() - start;

    return {
      status: 'healthy',
      latencyMs,
      details: {
        waiting,
        active,
        completed,
        failed,
        queueName: 'emails',
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Queue check failed',
    };
  }
}

/**
 * Check environment configuration
 */
function checkEnvironment(): HealthCheckResult {
  const requiredEnvVars = [
    'REDIS_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(key => !process.env[key]);

  if (missingVars.length > 0) {
    return {
      status: 'unhealthy',
      error: `Missing: ${missingVars.join(', ')}`,
    };
  }

  return {
    status: 'healthy',
    details: {
      configured: requiredEnvVars.length,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };
}

// ============================================================
// GET /api/health - Worker health check
// ============================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Run checks in parallel
  const [redisHealth, supabaseHealth, queueHealth, envHealth] = await Promise.all([
    checkRedis(),
    checkSupabase(),
    checkQueue(),
    Promise.resolve(checkEnvironment()),
  ]);

  const checks = {
    redis: redisHealth,
    supabase: supabaseHealth,
    queue: queueHealth,
    environment: envHealth,
  };

  // Determine overall status
  const statuses = Object.values(checks).map(c => c.status);
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

  if (statuses.every(s => s === 'healthy')) {
    overallStatus = 'healthy';
  } else if (statuses.some(s => s === 'unhealthy')) {
    overallStatus = 'unhealthy';
  } else {
    overallStatus = 'degraded';
  }

  const response = {
    service: 'bg-worker',
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - startTime,
    checks,
    uptime: process.uptime(),
    memory: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };

  const statusCode = overallStatus === 'healthy' ? 200 : 
                     overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, { status: statusCode });
}
