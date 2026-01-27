/**
 * Gmail API wrapper for sending emails with production-grade error handling.
 * Handles OAuth2 token management, email composition, rate limiting, and error handling.
 *
 * Gmail API Limits:
 * - Daily sending limit: 500 (personal), 2000 (workspace)
 * - Per-second limit: ~5 emails
 * - Max email size: 25MB
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { google, gmail_v1 } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../encryption';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Input parameters for sending an email.
 */
export interface SendEmailParams {
  /** Recipient email address */
  to: string;

  /** Recipient's display name (optional, for personalization) */
  toName?: string;

  /** Email subject line */
  subject: string;

  /** Email body (HTML supported) */
  body: string;

  /** User ID who owns the Gmail account */
  userId: string;

  /** Optional: Reply-to address */
  replyTo?: string;
}

/**
 * Result of a successful email send operation.
 */
export interface SendEmailResult {
  /** Whether the email was sent successfully */
  success: true;

  /** Gmail message ID (for tracking/threading) */
  messageId: string;

  /** Gmail thread ID (for conversation tracking) */
  threadId: string;

  /** Time taken to send (milliseconds) */
  durationMs: number;
}

/**
 * Result of a failed email send operation.
 */
export interface SendEmailError {
  /** Email was not sent */
  success: false;

  /** Error code for programmatic handling */
  errorCode: EmailErrorCode;

  /** Human-readable error message */
  errorMessage: string;

  /** Whether this error is retryable */
  isRetryable: boolean;

  /** Original error for debugging */
  originalError?: unknown;
}

/**
 * Categorized error codes for different failure scenarios.
 */
export type EmailErrorCode =
  | 'INVALID_RECIPIENT' // Email address is invalid or doesn't exist
  | 'TOKEN_EXPIRED' // OAuth token expired (will auto-refresh)
  | 'TOKEN_INVALID' // OAuth token is invalid (user needs to reconnect)
  | 'RATE_LIMITED' // Gmail rate limit hit (should retry with backoff)
  | 'QUOTA_EXCEEDED' // Daily quota exceeded (don't retry until tomorrow)
  | 'NETWORK_ERROR' // Transient network issue (should retry)
  | 'GMAIL_ERROR' // Other Gmail API error
  | 'DATABASE_ERROR' // Failed to fetch/update tokens
  | 'VALIDATION_ERROR' // Invalid input parameters
  | 'UNKNOWN_ERROR'; // Unexpected error

// ============================================================
// SUPABASE CLIENT
// ============================================================

/**
 * Supabase client for database operations.
 * Uses service role key for server-side operations (bypasses RLS).
 */
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

// ============================================================
// OAUTH2 CONFIGURATION
// ============================================================

/**
 * Creates an OAuth2 client configured with app credentials.
 * Used to refresh tokens and authenticate Gmail API requests.
 */
function createOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Gmail OAuth credentials not configured. ' +
      'Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in environment variables.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

/**
 * Fetches and decrypts Gmail refresh token for a user.
 * Access tokens are obtained by refreshing on every use.
 *
 * @param userId - UUID of the user
 * @returns Decrypted refresh token or null if not found
 */
async function getUserGmailTokens(userId: string): Promise<{
  refreshToken: string;
} | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('gmail_refresh_token_IV, gmail_refresh_token_content, gmail_refresh_token_tag')
    .eq('id', userId)
    .single();

  if (error) {
    console.error(`[EmailService] Failed to fetch tokens for user ${userId}:`, error);
    return null;
  }

  if (!user?.gmail_refresh_token_content || !user?.gmail_refresh_token_IV || !user?.gmail_refresh_token_tag) {
    console.warn(`[EmailService] User ${userId} has no Gmail tokens`);
    return null;
  }

  try {
    const refreshToken = decrypt({
      salt: user.gmail_refresh_token_IV,
      content: user.gmail_refresh_token_content,
      tag: user.gmail_refresh_token_tag,
    });

    return { refreshToken };
  } catch (e) {
    console.error(`[EmailService] Failed to decrypt token for user ${userId}:`, e);
    return null;
  }
}

/**
 * Gets a valid access token by refreshing using the stored refresh token.
 * Access tokens are obtained fresh each time using the encrypted refresh token.
 *
 * @param userId - UUID of the user
 * @param refreshToken - The decrypted refresh token
 * @returns Fresh access token
 */
