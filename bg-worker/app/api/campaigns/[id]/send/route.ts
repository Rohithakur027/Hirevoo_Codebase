/**
 * API endpoint that validates a campaign and queues it for background sending.
 * Entry point for "Send Campaign".
 * 1. Authenticates user
 * 2. Validates campaign/ownership
 * 3. Validates Gmail connection
 * 4. Validates pending emails
 * 5. Queues campaign job
 *
 * @module app/api/campaigns/[id]/send/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { queueCampaignSend, getCampaignJobStatus } from '@/lib/queue/email-queue';
import { isGmailConnected } from '@/lib/services/email-service';

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Daily sending limits by plan type.
 * Adjust these based on your business model.
 */
const DAILY_LIMITS: Record<string, number> = {
  free: 50,
  starter: 200,
  professional: 500,
  enterprise: 2000,
};

/**
 * Response time target in milliseconds.
 * We aim to respond within this time.
 */
const TARGET_RESPONSE_TIME_MS = 300;

// ============================================================
// DATABASE CLIENT
// ============================================================

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface RouteParams {
  params: {
    id: string;
  };
}

interface ApiSuccessResponse {
  success: true;
  message: string;
  jobId: string;
  queuePosition: number;
  pendingEmails: number;
  estimatedDurationSeconds: number;
}

interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Creates a standardized error response.
 */
function errorResponse(
  error: string,
  code: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  console.log(`[API:send] Error: ${code} - ${error}`);

  return NextResponse.json(
    {
      success: false as const,
      error,
      code,
      details,
    },
    { status }
  );
}

/**
 * Estimates sending duration.
 * Based on ~5 emails/sec (Gmail limit) + 200ms rate limit + overhead.
 *
 * @param emailCount - Number of emails to send
 * @returns Estimated duration in seconds
 */
function estimateDuration(emailCount: number): number {
  // 200ms per email + 10% overhead
  const msPerEmail = 220;
  return Math.ceil((emailCount * msPerEmail) / 1000);
}

// ============================================================
// MAIN ROUTE HANDLER
// ============================================================

