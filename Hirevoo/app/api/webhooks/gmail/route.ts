import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { decrypt } from "@/lib/encryption";
import { getUTCTimeISO } from "@/lib/date-helpers";
import fs from 'fs';
import path from 'path';

// ─── Pub/Sub Webhook Endpoint ───────────────────────────────────────────────
// Google Cloud Pub/Sub POSTs here when Gmail detects new activity.
// Strategy: "Filter-at-Gate" — check the DB BEFORE fetching any email content.

// Simple file logger
const logToFile = (message: string, isError = false) => {
    try {
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const timestamp = new Date().toISOString();
        const prefix = isError ? '[ERROR]' : '[INFO]';
        const logLine = `${timestamp} ${prefix} ${message}\n`;

        fs.appendFileSync(path.join(logDir, 'webhook.log'), logLine);

        // Also log to console for good measure, but the file is the primary target for isolation
        console.log(message);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
};

export async function POST(request: Request) {
    try {
        console.log('Received webhook request');
        const body = await request.json();

        if (!body.message?.data) {
            logToFile('[Webhook] Invalid Pub/Sub message format', true);
            return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
        }

        // Decode base64-encoded notification: { emailAddress, historyId }
        const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');
        const notification = JSON.parse(decodedData);
        const { emailAddress, historyId } = notification;

        if (!emailAddress || !historyId) {
            logToFile('[Webhook] Missing emailAddress or historyId', true);
            return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }

        logToFile(`[Webhook] Notification for ${emailAddress}, historyId: ${historyId}`);

        // Process in-band (could be offloaded to a queue in the future)
        await triggerHistorySync(emailAddress, historyId);

        // Always return 200 to acknowledge receipt (prevents Pub/Sub retries)
        return NextResponse.json({ success: true });

    } catch (error) {
        logToFile(`[Webhook] Error: ${error}`, true);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '');
}

/**
 * Extract plain text + HTML from a Gmail message payload.
 * Handles both single-part and deeply nested multipart messages.
 */
function extractBody(payload: any): { bodyText: string; htmlContent: string } {
    let bodyText = '';
    let htmlContent = '';

    const walk = (parts: any[]) => {
        for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.mimeType === 'text/html' && part.body?.data) {
                htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.parts) {
                walk(part.parts);
            }
        }
    };

    if (payload?.parts) {
        walk(payload.parts);
    } else if (payload?.body?.data) {
        const data = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        if (payload.mimeType === 'text/html') {
            htmlContent = data;
        } else {
            bodyText = data;
        }
    }

    // Fallback: strip HTML if no plain text part exists
    if (!bodyText && htmlContent) {
        bodyText = stripHtml(htmlContent);
    }

    return { bodyText, htmlContent };
}

// ─── Core Sync Logic ────────────────────────────────────────────────────────

