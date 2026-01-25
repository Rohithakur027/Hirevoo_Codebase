import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- Helper Functions ---

// Placeholder decryption function - REPLACE with your actual decryption logic
// Ensure this matches how you encrypt tokens in your application
function decrypt(text: string): string {
    // In a real app, use crypto to decrypt using your ENCRYPTION_KEY
    // const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY!), iv);
    // ...
    // For now, returning as is or add simple logic if needed. 
    // Assuming the DB stores it essentially ready to use or reversed for demo.
    return text;
}

/**
 * Creates a MIME message properly encoded for Gmail API (Base64URL).
 * Implements multipart/alternative to support both HTML and Plain Text.
 */
function createMimeMessage(to: string, subject: string, htmlContent: string): string {
    const boundary = `boundary_${Date.now().toString(16)}`;

    // Create plain text fallback (simple strip tags for robustness)
    const plainText = htmlContent.replace(/<[^>]+>/g, '');

    const messageParts = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        plainText, // In a real scenario, ensure quoted-printable encoding for body too if complex chars
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        htmlContent,
        '',
        `--${boundary}--`
    ];

    const emailRaw = messageParts.join('\r\n');

    // encode Base64URL (RFC 4648)
    const encodedEmail = Buffer.from(emailRaw)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return encodedEmail;
}

// --- API Route ---

export async function POST(req: Request) {
    try {
        const { to, subject, htmlContent } = await req.json();

        if (!to || !subject || !htmlContent) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Initialize Supabase Admin Client to fetch secrets
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 2. Retrieve the User's Encrypted Refresh Token
        // Ideally, get the userId from the session. 
        // For this implementation, we assume the user is authenticated 
        // and we lookup their token. 
        // DEMO: Querying the first available token or specific testing logic
        // In production: const { data: { user } } = await supabase.auth.getUser();

        // We'll fallback to a known test user ID or just pick one for the "Backend-Delegate" demo
        const { data: tokenData, error: dbError } = await supabase
            .from('google_auth_tokens')
            .select('refresh_token')
            .limit(1)
            .single();

        if (dbError || !tokenData) {
            console.error("Database Error:", dbError);
            return NextResponse.json({ error: 'Failed to retrieve auth token' }, { status: 401 });
        }

        const refreshToken = decrypt(tokenData.refresh_token);

        // 3. Initialize Google OAuth2 Client
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        // 4. Set Credentials (Refresh Token) 
        // The library automatically handles access token refresh using this.
        oauth2Client.setCredentials({
            refresh_token: refreshToken
        });

        // 5. Initialize Gmail API
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // 6. Construct and Send Email
        const rawMessage = createMimeMessage(to, subject, htmlContent);

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: rawMessage,
            },
        });

        return NextResponse.json({ success: true, messageId: res.data.id });

    } catch (error: any) {
        console.error('Gmail API Error:', error);

        // Handle Token Errors (Revoked/Invalid)
        if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
            return NextResponse.json({ error: 'Google Access Token Expired/Revoked' }, { status: 401 });
        }

        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
