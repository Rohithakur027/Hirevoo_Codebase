import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { decrypt } from "@/lib/encryption";

// This is the endpoint that Google Cloud Pub/Sub will POST to
export async function POST(request: Request) {
    try {
        // 1. Parse the incoming request body
        // Google Pub/Sub sends a JSON body with a "message" field
        const body = await request.json();

        // 2. Validate basic structure
        if (!body.message || !body.message.data) {
            console.error('Invalid Pub/Sub message format');
            return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
        }

        // 3. Decode the Data
        // The 'data' field is base64-encoded JSON string
        const encodedData = body.message.data;
        const decodedData = Buffer.from(encodedData, 'base64').toString('utf-8');
        const notification = JSON.parse(decodedData);

        // Expected notification format from Gmail:
        // {
        //   "emailAddress": "user@example.com",
        //   "historyId": "12345678"
        // }

        console.log('Received Gmail Update:', notification);

        const { emailAddress, historyId } = notification;

        if (!emailAddress || !historyId) {
            console.error('Missing emailAddress or historyId in notification');
            return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }

        // 4. Processing (Ideally offload to a background queue)
        // For now, we will just log it. In a real app, you would:
        // await queue.add('sync-gmail-history', { emailAddress, historyId });

        // Mock processing trigger
        await triggerHistorySync(emailAddress, historyId);

        // 5. Acknowledge the message immediately
        // Returning 200 tells Pub/Sub the message was received successfully.
        // If we fail to return 200, Pub/Sub will retry sending this message.
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error);
        // Even on error, we might want to return 200 to stop retries if the error is unrecoverable (e.g. bad JSON)
        // But for transient errors, returning 500 triggers a retry.
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


// Helper to strip HTML tags for plain text body
function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '');
}

