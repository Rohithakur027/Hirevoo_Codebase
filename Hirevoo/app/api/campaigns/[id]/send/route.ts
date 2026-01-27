/**
 * app/api/campaigns/[id]/send/route.ts
 * 
 * This endpoint handles campaign sending with:
 * - Stuck campaign detection and recovery
 * - Timeout-based status reset
 * - Comprehensive error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth';
import { getUTCTimeISO } from '@/lib/date-helpers';

// ============================================================
// DATABASE CLIENT (Global Instance)
// ============================================================

// This instance is created once and reused. 
// It uses the Service Role Key, so it bypasses RLS.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// CONFIGURATION
// ============================================================

const DAILY_LIMITS: Record<string, number> = {
  free: 10,
  pro: 25,
  promax: 50,
};

// Maximum time a campaign can be in 'sending' state before considered stuck (30 minutes)
const MAX_SENDING_DURATION_MS = 30 * 60 * 1000;

// Maximum time a campaign can be in 'sending' state with no progress (10 minutes)
const STUCK_CAMPAIGN_TIMEOUT_MS = 10 * 60 * 1000;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function errorResponse(
  error: string,
  code: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { success: false, error, code, details },
    { status }
  );
}

/**
 * Checks if a campaign is stuck in 'sending' state and should be reset.
 * A campaign is considered stuck if:
 * 1. It has been in 'sending' state for longer than MAX_SENDING_DURATION_MS
 * 2. OR the bg-worker job is no longer active
 */
