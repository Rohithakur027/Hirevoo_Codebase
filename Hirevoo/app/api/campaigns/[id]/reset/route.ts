/**
 * app/api/campaigns/[id]/reset/route.ts
 * 
 * Endpoint to reset a stuck or failed campaign back to 'ready' status.
 * This allows users to retry sending a campaign that got stuck or partially failed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '@/lib/auth';
import { getUTCTimeISO } from '@/lib/date-helpers';

// ============================================================
// DATABASE CLIENT
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface ResetOptions {
  // If true, reset all contacts including 'sent' ones (full resend)
  resetSentContacts?: boolean;
  // If true, only reset failed contacts (retry failures only)
  resetFailedOnly?: boolean;
}

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

// ============================================================
// POST /api/campaigns/[id]/reset - Reset a campaign
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: campaignId } = await params;
    console.log(`[API:reset] Reset request for campaign: ${campaignId}`);

    // 1. Authenticate user
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return errorResponse(
        'You must be logged in to reset campaigns',
        'UNAUTHORIZED',
        401
      );
    }

    // 2. Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (userError || !user) {
      return errorResponse(
        'User account not found',
        'USER_NOT_FOUND',
        404
      );
    }

    // 3. Get campaign and verify ownership
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

    if (campaign.user_id !== user.id) {
      return errorResponse(
        'You do not have permission to reset this campaign',
        'FORBIDDEN',
        403
      );
    }

    // 4. Parse reset options from body
    let options: ResetOptions = {};
    try {
      options = await request.json();
    } catch {
      // No body provided, use defaults
    }

    console.log(`[API:reset] Current status: ${campaign.status}, Options:`, options);

    // 5. Get current contact stats
    const { data: contactStats } = await supabase
      .from('campaign_contacts')
      .select('status')
      .eq('campaign_id', campaignId);

    const stats = {
      total: contactStats?.length || 0,
      pending: contactStats?.filter(c => c.status === 'pending').length || 0,
      sent: contactStats?.filter(c => c.status === 'sent').length || 0,
      failed: contactStats?.filter(c => c.status === 'failed').length || 0,
    };

    console.log(`[API:reset] Contact stats before reset:`, stats);

    // 6. Reset campaign status
    const { error: campaignUpdateError } = await supabase
      .from('campaigns')
      .update({
        status: 'ready',
        sent_at: null,
        updated_at: getUTCTimeISO(),
      })
      .eq('id', campaignId);

    if (campaignUpdateError) {
      console.error('[API:reset] Failed to reset campaign status:', campaignUpdateError);
      return errorResponse(
        'Failed to reset campaign status',
        'DATABASE_ERROR',
        500
      );
    }

    // 7. Reset contacts based on options
    let contactsReset = 0;

    if (options.resetSentContacts) {
      // Reset ALL contacts (full resend)
      const { data: resetResult, error: contactsError } = await supabase
        .from('campaign_contacts')
        .update({
          status: 'pending',
          sent_at: null,
          error_message: null,
        })
        .eq('campaign_id', campaignId)
        .select('id');

      if (contactsError) {
        console.error('[API:reset] Failed to reset contacts:', contactsError);
      } else {
        contactsReset = resetResult?.length || 0;
      }
    } else if (options.resetFailedOnly) {
      // Reset only failed contacts (retry failures)
      const { data: resetResult, error: contactsError } = await supabase
        .from('campaign_contacts')
        .update({
          status: 'pending',
          error_message: null,
        })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed')
        .select('id');

      if (contactsError) {
        console.error('[API:reset] Failed to reset failed contacts:', contactsError);
      } else {
        contactsReset = resetResult?.length || 0;
      }
    } else {
      // Default: Reset pending and failed contacts (not sent)
      const { data: resetResult, error: contactsError } = await supabase
        .from('campaign_contacts')
        .update({
          status: 'pending',
          error_message: null,
        })
        .eq('campaign_id', campaignId)
        .neq('status', 'sent')
        .select('id');

      if (contactsError) {
        console.error('[API:reset] Failed to reset contacts:', contactsError);
      } else {
        contactsReset = resetResult?.length || 0;
      }
    }

    // 8. Get updated stats
    const { data: newContactStats } = await supabase
      .from('campaign_contacts')
      .select('status')
      .eq('campaign_id', campaignId);

    const newStats = {
      total: newContactStats?.length || 0,
      pending: newContactStats?.filter(c => c.status === 'pending').length || 0,
      sent: newContactStats?.filter(c => c.status === 'sent').length || 0,
      failed: newContactStats?.filter(c => c.status === 'failed').length || 0,
    };

    console.log(`[API:reset] ✅ Campaign reset successfully. Contacts reset: ${contactsReset}`);
    console.log(`[API:reset] Contact stats after reset:`, newStats);

    return NextResponse.json({
      success: true,
      message: 'Campaign reset successfully',
      campaign: {
        id: campaignId,
        name: campaign.name,
        previousStatus: campaign.status,
        newStatus: 'ready',
      },
      contacts: {
        totalReset: contactsReset,
        before: stats,
        after: newStats,
      },
    });

  } catch (error) {
    console.error('[API:reset] Unexpected error:', error);
    return errorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
  }
}

// ============================================================
// GET /api/campaigns/[id]/reset - Get campaign reset status info
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: campaignId } = await params;

    // 1. Authenticate user
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return errorResponse(
        'You must be logged in',
        'UNAUTHORIZED',
        401
      );
    }

    // 2. Get user and verify ownership
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (!user) {
      return errorResponse('User not found', 'USER_NOT_FOUND', 404);
    }

    // 3. Get campaign
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, user_id, name, status, updated_at')
      .eq('id', campaignId)
      .single();

    if (!campaign || campaign.user_id !== user.id) {
      return errorResponse('Campaign not found', 'CAMPAIGN_NOT_FOUND', 404);
    }

    // 4. Get contact stats
    const { data: contacts } = await supabase
      .from('campaign_contacts')
      .select('status')
      .eq('campaign_id', campaignId);

    const stats = {
      total: contacts?.length || 0,
      pending: contacts?.filter(c => c.status === 'pending').length || 0,
      sent: contacts?.filter(c => c.status === 'sent').length || 0,
      failed: contacts?.filter(c => c.status === 'failed').length || 0,
    };

    // 5. Determine if campaign can/should be reset
    const canReset = ['sending', 'sent', 'failed', 'ready'].includes(campaign.status);
    const isStuck = campaign.status === 'sending' &&
      campaign.updated_at &&
      (Date.now() - new Date(campaign.updated_at).getTime() > 10 * 60 * 1000); // 10 minutes

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        updatedAt: campaign.updated_at,
      },
      contacts: stats,
      canReset,
      isStuck,
      resetOptions: {
        default: 'Reset failed/pending contacts only (preserves sent emails)',
        resetFailedOnly: 'Reset only failed contacts (retry failures)',
        resetSentContacts: 'Reset ALL contacts including sent (full resend)',
      },
    });

  } catch (error) {
    console.error('[API:reset:GET] Error:', error);
    return errorResponse('An error occurred', 'INTERNAL_ERROR', 500);
  }
}
