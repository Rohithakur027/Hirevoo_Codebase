import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/emails/conversation?campaignContactId=<uuid>
 *
 * Fetches the full conversation thread for a campaign contact.
 *
 * Uses a "Split Table" UNION approach:
 * 1. Initial outbound email from `campaign_contacts`
 * 2. Subsequent replies/follow-ups from `chat_messages`
 *
 * Merges and sorts both chronologically.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const campaignContactId = searchParams.get('campaignContactId');

    if (!campaignContactId) {
        return NextResponse.json(
            { success: false, error: 'campaignContactId is required' },
            { status: 400 }
        );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const supabase = createServerSupabaseClient();

        // Auth: verify user owns this campaign contact
        const { data: campaignContact, error: ccError } = await supabase
            .from('campaign_contacts')
            .select(`
                id,
                email_body,
                sent_at,
                status,
                campaign_id,
                campaigns!inner ( user_id )
            `)
            .eq('id', campaignContactId)
            .single();

        if (ccError || !campaignContact) {
            console.error('[Conversation API] campaign_contact not found:', ccError);
            return NextResponse.json(
                { success: false, error: 'Conversation not found' },
                { status: 404 }
            );
        }

        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .single();

        if (!user || (campaignContact as any).campaigns?.user_id !== user.id) {
            return NextResponse.json(
                { success: false, error: 'Forbidden' },
                { status: 403 }
            );
        }

        // UNION query: combine initial email + all chat_messages
        // Use Supabase .rpc() for SQL UNION if available, otherwise fallback to in-memory merge
        const messages = await getChatHistory(supabase, campaignContactId, campaignContact);

        return NextResponse.json({ success: true, messages });

    } catch (error) {
        console.error('[Conversation API] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ─── Chat History: Split-Table UNION Merge ──────────────────────────────────

interface ConversationMessage {
    id: string;
    from: 'user' | 'recipient';
    content: string;
    timestamp: string;
    status?: 'sent' | 'delivered' | 'read' | 'failed';
}

/**
 * Fetches full conversation for a campaign_contact.
 * Combines initial outbound email and replies.
 * Sorted chronologically ascending.
 *
 * Tries Postgres RPC `get_chat_history` first.
 * Falls back to in-memory merge if RPC is unavailable.
 */
async function getChatHistory(
    supabase: ReturnType<typeof createServerSupabaseClient>,
    campaignContactId: string,
    campaignContact: { id: string; email_body: string | null; sent_at: string | null; status: string },
): Promise<ConversationMessage[]> {

    // Attempt 1: SQL UNION via Postgres RPC
    // Expected signature: get_chat_history(p_campaign_contact_id uuid)
    const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_chat_history', { p_campaign_contact_id: campaignContactId });

    if (!rpcError && rpcData && rpcData.length > 0) {
        return (rpcData as any[]).map(row => ({
            id: row.id,
            from: row.direction === 'outbound' ? 'user' as const : 'recipient' as const,
            content: row.content || '',
            timestamp: row.timestamp,
            status: row.direction === 'outbound' ? 'sent' as const : undefined,
        }));
    }

    // Attempt 2: Two-query in-memory merge (fallback)
    if (rpcError) {
        // RPC unavailable, proceed with fallback
        console.warn('[Conversation API] RPC get_chat_history unavailable, using fallback merge.');
    }

    const messages: ConversationMessage[] = [];

    // Part A: initial outbound email from campaign_contacts
    if (campaignContact.email_body && campaignContact.sent_at) {
        messages.push({
            id: campaignContact.id,
            from: 'user',
            content: campaignContact.email_body,
            timestamp: campaignContact.sent_at,
            status: campaignContact.status === 'replied' ? 'read'
                : campaignContact.status === 'sent' ? 'sent'
                    : campaignContact.status === 'failed' ? 'failed'
                        : 'sent',
        });
    }

    // Part B: all chat_messages (replies + follow-ups)
    const { data: chatMessages, error: cmError } = await supabase
        .from('chat_messages')
        .select('id, body_text, direction, created_at')
        .eq('campaign_contact_id', campaignContactId)
        .order('created_at', { ascending: true });

    if (cmError) {
        console.error('[Conversation API] chat_messages fetch error:', cmError);
    }

    if (chatMessages) {
        for (const msg of chatMessages) {
            messages.push({
                id: msg.id,
                from: msg.direction === 'outbound' ? 'user' : 'recipient',
                content: msg.body_text || '',
                timestamp: msg.created_at,
                status: msg.direction === 'outbound' ? 'sent' : undefined,
            });
        }
    }

    // Sort chronologically (oldest first)
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return messages;
}
