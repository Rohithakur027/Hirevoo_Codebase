/**
 * app/api/campaigns/route.ts
 *
 * Campaign CRUD API endpoint
 * Handles creating and listing campaigns with database persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { authOptions } from '@/lib/auth';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface CreateCampaignRequest {
  name: string;
  contacts: Array<{
    id: string;
    name: string;
    email: string;
    company?: string;
    role?: string;
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
// POST /api/campaigns - Create a new campaign
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return errorResponse(
        'You must be logged in to create campaigns',
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
      console.error('[API:campaigns] User lookup failed:', userError);
      return errorResponse(
        'User account not found',
        'USER_NOT_FOUND',
        404
      );
    }

    // 3. Parse request body
    const body: CreateCampaignRequest = await request.json();

    if (!body.name || !body.contacts || body.contacts.length === 0) {
      return errorResponse(
        'Campaign name and at least one contact are required',
        'INVALID_REQUEST',
        400
      );
    }

    // 4. Create campaign in database
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name: body.name,
        status: 'composing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, name, status, created_at, updated_at')
      .single();

    if (campaignError || !campaign) {
      console.error('[API:campaigns] Campaign creation failed:', campaignError);
      return errorResponse(
        'Failed to create campaign',
        'DATABASE_ERROR',
        500
      );
    }

    console.log(`[API:campaigns] Created campaign: ${campaign.id}`);

    // 5. Ensure contacts exist in contacts table and get their database IDs
    console.log(`[API:campaigns] Processing ${body.contacts.length} contacts`);

    const contactsToUpsert = body.contacts.map((contact) => ({
      user_id: user.id,
      email: contact.email,
      name: contact.name,
      company: contact.company || null,
      role: contact.role || null,
      updated_at: new Date().toISOString(),
    }));

    // Upsert contacts (insert or update on conflict)
    const { data: upsertedContacts, error: upsertError } = await supabase
      .from('contacts')
      .upsert(contactsToUpsert, {
        onConflict: 'user_id,email',
        ignoreDuplicates: false
      })
      .select('id, email');

    if (upsertError) {
      console.error('[API:campaigns] Contacts upsert failed:', upsertError);
      // Rollback: delete the campaign
      await supabase.from('campaigns').delete().eq('id', campaign.id);
      return errorResponse(
        'Failed to save contacts',
        'DATABASE_ERROR',
        500
      );
    }

    console.log(`[API:campaigns] Upserted ${upsertedContacts?.length || 0} contacts`);

    // 6. Create campaign_contacts entries with correct database contact IDs
    const contactEmailToIdMap = new Map(
      upsertedContacts?.map(c => [c.email, c.id]) || []
    );

    const campaignContactsToInsert = body.contacts.map((contact) => {
      const dbContactId = contactEmailToIdMap.get(contact.email);
      if (!dbContactId) {
        throw new Error(`Contact ID not found for email: ${contact.email}`);
      }

      return {
        campaign_id: campaign.id,
        contact_id: dbContactId,
        email_subject: contact.emailSubject || 'Introduction - Software Developer',
        email_body: contact.emailBody || `Hi ${contact.name || 'there'},

I came across your profile and I'm interested in connecting with you. I noticed your background in ${contact.role || 'your field'} and thought we might have some common interests.

I'd love to learn more about your experience and potentially explore opportunities to work together.

Best regards,
[Your Name]`,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { error: contactsError } = await supabase
      .from('campaign_contacts')
      .insert(campaignContactsToInsert);

    if (contactsError) {
      console.error('[API:campaigns] Contacts insertion failed:', contactsError);
      // Rollback: delete the campaign
      await supabase.from('campaigns').delete().eq('id', campaign.id);
      return errorResponse(
        'Failed to create campaign contacts',
        'DATABASE_ERROR',
        500
      );
    }

    console.log(`[API:campaigns] Added ${campaignContactsToInsert.length} contacts to campaign`);

    // 6. Return success with campaign data
    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        contactCount: upsertedContacts?.length || 0,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
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
// GET /api/campaigns - List user's campaigns
// ============================================================

export async function GET(request: NextRequest) {
  try {
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

    // 3. Get campaigns with contact count
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        created_at,
        updated_at,
        sent_at,
        campaign_contacts(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error('[API:campaigns] List failed:', campaignsError);
      return errorResponse(
        'Failed to fetch campaigns',
        'DATABASE_ERROR',
        500
      );
    }

    // Transform the response
    const formattedCampaigns = campaigns?.map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      contactCount: c.campaign_contacts?.[0]?.count || 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      sentAt: c.sent_at,
    })) || [];

    return NextResponse.json({
      success: true,
      campaigns: formattedCampaigns,
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
