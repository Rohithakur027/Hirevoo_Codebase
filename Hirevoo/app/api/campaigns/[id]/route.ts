/**
 * app/api/campaigns/[id]/route.ts
 *
 * Single campaign API endpoint
 * Handles getting, updating, and deleting individual campaigns
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { authOptions } from '@/lib/auth';
import { getUTCTimeISO } from '@/lib/date-helpers';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface UpdateCampaignRequest {
  name?: string;
  status?: string;
  contacts?: Array<{
    id: string;
    emailSubject?: string;
    emailBody?: string;
  }>;
}

interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function errorResponse(
  error: string,
  code: string,
  status: number
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false, error, code },
    { status }
  );
}

// ============================================================
// GET /api/campaigns/[id] - Get a single campaign with contacts
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
        'You must be logged in to view campaigns',
        'UNAUTHORIZED',
        401
      );
    }

    // 2. Get user from database
    const supabase = createServerSupabaseClient();

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

    // 3. Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return errorResponse(
        'Campaign not found',
        'CAMPAIGN_NOT_FOUND',
        404
      );
    }

    // 4. Verify ownership
    if (campaign.user_id !== user.id) {
      return errorResponse(
        'You do not have permission to view this campaign',
        'FORBIDDEN',
        403
      );
    }

    // 5. Get campaign contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('campaign_contacts')
      .select(`
        *,
        contacts (
          name,
          email,
          company,
          role
        )
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (contactsError) {
      console.error('[API:campaigns] Contacts fetch failed:', contactsError);
    }

    // 6. Format response
    const formattedContacts = (contacts || []).map((c: any) => ({
      id: c.contact_id || c.id,
      campaignContactId: c.id,
      name: c.contacts?.name || '',
      email: c.contacts?.email || '',
      company: c.contacts?.company || undefined,
      role: c.contacts?.role || undefined,
      emailStatus: c.status === 'sent' ? 'done' : c.status === 'pending' ? 'draft' : 'draft',
      emailSubject: c.email_subject || '',
      emailBody: c.email_body || '',
      sentAt: c.sent_at,
      error: c.error_message,
      gmailThreadId: c.gmail_thread_id,
    }));

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        contacts: formattedContacts,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
        sentAt: campaign.sent_at,
      },
    });
  } catch (error) {
    console.error('[API:campaigns] Unexpected error:', error);
    return errorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
  }
}

// ============================================================
// PATCH /api/campaigns/[id] - Update a campaign
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: campaignId } = await params;

    // 1. Authenticate user
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return errorResponse(
        'You must be logged in to update campaigns',
        'UNAUTHORIZED',
        401
      );
    }

    // 2. Get user from database
    const supabase = createServerSupabaseClient();

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
      .select('id, user_id, status')
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
        'You do not have permission to update this campaign',
        'FORBIDDEN',
        403
      );
    }

    // 4. Parse request body
    const body: UpdateCampaignRequest = await request.json();

    // 5. Update campaign details if provided
    if (body.name || body.status) {
      const updateData: any = {
        updated_at: getUTCTimeISO(),
      };

      if (body.name) updateData.name = body.name;
      if (body.status) updateData.status = body.status;

      const { error: updateError } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', campaignId);

      if (updateError) {
        console.error('[API:campaigns] Update failed:', updateError);
        return errorResponse(
          'Failed to update campaign',
          'DATABASE_ERROR',
          500
        );
      }
    }

    // 6. Update contacts if provided
    if (body.contacts && body.contacts.length > 0) {
      console.log(`[API:campaigns] Updating ${body.contacts.length} contacts for campaign ${campaignId}`);
      for (const contact of body.contacts) {
        const contactUpdateData: any = {
          updated_at: getUTCTimeISO(),
        };

        if (contact.emailSubject !== undefined) {
          contactUpdateData.email_subject = contact.emailSubject;
        }
        if (contact.emailBody !== undefined) {
          contactUpdateData.email_body = contact.emailBody;
        }

        const { error: contactUpdateError, count } = await supabase
          .from('campaign_contacts')
          .update(contactUpdateData, { count: 'exact' })
          .eq('campaign_id', campaignId)
          .eq('contact_id', contact.id);

        if (contactUpdateError) {
          console.error(`[API:campaigns] Failed to update contact ${contact.id}:`, contactUpdateError);
        } else if (count === 0) {
          console.warn(`[API:campaigns] No rows updated for contact_id=${contact.id} in campaign ${campaignId}`);
        } else {
          console.log(`[API:campaigns] Updated contact ${contact.id}: subject="${(contact.emailSubject || '').substring(0, 30)}...", body=${(contact.emailBody || '').length} chars`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign updated successfully',
    });
  } catch (error) {
    console.error('[API:campaigns] Unexpected error:', error);
    return errorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
  }
}

// ============================================================
// DELETE /api/campaigns/[id] - Delete a campaign
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: campaignId } = await params;

    // 1. Authenticate user
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return errorResponse(
        'You must be logged in to delete campaigns',
        'UNAUTHORIZED',
        401
      );
    }

    // 2. Get user from database
    const supabase = createServerSupabaseClient();

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
      .select('id, user_id, status')
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
        'You do not have permission to delete this campaign',
        'FORBIDDEN',
        403
      );
    }

    // 4. Prevent deletion of campaigns that are sending
    if (campaign.status === 'sending') {
      return errorResponse(
        'Cannot delete a campaign that is currently sending',
        'CAMPAIGN_SENDING',
        400
      );
    }

    // 5. Delete campaign contacts first (due to foreign key)
    await supabase
      .from('campaign_contacts')
      .delete()
      .eq('campaign_id', campaignId);

    // 6. Delete campaign
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (deleteError) {
      console.error('[API:campaigns] Delete failed:', deleteError);
      return errorResponse(
        'Failed to delete campaign',
        'DATABASE_ERROR',
        500
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    console.error('[API:campaigns] Unexpected error:', error);
    return errorResponse(
      'An unexpected error occurred',
      'INTERNAL_ERROR',
      500
    );
  }
}