async function triggerHistorySync(email: string, historyId: string) {
    const log = (msg: string) => logToFile(`[HistorySync] ${msg}`);
    const logErr = (msg: string, err?: unknown) => logToFile(`[HistorySync] ${msg} ${err ?? ''}`, true);

    log(`Starting for ${email}, historyId: ${historyId}`);

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // ── Step 1: Look up user & decrypt refresh token ────────────────
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, gmail_refresh_token_IV, gmail_refresh_token_content, gmail_refresh_token_tag')
            .eq('email', email)
            .single();

        if (userError || !user) {
            logErr('User not found for: ' + email);
            return;
        }

        if (!user.gmail_refresh_token_content || !user.gmail_refresh_token_IV || !user.gmail_refresh_token_tag) {
            logErr('No encrypted refresh token for: ' + email);
            return;
        }

        let refreshToken: string;
        try {
            refreshToken = decrypt({
                salt: user.gmail_refresh_token_IV,
                content: user.gmail_refresh_token_content,
                tag: user.gmail_refresh_token_tag,
            });
        } catch (e) {
            logErr('Failed to decrypt token:', e);
            return;
        }

        // ── Step 2: Authenticate with Gmail API ─────────────────────────
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // ── Step 3: Fetch history (lightweight — no message bodies yet) ─
        const historyResponse = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: historyId,
            historyTypes: ['messageAdded'],
        });

        const historyList = historyResponse.data.history;
        if (!historyList || historyList.length === 0) {
            log('No new messages in history.');
            return;
        }

        // ── Step 4: Collect unique { messageId, threadId } pairs ────────
        const pendingMessages: Array<{ messageId: string; threadId: string }> = [];

        for (const historyItem of historyList) {
            if (!historyItem.messagesAdded) continue;
            for (const added of historyItem.messagesAdded) {
                const messageId = added.message?.id;
                const threadId = added.message?.threadId;
                if (messageId && threadId) {
                    pendingMessages.push({ messageId, threadId });
                }
            }
        }

        if (pendingMessages.length === 0) {
            log('No messageAdded events with valid IDs.');
            return;
        }

        // Deduplicate by messageId (Pub/Sub can send overlapping history)
        const uniqueMessages = Array.from(
            new Map(pendingMessages.map(m => [m.messageId, m])).values()
        );

        // ── Step 5: THE GATEKEEPER — filter threadIds against our DB ────
        const uniqueThreadIds = [...new Set(uniqueMessages.map(m => m.threadId))];

        const { data: matchedContacts, error: gateError } = await supabaseAdmin
            .from('campaign_contacts')
            .select('id, status, gmail_thread_id')
            .in('gmail_thread_id', uniqueThreadIds);

        if (gateError) {
            logErr('Gatekeeper query failed:', gateError);
            return;
        }

        // Build a lookup: threadId -> campaign_contact row
        const threadToContact = new Map<string, { id: string; status: string }>();
        if (matchedContacts) {
            for (const cc of matchedContacts) {
                if (cc.gmail_thread_id) {
                    threadToContact.set(cc.gmail_thread_id, { id: cc.id, status: cc.status });
                }
            }
        }

        // Only keep messages whose thread exists in our DB
        const relevantMessages = uniqueMessages.filter(m => threadToContact.has(m.threadId));

        if (relevantMessages.length === 0) {
            log(`Gate closed: none of ${uniqueThreadIds.length} thread(s) match our campaigns.`);
            return;
        }

        log(`Gate open: ${relevantMessages.length} message(s) across ${threadToContact.size} tracked thread(s).`);

        // ── Step 6: Fetch & process each matched message ────────────────
        for (const { messageId, threadId } of relevantMessages) {
            try {
                // 6a. Idempotency check — skip if already saved
                const { data: existingMsg } = await supabaseAdmin
                    .from('chat_messages')
                    .select('id')
                    .eq('gmail_message_id', messageId)
                    .maybeSingle();

                if (existingMsg) {
                    log(`Duplicate skipped: ${messageId}`);
                    continue;
                }

                // 6b. Fetch full message from Gmail
                const messageDetail = await gmail.users.messages.get({
                    userId: 'me',
                    id: messageId,
                    format: 'full',
                });

                const msgData = messageDetail.data;

                // 6c. Determine direction
                const headers = msgData.payload?.headers;
                const fromHeader = headers?.find((h: any) => h.name === 'From')?.value || '';
                const isOutbound = fromHeader.toLowerCase().includes(email.toLowerCase());
                const direction = isOutbound ? 'outbound' : 'inbound';

                // 6d. Extract body content
                const { bodyText, htmlContent } = extractBody(msgData.payload);

                // 6e. Detect rich content (attachments, images, tables)
                const hasAttachments = msgData.payload?.parts?.some(
                    (p: any) => p.filename && p.filename.length > 0
                );
                const hasRichTags = htmlContent && (htmlContent.includes('<img') || htmlContent.includes('<table'));
                const hasRichContent = !!(hasAttachments || hasRichTags);

                // 6f. Get the linked campaign_contact
                const contactData = threadToContact.get(threadId);
                if (!contactData) continue; // Shouldn't happen after filter, but guard anyway

                log(`Processing: msgId=${messageId}, thread=${threadId}, dir=${direction}`);

                // 6g. Insert into chat_messages (with conflict guard)
                const { error: insertError } = await supabaseAdmin
                    .from('chat_messages')
                    .insert({
                        campaign_contact_id: contactData.id,
                        gmail_message_id: messageId,
                        gmail_thread_id: threadId,
                        direction,
                        body_text: bodyText,
                        has_rich_content: hasRichContent,
                    });

                if (insertError) {
                    // Unique constraint on gmail_message_id handles race conditions
                    if (insertError.code === '23505') {
                        log(`Duplicate insert caught by constraint: ${messageId}`);
                        continue;
                    }
                    logErr(`Insert failed for ${messageId}:`, insertError);
                    continue;
                }

                log(`Saved chat message for contact ${contactData.id}`);

                // 6h. Mark campaign_contact as 'replied' on first inbound
                if (direction === 'inbound' && contactData.status !== 'replied') {
                    await supabaseAdmin
                        .from('campaign_contacts')
                        .update({
                            status: 'replied',
                            replied_at: getUTCTimeISO(),
                            updated_at: getUTCTimeISO(),
                        })
                        .eq('id', contactData.id);

                    // Update local cache so we don't re-update for subsequent messages in the same batch
                    contactData.status = 'replied';
                    log(`Marked contact ${contactData.id} as replied`);
                }

            } catch (msgError) {
                // Per-message errors don't abort the entire sync
                logErr(`Failed to process message ${messageId}:`, msgError);
            }
        }

    } catch (error) {
        logErr('Fatal error during history sync:', error);
    }
}