async function checkAndRecoverStuckCampaign(
  campaignId: string,
  updatedAt: string | null
): Promise<{ isStuck: boolean; reason?: string }> {
  // Check if campaign has been in 'sending' state too long
  if (updatedAt) {
    const updatedAtTime = new Date(updatedAt).getTime();
    const timeSinceUpdate = Date.now() - updatedAtTime;

    if (timeSinceUpdate > MAX_SENDING_DURATION_MS) {
      console.log(`[API:send] Campaign ${campaignId} stuck - exceeded max duration (${Math.round(timeSinceUpdate / 60000)} minutes)`);
      return {
        isStuck: true,
        reason: `Campaign has been in 'sending' state for ${Math.round(timeSinceUpdate / 60000)} minutes without completing`
      };
    }
  }

  // Try to check bg-worker job status
  try {
    const bgWorkerUrl = process.env.NEXT_PUBLIC_BG_WORKER_URL || 'http://localhost:3001';
    const jobStatusResponse = await fetch(`${bgWorkerUrl}/api/campaigns/${campaignId}/send`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.BG_WORKER_API_KEY || 'internal-key'}`,
      },
    });

    if (jobStatusResponse.ok) {
      const jobStatus = await jobStatusResponse.json();

      // If no active job exists, campaign is stuck
      if (!jobStatus.hasJob) {
        console.log(`[API:send] Campaign ${campaignId} stuck - no active job in queue`);
        return {
          isStuck: true,
          reason: 'No active background job found for this campaign'
        };
      }

      // If job exists but is completed/failed, campaign is stuck
      if (jobStatus.job && ['completed', 'failed'].includes(jobStatus.job.state)) {
        console.log(`[API:send] Campaign ${campaignId} stuck - job state is ${jobStatus.job.state}`);
        return {
          isStuck: true,
          reason: `Background job already ${jobStatus.job.state}`
        };
      }
    }
  } catch (error) {
    console.warn(`[API:send] Could not check bg-worker job status:`, error);
    // If we can't check job status and campaign has been stuck for a while, consider it stuck
    if (updatedAt) {
      const timeSinceUpdate = Date.now() - new Date(updatedAt).getTime();
      if (timeSinceUpdate > STUCK_CAMPAIGN_TIMEOUT_MS) {
        return {
          isStuck: true,
          reason: 'Cannot verify job status and campaign appears stuck'
        };
      }
    }
  }

  return { isStuck: false };
}

/**
 * Resets a stuck campaign to 'ready' status and resets pending contacts
 */
async function resetStuckCampaign(campaignId: string): Promise<void> {
  console.log(`[API:send] Resetting stuck campaign ${campaignId}...`);

  // Reset campaign status to 'ready'
  const { error: campaignError } = await supabase
    .from('campaigns')
    .update({
      status: 'ready',
      updated_at: getUTCTimeISO()
    })
    .eq('id', campaignId);

  if (campaignError) {
    console.error(`[API:send] Failed to reset campaign status:`, campaignError);
    throw new Error('Failed to reset campaign status');
  }

  // Reset any contacts that were not sent (keep 'sent' ones as-is)
  const { error: contactsError } = await supabase
    .from('campaign_contacts')
    .update({
      status: 'pending',
      error_message: null
    })
    .eq('campaign_id', campaignId)
    .neq('status', 'sent'); // Only reset non-sent contacts

  if (contactsError) {
    console.error(`[API:send] Failed to reset contact statuses:`, contactsError);
    // Don't throw - campaign status was reset, contacts can be manually fixed
  }

  console.log(`[API:send] Successfully reset stuck campaign ${campaignId}`);
}

// ============================================================
// MAIN ENDPOINT
// ============================================================

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  console.log(`[API:send] Raw params:`, params);

  // Extract campaign ID from URL path as fallback
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const campaignIdFromPath = pathSegments[pathSegments.length - 2]; // Get [id] from /api/campaigns/[id]/send

  const campaignId = params?.id || campaignIdFromPath;
  console.log(`[API:send] Campaign ID from params: ${params?.id}, from path: ${campaignIdFromPath}`);

  if (!campaignId) {
    console.error(`[API:send] No campaign ID provided`);
    return errorResponse(
      'Campaign ID is required',
      'MISSING_CAMPAIGN_ID',
      400
    );
  }

  console.log(`[API:send] Processing send request for campaign: ${campaignId}`);

  try {
    // ─────────────────────────────────────────────────────────
    // STEP 1: AUTHENTICATE USER
    // ─────────────────────────────────────────────────────────

    const session = await getServerSession(authOptions);
    console.log(`[API:send] Session:`, session ? 'Found' : 'Not found');

    // Type guard for session user
    if (!session?.user?.email) {
      return errorResponse(
        'You must be logged in to send campaigns',
        'UNAUTHORIZED',
        401
      );
    }

    // [FIX]: This now correctly uses the global 'supabase' variable defined at the top
    const { data: dbUser, error: dbUserError } = await supabase
      .from('users')
      .select('id, plan')
      .eq('email', session.user.email)
      .single();

    if (dbUserError || !dbUser) {
      console.error('[API:send] User lookup failed:', dbUserError);
      return errorResponse(
        'User account not found',
        'USER_NOT_FOUND',
        404
      );
    }

    const userId = dbUser.id;
    const userPlan = dbUser.plan || 'free';

    console.log(`[API:send] Database User ID: ${userId}, Plan: ${userPlan}`);

    // [FIX]: REMOVED REDUNDANT 'const supabase = ...' HERE
    // This was causing the ReferenceError by shadowing the global variable.

    // ─────────────────────────────────────────────────────────
    // STEP 2: VALIDATE CAMPAIGN EXISTS AND BELONGS TO USER
    // ─────────────────────────────────────────────────────────

    console.log(`[API:send] Looking for campaign: ${campaignId} owned by user: ${userId}`);

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id, name, status, updated_at')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (campaignError) {
      console.log(`[API:send] Campaign lookup error:`, campaignError);
    } else {
      console.log(`[API:send] Found campaign: ${campaign?.name} (${campaign?.status})`);
    }

    if (campaignError || !campaign) {
      console.error('[API:send] Campaign not found:', campaignError);
      return errorResponse(
        'Campaign not found or access denied',
        'CAMPAIGN_NOT_FOUND',
        404
      );
    }

    // ─────────────────────────────────────────────────────────
    // STEP 2.5: HANDLE STUCK CAMPAIGNS
    // ─────────────────────────────────────────────────────────
    // Check if campaign is stuck in 'sending' state and recover if needed

    if (campaign.status === 'sending') {
      console.log(`[API:send] Campaign is in 'sending' state, checking if stuck...`);

      const { isStuck, reason } = await checkAndRecoverStuckCampaign(
        campaignId,
        campaign.updated_at
      );

      if (isStuck) {
        console.log(`[API:send] Campaign is stuck: ${reason}. Attempting recovery...`);

        try {
          await resetStuckCampaign(campaignId);
          console.log(`[API:send] Successfully recovered stuck campaign. Proceeding with send...`);
          // Continue with the send flow - campaign is now 'ready'
        } catch (resetError) {
          console.error(`[API:send] Failed to recover stuck campaign:`, resetError);
          return errorResponse(
            'Campaign appears stuck. Please try again or contact support.',
            'CAMPAIGN_STUCK',
            409,
            { reason, suggestion: 'Wait a few minutes and try again' }
          );
        }
      } else {
        // Campaign is actively being sent, don't interfere
        return errorResponse(
          'Campaign is currently being sent. Please wait for it to complete.',
          'CAMPAIGN_ALREADY_SENDING',
          409,
          {
            status: 'sending',
            suggestion: 'Check the campaign status or wait for completion'
          }
        );
      }
    }

    if (campaign.status === 'sent') {
      // Check if there are any pending contacts (partial send)
      const { count: remainingPending } = await supabase
        .from('campaign_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending');

      if (remainingPending && remainingPending > 0) {
        console.log(`[API:send] Campaign marked as 'sent' but has ${remainingPending} pending contacts. Resetting...`);
        await supabase
          .from('campaigns')
          .update({ status: 'ready', updated_at: getUTCTimeISO() })
          .eq('id', campaignId);
        // Continue with send
      } else {
        return errorResponse(
          'Campaign has already been sent. Create a new campaign to send again.',
          'CAMPAIGN_ALREADY_SENT',
          409,
          {
            status: 'sent',
            suggestion: 'Create a new campaign or duplicate this one to send again'
          }
        );
      }
    }

    console.log(`[API:send] Campaign found: "${campaign.name}", Status: ${campaign.status}`);

    // ─────────────────────────────────────────────────────────
    // STEP 3: VALIDATE GMAIL CONNECTION
    // ─────────────────────────────────────────────────────────

    const { data: user, error: gmailError } = await supabase
      .from('users')
      .select('gmail_connected')
      .eq('id', userId)
      .single();

    if (gmailError || !user?.gmail_connected) {
      console.error('[API:send] Gmail not connected:', gmailError);
      return errorResponse(
        'Gmail account not connected. Please connect your Gmail account first.',
        'GMAIL_NOT_CONNECTED',
        400
      );
    }

    console.log('[API:send] Gmail connected: ✅');

    // ─────────────────────────────────────────────────────────
    // STEP 4: GET PENDING EMAILS COUNT
    // ─────────────────────────────────────────────────────────

    const { count: pendingEmails, error: countError } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (countError) {
      console.error('[API:send] Error counting pending emails:', countError);
      return errorResponse(
        'Failed to check campaign emails',
        'DATABASE_ERROR',
        500
      );
    }

    if (!pendingEmails || pendingEmails === 0) {
      return errorResponse(
        'No pending emails to send in this campaign',
        'NO_PENDING_EMAILS',
        400
      );
    }

    console.log(`[API:send] Pending emails: ${pendingEmails}`);

    // ─────────────────────────────────────────────────────────
    // STEP 5: CHECK DAILY LIMITS
    // ─────────────────────────────────────────────────────────

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

    if (limitError) {
      console.error('[API:send] Error checking daily limits:', limitError);
      return errorResponse(
        'Failed to check sending limits',
        'DATABASE_ERROR',
        500
      );
    }

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
    }

    console.log(
      `[API:send] Daily limit: ${emailsSentToday}/${dailyLimit} ` +
      `(${remainingQuota} remaining)`
    );

    // ─────────────────────────────────────────────────────────
    // STEP 6: QUEUE THE CAMPAIGN JOB
    // ─────────────────────────────────────────────────────────

    console.log(`[API:send] Queuing campaign...`);

    // Queue job to bg-worker via internal API call
    const bgWorkerUrl = process.env.NEXT_PUBLIC_BG_WORKER_URL || 'http://localhost:3001';

    // Note: Ensure your bg-worker endpoint allows POST requests and handles the body correctly
    const queueResponse = await fetch(`${bgWorkerUrl}/api/campaigns/${campaignId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BG_WORKER_API_KEY || 'internal-key'}`,
      },
      body: JSON.stringify({
        userId,
        userPlan,
      }),
    });

    if (!queueResponse.ok) {
      const errorData = await queueResponse.json().catch(() => ({}));
      console.error('[API:send] Failed to queue job:', errorData);
      return errorResponse(
        'Failed to queue campaign for sending',
        'QUEUE_ERROR',
        500
      );
    }

    const queueResult = await queueResponse.json();
    console.log(`[API:send] ✅ Job queued: ${queueResult.jobId}, Position: ${queueResult.queuePosition}`);

    // ─────────────────────────────────────────────────────────
    // STEP 7: UPDATE CAMPAIGN STATUS
    // ─────────────────────────────────────────────────────────

    // Mark as 'sending' so UI shows correct state
    await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    // ─────────────────────────────────────────────────────────
    // STEP 8: RETURN SUCCESS
    // ─────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      message: 'Campaign queued for sending',
      jobId: queueResult.jobId,
      queuePosition: queueResult.queuePosition,
      pendingEmails,
      estimatedDurationSeconds: Math.ceil(pendingEmails * 2), // Rough estimate: 2s per email
    });

  } catch (error) {
    console.error('[API:send] Unexpected error:', error);
    return errorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
  }
}