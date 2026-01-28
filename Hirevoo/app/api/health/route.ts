/**
 * app/api/health/route.ts
 * 
 * Health check endpoint for monitoring system status.
 * Checks connectivity to:
 * - Supabase database
 * - Background worker service
 * - Gmail API (optional, requires user context)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// DATABASE CLIENT
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
 * Check Supabase database connectivity
 */
async function checkSupabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();

    const latencyMs = Date.now() - start;

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
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check background worker service connectivity
 */
async function checkBgWorker(): Promise<HealthCheckResult> {
  const bgWorkerUrl = process.env.BG_WORKER_URL || process.env.NEXT_PUBLIC_BG_WORKER_URL || 'http://localhost:3001';
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${bgWorkerUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        status: latencyMs < 2000 ? 'healthy' : 'degraded',
        latencyMs,
        details: data,
      };
    }

    return {
      status: 'degraded',
      latencyMs,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check environment configuration
 */
function checkEnvironment(): HealthCheckResult {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];

  const missingVars = requiredEnvVars.filter(key => !process.env[key]);

  if (missingVars.length > 0) {
    return {
      status: 'unhealthy',
      error: `Missing environment variables: ${missingVars.join(', ')}`,
    };
  }

  return {
    status: 'healthy',
    details: {
      configured: requiredEnvVars.length,
      bgWorkerUrl: process.env.BG_WORKER_URL || process.env.NEXT_PUBLIC_BG_WORKER_URL || 'http://localhost:3001',
    },
  };
}

// ============================================================
// GET /api/health - System health check
// ============================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Run all health checks in parallel
  const [supabaseHealth, bgWorkerHealth, envHealth] = await Promise.all([
    checkSupabase(),
    checkBgWorker(),
    Promise.resolve(checkEnvironment()),
  ]);

  // Determine overall status
  const checks = {
    supabase: supabaseHealth,
    bgWorker: bgWorkerHealth,
    environment: envHealth,
  };

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
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - startTime,
    checks,
    version: process.env.npm_package_version || '1.0.0',
  };

  // Return appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : 
                     overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, { status: statusCode });
}