async function triggerHistorySync(email: string, historyId: string) {
    console.log(`[Background Job] Starting sync for ${email} from historyId: ${historyId}`);

    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // 2. Secure Token Retrieval
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('gmail_refresh_token, gmail_refresh_token_salt, gmail_refresh_token_content, gmail_refresh_token_tag, id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            console.error('[triggerHistorySync] User not found for:', email);
            return;
        }

        let refreshToken = user.gmail_refresh_token;

        // Try decrypting if we have the new columns
        if (user.gmail_refresh_token_content && user.gmail_refresh_token_salt && user.gmail_refresh_token_tag) {
            try {
                refreshToken = decrypt({
                    salt: user.gmail_refresh_token_salt,
                    content: user.gmail_refresh_token_content,
                    tag: user.gmail_refresh_token_tag
                });
            } catch (e) {
                console.error('[triggerHistorySync] Failed to decrypt token:', e);
                // Fallback to legacy plain text if decryption fails but old token exists
                if (!refreshToken) return;
            }
        }

        if (!refreshToken) {
            console.error('[triggerHistorySync] No valid refresh token found for:', email);
            return;
        }

        // 3. Google Authentication
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // 4. Fetching Data - History List
        const historyResponse = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: historyId,
            historyTypes: ['messageAdded'],
        });

        const historyList = historyResponse.data.history;
        if (!historyList || historyList.length === 0) {
            console.log('[triggerHistorySync] No new messages found in history.');
            return;
        }

        for (const historyItem of historyList) {
            if (historyItem.messagesAdded) {
                for (const messageAdded of historyItem.messagesAdded) {
                    const messageId = messageAdded.message?.id;
                    if (!messageId) continue;

                    // 5. Fetch Full Message Details
                    const messageDetail = await gmail.users.messages.get({
                        userId: 'me',
                        id: messageId,
                        format: 'full',
                    });

                    const msgData = messageDetail.data;
                    const threadId = msgData.threadId;

                    // Extract Headers
                    const headers = msgData.payload?.headers;
                    const fromHeader = headers?.find((h: any) => h.name === 'From')?.value || '';

                    // Determine Direction
                    // If the sender's email is NOT the user's email, it's INBOUND.
                    // We assume 'email' param is the user's email.
                    const isOutbound = fromHeader.includes(email);
                    const direction = isOutbound ? 'outbound' : 'inbound';

                    // 6. Sanitization & Parsing
                    let bodyText = '';
                    let htmlContent = '';
                    let hasRichContent = false;

                    // Helper to recursively find parts
                    const findBody = (parts: any[]) => {
                        for (const part of parts) {
                            if (part.mimeType === 'text/plain' && part.body?.data) {
                                bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
                            } else if (part.mimeType === 'text/html' && part.body?.data) {
                                htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
                            } else if (part.parts) {
                                findBody(part.parts);
                            }
                        }
                    };

                    if (msgData.payload?.parts) {
                        findBody(msgData.payload.parts);
                    } else if (msgData.payload?.body?.data) {
                        // Single part message
                        const data = Buffer.from(msgData.payload.body.data, 'base64').toString('utf-8');
                        if (msgData.payload.mimeType === 'text/html') {
                            htmlContent = data;
                        } else {
                            bodyText = data;
                        }
                    }

                    // Fallback: If no plain text, strip HTML
                    if (!bodyText && htmlContent) {
                        bodyText = stripHtml(htmlContent);
                    }

                    // Rich Content Detection
                    // Check for attachments or specific tags in HTML
                    const hasAttachments = msgData.payload?.parts?.some(
                        (p: any) => p.filename && p.filename.length > 0
                    );
                    const hasRichTags = htmlContent && (htmlContent.includes('<img') || htmlContent.includes('<table'));

                    hasRichContent = !!(hasAttachments || hasRichTags);

                    console.log(`[triggerHistorySync] Processing Msg ID: ${messageId}, Thread: ${threadId}, Direction: ${direction}`);

                    // 7. Database Writes

                    // Step A: Find the parent campaign_contact
                    // We try to match by gmail_thread_id first.
                    let { data: contactData, error: contactError } = await supabaseAdmin
                        .from('campaign_contacts')
                        .select('id, status')
                        .eq('gmail_thread_id', threadId)
                        .maybeSingle();

                    // Fallback: If threading wasn't captured, try to find by email for this user
                    // (Only for inbound, as we want to find WHO sent this)
                    if (!contactData && !isOutbound) {
                        const fromEmailMatch = fromHeader.match(/<(.+)>/);
                        const cleanFromEmail = fromEmailMatch ? fromEmailMatch[1] : fromHeader;

                        // Find a contact with this email
                        // We need to join with campaign_contacts. 
                        // Note: detailed join logic is complex here, for now simpler approach:
                        // 1. Find contact ID
                        const { data: contacts, error: cErr } = await supabaseAdmin
                            .from('contacts')
                            .select('id')
                            .eq('email', cleanFromEmail)
                            .eq('user_id', user.id) // Ensure it belongs to this user
                            .limit(1);

                        if (contacts && contacts.length > 0) {
                            const contactId = contacts[0].id;
                            // 2. Find latest campaign_contact for this contact
                            const { data: ccData } = await supabaseAdmin
                                .from('campaign_contacts')
                                .select('id, status')
                                .eq('contact_id', contactId)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();

                            if (ccData) {
                                contactData = ccData;
                                // Ideally update formatting to link threadId for future
                                await supabaseAdmin
                                    .from('campaign_contacts')
                                    .update({ gmail_thread_id: threadId })
                                    .eq('id', ccData.id);
                            }
                        }
                    }

                    if (contactData) {
                        // Step B: Insert into chat_messages
                        // Check if message already exists to verify idempotency
                        const { data: existingMsg } = await supabaseAdmin
                            .from('chat_messages')
                            .select('id')
                            .eq('gmail_message_id', messageId)
                            .maybeSingle();

                        if (!existingMsg) {
                            await supabaseAdmin
                                .from('chat_messages')
                                .insert({
                                    campaign_contact_id: contactData.id,
                                    gmail_message_id: messageId,
                                    direction: direction,
                                    body_text: bodyText,
                                    has_rich_content: hasRichContent,
                                    // created_at is usually auto, but we can set it
                                });

                            console.log(`[triggerHistorySync] Saved chat message for contact ${contactData.id}`);

                            // Step C: Update status if Inbound
                            if (direction === 'inbound' && contactData.status !== 'replied') {
                                await supabaseAdmin
                                    .from('campaign_contacts')
                                    .update({
                                        status: 'replied',
                                        replied_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString()
                                    })
                                    .eq('id', contactData.id);
                                console.log(`[triggerHistorySync] Marked contact ${contactData.id} as replied`);
                            }
                        } else {
                            console.log(`[triggerHistorySync] Message ${messageId} already exists, skipping.`);
                        }
                    } else {
                        console.log(`[triggerHistorySync] Could not find linked campaign_contact for message ${messageId}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('[triggerHistorySync] Error processing history:', error);
    }
}