async function getAccessToken(
  userId: string,
  refreshToken: string
): Promise<string> {
  console.log(`[EmailService] Getting access token for user ${userId}`);

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log(`[EmailService] Google refresh response:`, {
      hasAccessToken: !!credentials.access_token,
      expiryDate: credentials.expiry_date,
    });

    if (!credentials.access_token) {
      throw new Error('No access token returned from refresh');
    }

    console.log(`[EmailService] Access token obtained for user ${userId}`);
    return credentials.access_token;
  } catch (error: any) {
    console.error(
      `[EmailService] Failed to get access token for user ${userId}:`,
      error
    );

    // Handle invalid_grant (revoked or expired refresh token)
    const isInvalidGrant =
      error?.response?.data?.error === 'invalid_grant' ||
      error?.message?.includes('invalid_grant');

    if (isInvalidGrant) {
      console.warn(`[EmailService] invalid_grant for user ${userId} — marking gmail_connected = false`);
      await supabase
        .from('users')
        .update({ gmail_connected: false, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    throw new Error(
      'Failed to refresh Gmail token. User may need to reconnect their Gmail account.'
    );
  }
}

// ============================================================
// EMAIL COMPOSITION
// ============================================================

/**
 * Validates an email address format.
 * Uses a practical regex to catch common issues without being overly strict.
 *
 * @param email - Email address to validate
 * @returns true if email format is valid
 */
function isValidEmail(email: string): boolean {
  // This regex handles most common email formats
  // It's intentionally not RFC 5322 compliant because:
  // 1. Real-world emails rarely use edge cases
  // 2. Overly strict validation causes false negatives
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Creates an RFC 2822 compliant email message.
 * Includes headers (From, To, Subject) and body.
 *
 * @param params - Email parameters
 * @param fromEmail - Sender's email address
 * @returns Formatted email string
 */
function createEmailMessage(params: SendEmailParams, fromEmail: string): string {
  const { to, toName, subject, body, replyTo } = params;

  // Format recipient with display name if provided
  const toHeader = toName ? `"${toName}" <${to}>` : to;

  // Build email headers
  // Each header is on its own line, headers end with blank line
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

  // Combine headers with body
  // Blank line separates headers from body (RFC 2822 requirement)
  const message = [...headers, '', body].join('\r\n');

  return message;
}

/**
 * Encodes an email message for Gmail API (base64url).
 *
 * @param message - RFC 2822 formatted email string
 * @returns Base64url encoded string
 */
function encodeEmail(message: string): string {
  // Convert to base64
  const base64 = Buffer.from(message).toString('base64');

  // Convert to base64url (URL-safe)
  // Replace + with -, / with _, remove = padding
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64url;
}

// ============================================================
// MAIN SEND FUNCTION
// ============================================================

/**
 * Sends an email via Gmail API with error handling and token management.
 * Handles token refresh, validation, formatting, and error categorization.
 *
 * @param params - Email parameters (to, subject, body, userId)
 * @returns Success result with message ID, or error result with details
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult | SendEmailError> {
  const startTime = Date.now();
  const { to, subject, body, userId } = params;

  const logPrefix = `[EmailService:${userId.substring(0, 8)}]`;
  console.log(`${logPrefix} Starting email send to: ${to}`);

  // ─────────────────────────────────────────────────────────
  // STEP 1: VALIDATE INPUT PARAMETERS
  // ─────────────────────────────────────────────────────────
  // Validate early to fail fast

  if (!isValidEmail(to)) {
    console.warn(`${logPrefix} Invalid recipient email: ${to}`);
    return {
      success: false,
      errorCode: 'INVALID_RECIPIENT',
      errorMessage: `Invalid email address format: ${to}`,
      isRetryable: false, // Don't retry - email format won't change
    };
  }

  if (!subject || subject.trim().length === 0) {
    return {
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Email subject cannot be empty',
      isRetryable: false,
    };
  }

  if (!body || body.trim().length === 0) {
    return {
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Email body cannot be empty',
      isRetryable: false,
    };
  }

  // ─────────────────────────────────────────────────────────
  // STEP 2: FETCH USER'S GMAIL TOKENS
  // ─────────────────────────────────────────────────────────

  let tokens;
  try {
    tokens = await getUserGmailTokens(userId);
  } catch (error) {
    console.error(`${logPrefix} Database error fetching tokens:`, error);
    return {
      success: false,
      errorCode: 'DATABASE_ERROR',
      errorMessage: 'Failed to fetch Gmail credentials from database',
      isRetryable: true, // Database might recover
      originalError: error,
    };
  }

  if (!tokens) {
    console.error(`${logPrefix} No Gmail tokens found in database for user ${userId}`);
    return {
      success: false,
      errorCode: 'TOKEN_INVALID',
      errorMessage:
        'Gmail is not connected. Please connect your Gmail account in Settings before sending.',
      isRetryable: false, // User action required
    };
  }

  console.log(`${logPrefix} Encrypted refresh token found, obtaining access token...`);

  // ─────────────────────────────────────────────────────────
  // STEP 3: GET ACCESS TOKEN (refresh since not stored)
  // ─────────────────────────────────────────────────────────

  let accessToken: string;

  try {
    accessToken = await getAccessToken(userId, tokens.refreshToken);
  } catch (error: any) {
    console.error(`${logPrefix} Failed to get access token:`, error);

    return {
      success: false,
      errorCode: 'TOKEN_INVALID',
      errorMessage:
        'Gmail session expired and could not be renewed. ' +
        'Please reconnect your Gmail account in Settings.',
      isRetryable: false, // User action required
      originalError: error,
    };
  }

  // ─────────────────────────────────────────────────────────
  // STEP 4: CREATE GMAIL API CLIENT
  // ─────────────────────────────────────────────────────────

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // ─────────────────────────────────────────────────────────
  // STEP 5: GET SENDER'S EMAIL ADDRESS
  // ─────────────────────────────────────────────────────────
  // Need authenticated user's email for "From" header

  let senderEmail: string;
  try {
    console.log(`${logPrefix} Fetching Gmail profile to get sender address...`);
    const profile = await gmail.users.getProfile({ userId: 'me' });
    senderEmail = profile.data.emailAddress!;
    console.log(`${logPrefix} Sending from: ${senderEmail}`);
  } catch (error) {
    console.error(`${logPrefix} Failed to get sender profile:`, error);
    console.error(`${logPrefix} This usually means the access token is invalid or Gmail API access was revoked`);
    return handleGmailError(error, logPrefix);
  }

  // ─────────────────────────────────────────────────────────
  // STEP 6: COMPOSE AND ENCODE EMAIL
  // ─────────────────────────────────────────────────────────

  const emailMessage = createEmailMessage(params, senderEmail);
  const encodedEmail = encodeEmail(emailMessage);

  // ─────────────────────────────────────────────────────────
  // STEP 7: SEND VIA GMAIL API
  // ─────────────────────────────────────────────────────────

  try {
    console.log(`${logPrefix} Sending email via Gmail API...`);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    const durationMs = Date.now() - startTime;

    console.log(
      `${logPrefix} ✅ Email sent successfully to ${to} ` +
      `(ID: ${response.data.id}, Duration: ${durationMs}ms)`
    );

    return {
      success: true,
      messageId: response.data.id!,
      threadId: response.data.threadId!,
      durationMs,
    };
  } catch (error) {
    console.error(`${logPrefix} Gmail API error:`, error);
    return handleGmailError(error, logPrefix);
  }
}

// ============================================================
// ERROR HANDLING
// ============================================================

/**
 * Handles Gmail API errors and categorizes them for retry behavior.
 * Determines error category, retry safety, and user message.
 *
 * @param error - The caught error
 * @param logPrefix - Prefix for log messages
 * @returns Categorized error result
 */
function handleGmailError(error: unknown, logPrefix: string): SendEmailError {
  // Type guard for Gmail API errors
  interface GmailError {
    code?: number;
    message?: string;
    errors?: Array<{
      domain?: string;
      reason?: string;
      message?: string;
    }>;
  }

  const gmailError = error as GmailError;
  const statusCode = gmailError.code;
  const errorReason = gmailError.errors?.[0]?.reason;

  console.log(
    `${logPrefix} Handling Gmail error - Code: ${statusCode}, Reason: ${errorReason}`
  );

  // ─────────────────────────────────────────────────────────
  // AUTHENTICATION ERRORS (401)
  // ─────────────────────────────────────────────────────────
  if (statusCode === 401) {
    return {
      success: false,
      errorCode: 'TOKEN_EXPIRED',
      errorMessage: 'Gmail authentication expired. Token will be refreshed.',
      isRetryable: true, // Will refresh token and retry
      originalError: error,
    };
  }

  // ─────────────────────────────────────────────────────────
  // AUTHORIZATION ERRORS (403)
  // ─────────────────────────────────────────────────────────
  if (statusCode === 403) {
    // Check specific reason
    if (errorReason === 'userRateLimitExceeded') {
      return {
        success: false,
        errorCode: 'RATE_LIMITED',
        errorMessage:
          'Gmail rate limit reached. Will retry with backoff.',
        isRetryable: true,
        originalError: error,
      };
    }

    if (
      errorReason === 'quotaExceeded' ||
      errorReason === 'dailyLimitExceeded'
    ) {
      return {
        success: false,
        errorCode: 'QUOTA_EXCEEDED',
        errorMessage:
          'Gmail daily sending limit reached. ' +
          'Please wait until tomorrow or upgrade your Gmail account.',
        isRetryable: false, // Don't retry until tomorrow
        originalError: error,
      };
    }

    // Generic 403
    return {
      success: false,
      errorCode: 'GMAIL_ERROR',
      errorMessage:
        'Gmail permission denied. Please reconnect your Gmail account.',
      isRetryable: false,
      originalError: error,
    };
  }

  // ─────────────────────────────────────────────────────────
  // RATE LIMITING (429)
  // ─────────────────────────────────────────────────────────
  if (statusCode === 429) {
    return {
      success: false,
      errorCode: 'RATE_LIMITED',
      errorMessage:
        'Too many requests to Gmail. Will retry with exponential backoff.',
      isRetryable: true,
      originalError: error,
    };
  }

  // ─────────────────────────────────────────────────────────
  // INVALID RECIPIENT (400)
  // ─────────────────────────────────────────────────────────
  if (statusCode === 400) {
    const message = gmailError.message || '';

    if (
      message.includes('invalid') ||
      message.includes('recipient') ||
      errorReason === 'invalidArgument'
    ) {
      return {
        success: false,
        errorCode: 'INVALID_RECIPIENT',
        errorMessage:
          'Invalid recipient email address. Email could not be delivered.',
        isRetryable: false,
        originalError: error,
      };
    }

    return {
      success: false,
      errorCode: 'GMAIL_ERROR',
      errorMessage: `Gmail rejected the request: ${message}`,
      isRetryable: false,
      originalError: error,
    };
  }

  // ─────────────────────────────────────────────────────────
  // SERVER ERRORS (5xx)
  // ─────────────────────────────────────────────────────────
  if (statusCode && statusCode >= 500) {
    return {
      success: false,
      errorCode: 'GMAIL_ERROR',
      errorMessage: 'Gmail server error. Will retry automatically.',
      isRetryable: true, // Server errors are usually transient
      originalError: error,
    };
  }

  // ─────────────────────────────────────────────────────────
  // NETWORK ERRORS
  // ─────────────────────────────────────────────────────────
  if (
    error instanceof Error &&
    (error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('network'))
  ) {
    return {
      success: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage: 'Network error connecting to Gmail. Will retry.',
      isRetryable: true,
      originalError: error,
    };
  }

  // ─────────────────────────────────────────────────────────
  // UNKNOWN ERRORS
  // ─────────────────────────────────────────────────────────
  // When in doubt, allow retry but log for investigation
  console.error(
    `${logPrefix} Unknown error type - Code: ${statusCode}, ` +
    `Message: ${gmailError.message}, Reason: ${errorReason}`
  );

  return {
    success: false,
    errorCode: 'UNKNOWN_ERROR',
    errorMessage:
      error instanceof Error ? error.message : 'Unknown error sending email',
    isRetryable: true, // Allow retry for unknown errors
    originalError: error,
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Delays execution for a specified number of milliseconds.
 * Used for rate limiting between email sends.
 *
 * @param ms - Milliseconds to wait
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if a user has Gmail connected.
 *
 * Use this before queuing a campaign to provide early feedback.
 *
 * @param userId - UUID of the user
 * @returns true if Gmail tokens exist
 */
export async function isGmailConnected(userId: string): Promise<boolean> {
  const tokens = await getUserGmailTokens(userId);
  return tokens !== null;
}

/**
 * Gets the user's Gmail email address.
 *
 * Useful for showing which account will send emails.
 *
 * @param userId - UUID of the user
 * @returns Email address or null if not connected
 */
export async function getGmailAddress(userId: string): Promise<string | null> {
  const tokens = await getUserGmailTokens(userId);
  if (!tokens) return null;

  try {
    const accessToken = await getAccessToken(userId, tokens.refreshToken);

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    return profile.data.emailAddress || null;
  } catch {
    return null;
  }
}
