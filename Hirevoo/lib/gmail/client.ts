import { google, gmail_v1 } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from "@/lib/encryption";

// Supabase client for token management
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type PermissionLevel = 'SEND_ONLY' | 'FULL_ACCESS';

export interface SendEmailParams {
    to: string;
    toName?: string;
    subject: string;
    body: string;
    replyTo?: string;
}

export interface SendEmailResult {
    success: true;
    messageId: string;
    threadId: string;
}

export interface SendEmailError {
    success: false;
    errorCode: string;
    errorMessage: string;
    isRetryable: boolean;
}

export interface TokenInfo {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

export class GmailClient {
    public oauth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/auth/gmail/callback'
        );
    }

    /**
     * Generate OAuth authorization URL with appropriate scopes based on permission level
     */
    generateAuthUrl(userEmail: string, permissionLevel: PermissionLevel = 'FULL_ACCESS') {
        // Define scopes based on permission level
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ];

        if (permissionLevel === 'SEND_ONLY') {
            // Minimal scopes for sending only
            scopes.push('https://www.googleapis.com/auth/gmail.send');
        } else {
            // Full access scopes for read & write
            scopes.push(
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.modify'
            );
        }

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
            state: `${userEmail}:${permissionLevel}`, // Include permission level in state
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokensFromCode(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }

    /**
     * Get user's Gmail profile
     */
    async getUserProfile(accessToken: string) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: 'v1', auth });

        const { data } = await gmail.users.getProfile({
            userId: 'me',
        });

        return {
            email: data.emailAddress,
            messagesTotal: data.messagesTotal,
            threadsTotal: data.threadsTotal,
            historyId: data.historyId
        };
    }

    /**
     * Get user's Gmail tokens from database
     */
    async getUserTokens(userId: string): Promise<TokenInfo | null> {
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('gmail_access_token, gmail_refresh_token, gmail_refresh_token_salt, gmail_refresh_token_content, gmail_refresh_token_tag, gmail_token_expires_at')
            .eq('id', userId)
            .single();

        if (error || !user?.gmail_access_token) {
            console.error('[GmailClient] Failed to fetch tokens:', error);
            return null;
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
                console.error('[GmailClient] Failed to decrypt token:', e);
                // Fallback to legacy plain text if decryption fails but old token exists
                if (!refreshToken) return null;
            }
        } else if (!refreshToken) {
            // No legacy token and no encrypted token
            return null;
        }

        return {
            accessToken: user.gmail_access_token,
            refreshToken: refreshToken,
            expiresAt: new Date(user.gmail_token_expires_at),
        };
    }

    /**
     * Check if token is expired (with 5-minute buffer)
     */
    isTokenExpired(expiresAt: Date): boolean {
        const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
        const now = new Date();
        return expiresAt.getTime() - bufferMs < now.getTime();
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
        console.log(`[GmailClient] Refreshing token for user ${userId}`);

        this.oauth2Client.setCredentials({ refresh_token: refreshToken });

        try {
            const { credentials } = await this.oauth2Client.refreshAccessToken();

            if (!credentials.access_token) {
                throw new Error('No access token returned from refresh');
            }

            // Calculate new expiration time
            const expiresAt = credentials.expiry_date
                ? new Date(credentials.expiry_date)
                : new Date(Date.now() + 3600 * 1000);

            // Update database with new token
            const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({
                    gmail_access_token: credentials.access_token,
                    gmail_token_expires_at: expiresAt.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

            if (updateError) {
                console.error('[GmailClient] Failed to update tokens:', updateError);
                throw new Error('Failed to update Gmail tokens in database');
            }

            console.log(`[GmailClient] Token refreshed successfully, expires at: ${expiresAt.toISOString()}`);
            return credentials.access_token;
        } catch (error) {
            console.error('[GmailClient] Token refresh failed:', error);
            throw new Error('Failed to refresh Gmail token. User may need to reconnect.');
        }
    }

    /**
     * Get valid access token (refreshes if expired)
     */
    async getValidAccessToken(userId: string): Promise<string> {
        const tokens = await this.getUserTokens(userId);

        if (!tokens) {
            throw new Error('Gmail not connected. Please connect your Gmail account in Settings.');
        }

        if (this.isTokenExpired(tokens.expiresAt)) {
            console.log(`[GmailClient] Token expired for user ${userId}, refreshing...`);
            return await this.refreshAccessToken(userId, tokens.refreshToken);
        }

        return tokens.accessToken;
    }

    /**
     * Validate email address format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Create RFC 2822 formatted email message
     */
    private createEmailMessage(params: SendEmailParams, fromEmail: string): string {
        const { to, toName, subject, body, replyTo } = params;

        // Format recipient with display name if provided
        const toHeader = toName ? `"${toName}" <${to}>` : to;

        // Build email headers
        const headers: string[] = [
            `From: ${fromEmail}`,
            `To: ${toHeader}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
        ];

        // Add Reply-To header if specified
        if (replyTo) {
            headers.push(`Reply-To: ${replyTo}`);
        }

        // Combine headers with body (blank line separates headers from body)
        const message = [...headers, '', body].join('\r\n');
        return message;
    }

    /**
     * Encode email for Gmail API (base64url)
     */
    private encodeEmail(message: string): string {
        const base64 = Buffer.from(message).toString('base64');
        // Convert to base64url (URL-safe)
        return base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Send an email via Gmail API
     */
    async sendEmail(
        userId: string,
        params: SendEmailParams
    ): Promise<SendEmailResult | SendEmailError> {
        const { to, subject, body } = params;
        const logPrefix = `[GmailClient:${userId.substring(0, 8)}]`;

        console.log(`${logPrefix} Starting email send to: ${to}`);

        // Validate inputs
        if (!this.isValidEmail(to)) {
            return {
                success: false,
                errorCode: 'INVALID_RECIPIENT',
                errorMessage: `Invalid email address format: ${to}`,
                isRetryable: false,
            };
        }

        if (!subject?.trim()) {
            return {
                success: false,
                errorCode: 'VALIDATION_ERROR',
                errorMessage: 'Email subject cannot be empty',
                isRetryable: false,
            };
        }

        if (!body?.trim()) {
            return {
                success: false,
                errorCode: 'VALIDATION_ERROR',
                errorMessage: 'Email body cannot be empty',
                isRetryable: false,
            };
        }

        try {
            // Get valid access token (auto-refreshes if needed)
            const accessToken = await this.getValidAccessToken(userId);

            // Create OAuth2 client with token
            const oauth2Client = new google.auth.OAuth2();
            oauth2Client.setCredentials({ access_token: accessToken });

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Get sender's email address
            const profile = await gmail.users.getProfile({ userId: 'me' });
            const senderEmail = profile.data.emailAddress!;
            console.log(`${logPrefix} Sending from: ${senderEmail}`);

            // Create and encode email
            const emailMessage = this.createEmailMessage(params, senderEmail);
            const encodedEmail = this.encodeEmail(emailMessage);

            // Send via Gmail API
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedEmail,
                },
            });

            console.log(`${logPrefix} Email sent successfully (ID: ${response.data.id})`);

            return {
                success: true,
                messageId: response.data.id!,
                threadId: response.data.threadId!,
            };
        } catch (error: any) {
            console.error(`${logPrefix} Email send failed:`, error);
            return this.handleGmailError(error, logPrefix);
        }
    }

    /**
     * Handle Gmail API errors
     */
    private handleGmailError(error: any, logPrefix: string): SendEmailError {
        const statusCode = error.code;
        const errorReason = error.errors?.[0]?.reason;

        console.log(`${logPrefix} Gmail error - Code: ${statusCode}, Reason: ${errorReason}`);

        // Authentication expired
        if (statusCode === 401) {
            return {
                success: false,
                errorCode: 'TOKEN_EXPIRED',
                errorMessage: 'Gmail authentication expired.',
                isRetryable: true,
            };
        }

        // Authorization/quota errors
        if (statusCode === 403) {
            if (errorReason === 'userRateLimitExceeded') {
                return {
                    success: false,
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'Gmail rate limit reached. Please try again later.',
                    isRetryable: true,
                };
            }
            if (errorReason === 'quotaExceeded' || errorReason === 'dailyLimitExceeded') {
                return {
                    success: false,
                    errorCode: 'QUOTA_EXCEEDED',
                    errorMessage: 'Gmail daily sending limit reached.',
                    isRetryable: false,
                };
            }
            return {
                success: false,
                errorCode: 'PERMISSION_DENIED',
                errorMessage: 'Gmail permission denied. Please reconnect your Gmail account.',
                isRetryable: false,
            };
        }

        // Rate limiting
        if (statusCode === 429) {
            return {
                success: false,
                errorCode: 'RATE_LIMITED',
                errorMessage: 'Too many requests. Please try again later.',
                isRetryable: true,
            };
        }

        // Invalid recipient
        if (statusCode === 400) {
            return {
                success: false,
                errorCode: 'INVALID_RECIPIENT',
                errorMessage: 'Invalid recipient email address.',
                isRetryable: false,
            };
        }

        // Server errors
        if (statusCode && statusCode >= 500) {
            return {
                success: false,
                errorCode: 'SERVER_ERROR',
                errorMessage: 'Gmail server error. Please try again.',
                isRetryable: true,
            };
        }

        // Network errors
        if (error.message?.includes('ECONNRESET') ||
            error.message?.includes('ETIMEDOUT') ||
            error.message?.includes('network')) {
            return {
                success: false,
                errorCode: 'NETWORK_ERROR',
                errorMessage: 'Network error connecting to Gmail.',
                isRetryable: true,
            };
        }

        // Unknown error
        return {
            success: false,
            errorCode: 'UNKNOWN_ERROR',
            errorMessage: error.message || 'Unknown error sending email',
            isRetryable: true,
        };
    }

    /**
     * Check if Gmail is connected for a user
     */
    async isConnected(userId: string): Promise<boolean> {
        const tokens = await this.getUserTokens(userId);
        return tokens !== null;
    }

    /**
     * Get connected Gmail email address
     */
    async getConnectedEmail(userId: string): Promise<string | null> {
        try {
            const accessToken = await this.getValidAccessToken(userId);

            const oauth2Client = new google.auth.OAuth2();
            oauth2Client.setCredentials({ access_token: accessToken });

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            const profile = await gmail.users.getProfile({ userId: 'me' });

            return profile.data.emailAddress || null;
        } catch {
            return null;
        }
    }
}

export const gmailClient = new GmailClient();