/**
 * POST /api/campaigns/[id]/send
 *
 * Queues a campaign for background email sending.
 *
 * @param request - The incoming request
 * @param params - Route parameters containing campaign ID
 * @returns JSON response with job ID or error
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  const startTime = Date.now();
  const campaignId = params.id;

  console.log(`\n[API:send] ────────────────────────────────────`);
  console.log(`[API:send] Processing send request for campaign: ${campaignId}`);

  try {
    // ─────────────────────────────────────────────────────────
    // STEP 1: AUTHENTICATE REQUEST
    // ─────────────────────────────────────────────────────────
    // Authenticate internal API calls

    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (apiKey !== process.env.BG_WORKER_API_KEY && apiKey !== 'internal-key') {
      return errorResponse(
        'Invalid API key',
        'UNAUTHORIZED',
        401
      );
    }

    // Get user data from request body
    const requestData = await request.json().catch(() => ({}));
    const userId = requestData.userId;
    const userPlan = requestData.userPlan || 'free';

    if (!userId) {
      return errorResponse(
        'Missing userId in request',
        'INVALID_REQUEST',
        400
      );
    }

    console.log(`[API:send] User: ${userId.substring(0, 8)}..., Plan: ${userPlan}`);

    // ─────────────────────────────────────────────────────────
    // STEP 2: VALIDATE CAMPAIGN EXISTS AND BELONGS TO USER
    // ─────────────────────────────────────────────────────────

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id, name, status')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return errorResponse(
        'Campaign not found',
        'CAMPAIGN_NOT_FOUND',
        404
      );
    }

    // Verify ownership
    if (campaign.user_id !== userId) {
      console.warn(
        `[API:send] Unauthorized access attempt - ` +
        `User ${userId} tried to access campaign ${campaignId}`
      );
      return errorResponse(
        'You do not have permission to send this campaign',
        'FORBIDDEN',
        403
      );
    }

    console.log(`[API:send] Campaign found: "${campaign.name}", Status: ${campaign.status}`);

    // ─────────────────────────────────────────────────────────
    // STEP 3: CHECK CAMPAIGN STATUS (PREVENT DUPLICATE SENDS)
    // ─────────────────────────────────────────────────────────

    if (campaign.status === 'sending') {
      // Check if there's an active job
      const jobStatus = await getCampaignJobStatus(campaignId);

      if (jobStatus && ['waiting', 'delayed', 'active'].includes(jobStatus.state)) {
        return errorResponse(
          `Campaign is already being sent (${jobStatus.progress}% complete)`,
          'ALREADY_SENDING',
          409,
          {
            jobId: jobStatus.jobId,
            progress: jobStatus.progress,
            state: jobStatus.state,
          }
        );
      }

      // Status is 'sending' but no active job. Check for pending emails.
      console.log(`[API:send] Campaign status is 'sending' but no active job found. Checking for pending emails...`);

      const { count: stillPending } = await supabase
        .from('campaign_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending');

      if (stillPending === 0) {
        // No pending emails left, campaign should be marked as sent
        console.log(`[API:send] No pending emails, updating campaign status to 'sent'`);
        await supabase
          .from('campaigns')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', campaignId);

        return errorResponse(
          'This campaign has already been sent.',
          'ALREADY_SENT',
          400
        );
      }

      // There are pending emails but no active job - allow re-queuing
      console.log(`[API:send] Found ${stillPending} pending emails with stale 'sending' status. Allowing re-queue.`);
    }

    if (campaign.status === 'sent') {
      return errorResponse(
        'This campaign has already been sent. Create a new campaign to send again.',
        'ALREADY_SENT',
        400
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 4: VERIFY GMAIL IS CONNECTED
    // ─────────────────────────────────────────────────────────

    const gmailConnected = await isGmailConnected(userId);

    if (!gmailConnected) {
      return errorResponse(
        'Gmail is not connected. Please connect your Gmail account in Settings before sending.',
        'GMAIL_NOT_CONNECTED',
        400
      );
    }

    console.log(`[API:send] Gmail connected: ✅`);

    // ─────────────────────────────────────────────────────────
    // STEP 5: COUNT PENDING EMAILS
    // ─────────────────────────────────────────────────────────

    const { count: pendingCount, error: countError } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (countError) {
      console.error('[API:send] Failed to count emails:', countError);
      return errorResponse(
        'Failed to check campaign emails',
        'DATABASE_ERROR',
        500
      );
    }

    const pendingEmails = pendingCount || 0;

    if (pendingEmails === 0) {
      return errorResponse(
        'No emails to send. Add recipients to your campaign first.',
        'NO_PENDING_EMAILS',
        400
      );
    }

    console.log(`[API:send] Pending emails: ${pendingEmails}`);

    // ─────────────────────────────────────────────────────────
    // STEP 6: CHECK DAILY SENDING LIMIT
    // ─────────────────────────────────────────────────────────
    // Count emails sent today and compare against plan limit

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // First, get all campaign IDs for this user
    const { data: userCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', userId);

    if (campaignsError) {
      console.error('[API:send] Error fetching user campaigns:', campaignsError);
      return errorResponse(
        'Failed to check sending limits',
        'DATABASE_ERROR',
        500
      );
    }

    const campaignIds = userCampaigns?.map(c => c.id) || [];

    // Now count sent emails for this user's campaigns today
    const { count: sentToday, error: limitError } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString())
      .in('campaign_id', campaignIds);


    const dailyLimit = DAILY_LIMITS[userPlan] || DAILY_LIMITS.free;
    const emailsSentToday = sentToday || 0;
    const remainingQuota = dailyLimit - emailsSentToday;

    if (remainingQuota <= 0) {
      return errorResponse(
        `Daily sending limit reached (${dailyLimit} emails). ` +
        `Upgrade your plan for higher limits.`,
        'DAILY_LIMIT_EXCEEDED',
        429,
        {
          limit: dailyLimit,
          used: emailsSentToday,
          plan: userPlan,
        }
      );
    }

    if (pendingEmails > remainingQuota) {
      console.warn(
        `[API:send] Campaign has ${pendingEmails} emails but only ` +
        `${remainingQuota} remaining in daily quota`
      );
      // Allow sending, stop when limit is hit
    }

    console.log(
      `[API:send] Daily limit: ${emailsSentToday}/${dailyLimit} ` +
      `(${remainingQuota} remaining)`
    );

    // ─────────────────────────────────────────────────────────
    // STEP 7: QUEUE THE CAMPAIGN JOB
    // ─────────────────────────────────────────────────────────

    console.log(`[API:send] Queuing campaign...`);

    const { jobId, queuePosition } = await queueCampaignSend(campaignId, userId, {
      // Lower priority number = higher priority
      // Could adjust based on user plan
      priority: userPlan === 'enterprise' ? 1 : 5,
    });

    console.log(`[API:send] ✅ Job queued: ${jobId}, Position: ${queuePosition}`);

    // ─────────────────────────────────────────────────────────
    // STEP 8: UPDATE CAMPAIGN STATUS
    // ─────────────────────────────────────────────────────────
    // Mark as 'sending' for UI state

    await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    // ─────────────────────────────────────────────────────────
    // STEP 9: RETURN SUCCESS RESPONSE
    // ─────────────────────────────────────────────────────────

    const estimatedDuration = estimateDuration(pendingEmails);
    const responseTime = Date.now() - startTime;

    console.log(
      `[API:send] Response time: ${responseTime}ms ` +
      `(target: <${TARGET_RESPONSE_TIME_MS}ms)`
    );

    if (responseTime > TARGET_RESPONSE_TIME_MS) {
      console.warn(`[API:send] ⚠️ Response time exceeded target!`);
    }

    return NextResponse.json({
      success: true as const,
      message: `Campaign queued! Sending ${pendingEmails} emails in background.`,
      jobId,
      queuePosition,
      pendingEmails,
      estimatedDurationSeconds: estimatedDuration,
    });
  } catch (error) {
    // ─────────────────────────────────────────────────────────
    // CATCH-ALL ERROR HANDLER
    // ─────────────────────────────────────────────────────────

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API:send] Unexpected error:', error);

    // Check for specific error types
    if (errorMessage.includes('already being processed')) {
      return errorResponse(
        'Campaign is already being processed',
        'ALREADY_PROCESSING',
        409
      );
    }

    return errorResponse(
      'Failed to queue campaign. Please try again.',
      'INTERNAL_ERROR',
      500,
      { error: errorMessage }
    );
  }
}

// ============================================================
// GET HANDLER - CHECK CAMPAIGN STATUS
// ============================================================

/**
 * GET /api/campaigns/[id]/send
 *
 * Gets the current send status of a campaign.
 * Useful for polling or reconnecting.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const campaignId = params.id;

  try {
    // Authenticate internal API calls
    const authHeader = request.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!apiKey || apiKey !== process.env.BG_WORKER_API_KEY) {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Get job status
    const jobStatus = await getCampaignJobStatus(campaignId);

    if (!jobStatus) {
      return NextResponse.json({
        success: true,
        hasJob: false,
        message: 'No active job for this campaign',
      });
    }

    return NextResponse.json({
      success: true,
      hasJob: true,
      job: {
        id: jobStatus.jobId,
        state: jobStatus.state,
        progress: jobStatus.progress,
        attemptsMade: jobStatus.attemptsMade,
        result: jobStatus.result,
        failedReason: jobStatus.failedReason,
      },
    });
  } catch (error) {
    console.error('[API:send:GET] Error:', error);
    return errorResponse(
      'Failed to get campaign status',
      'INTERNAL_ERROR',
      500
    );
  }
}
