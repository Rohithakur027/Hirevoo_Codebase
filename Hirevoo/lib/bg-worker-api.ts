/**
 * lib/bg-worker-api.ts
 *
 * API client for communicating with the bg-worker backend service.
 * Handles campaign sending, status checking, and provides type-safe responses.
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface SendCampaignResponse {
  success: true;
  message: string;
  jobId: string;
  queuePosition: number;
  pendingEmails: number;
  estimatedDurationSeconds: number;
}

export interface CampaignJobStatus {
  success: true;
  hasJob: boolean;
  message?: string;
  job?: {
    id: string;
    state: 'waiting' | 'delayed' | 'active' | 'completed' | 'failed';
    progress: number;
    attemptsMade: number;
    result?: unknown;
    failedReason?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export type SendCampaignResult = SendCampaignResponse | ApiErrorResponse;
export type CampaignStatusResult = CampaignJobStatus | ApiErrorResponse;

// ============================================================
// API CLIENT CLASS
// ============================================================

export class BgWorkerApi {
  private bgWorkerUrl: string;
  private appUrl: string;

  constructor() {
    this.bgWorkerUrl = process.env.BG_WORKER_URL || 'http://localhost:3001';
    // Ensure appUrl uses www subdomain to avoid CORS issues
    let appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (appUrl.includes('hirevoo.in') && !appUrl.includes('www.')) {
      appUrl = appUrl.replace('://hirevoo.in', '://www.hirevoo.in');
    }
    this.appUrl = appUrl;
  }

  /**
   * Queue a campaign for background sending.
   *
   * @param campaignId - The ID of the campaign to send
   * @returns Promise with job details or error
   */
  async sendCampaign(campaignId: string): Promise<SendCampaignResponse> {
    const response = await fetch(`${this.appUrl}/api/campaigns/${campaignId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for auth
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new BgWorkerError(
        data.error || 'Failed to send campaign',
        data.code || 'UNKNOWN_ERROR',
        response.status,
        data.details
      );
    }

    return data as SendCampaignResponse;
  }

  /**
   * Get the current status of a campaign's send job.
   *
   * @param campaignId - The ID of the campaign to check
   * @returns Promise with job status or error
   */
  async getCampaignStatus(campaignId: string): Promise<CampaignJobStatus> {
    const response = await fetch(`${this.bgWorkerUrl}/api/campaigns/${campaignId}/send`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BG_WORKER_API_KEY || 'internal-key'}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new BgWorkerError(
        data.error || 'Failed to get campaign status',
        data.code || 'UNKNOWN_ERROR',
        response.status,
        data.details
      );
    }

    return data as CampaignJobStatus;
  }

  /**
   * Queue a reply to be sent via background worker.
   *
   * @param campaignContactId - The ID of the contact to reply to
   * @param message - The reply message content
   * @param userId - The ID of the sending user
   * @returns Promise with job details or error
   */
  async sendReply(campaignContactId: string, message: string, userId: string): Promise<any> {
    const response = await fetch(`${this.bgWorkerUrl}/api/emails/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BG_WORKER_API_KEY || 'internal-key'}`,
      },
      body: JSON.stringify({
        campaignContactId,
        message,
        userId,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new BgWorkerError(
        data.error || 'Failed to send reply',
        data.code || 'UNKNOWN_ERROR',
        response.status,
        data.details
      );
    }

    return data;
  }

}

// ============================================================
// ERROR CLASS
// ============================================================

export class BgWorkerError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BgWorkerError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  /**
   * Check if this is a specific error code
   */
  is(code: string): boolean {
    return this.code === code;
  }

  /**
   * Get a user-friendly error message based on the error code
   */
  getUserMessage(): string {
    switch (this.code) {
      case 'UNAUTHORIZED':
        return 'Please log in to send campaigns.';
      case 'USER_NOT_FOUND':
        return 'User account not found. Please contact support.';
      case 'CAMPAIGN_NOT_FOUND':
        return 'Campaign not found. It may have been deleted.';
      case 'FORBIDDEN':
        return 'You do not have permission to send this campaign.';
      case 'ALREADY_SENDING':
      case 'CAMPAIGN_ALREADY_SENDING':
        return 'This campaign is already being sent.';
      case 'ALREADY_SENT':
      case 'CAMPAIGN_ALREADY_SENT':
        return 'This campaign has already been sent.';
      case 'GMAIL_NOT_CONNECTED':
        return 'Please connect your Gmail account in Settings before sending.';
      case 'GMAIL_TOKENS_MISSING':
        return 'Gmail connection is incomplete. Please reconnect your Gmail account in Settings.';
      case 'NO_PENDING_EMAILS':
        return 'No emails to send. Add recipients to your campaign first.';
      case 'DAILY_LIMIT_EXCEEDED':
        return 'Daily sending limit reached. Upgrade your plan for higher limits.';
      case 'ALREADY_PROCESSING':
        return 'Campaign is already being processed.';
      case 'QUEUE_ERROR':
        return 'Failed to queue campaign. Please try again.';
      case 'DATABASE_ERROR':
        return 'Database error occurred. Please try again.';
      case 'INTERNAL_ERROR':
        return 'An internal error occurred. Please try again.';
      default:
        return this.message || 'An error occurred. Please try again.';
    }
  }

  /**
   * Check if this error indicates the campaign is already being processed
   */
  isAlreadyProcessing(): boolean {
    return [
      'ALREADY_SENDING',
      'CAMPAIGN_ALREADY_SENDING',
      'ALREADY_PROCESSING'
    ].includes(this.code);
  }

  /**
   * Check if this error indicates the campaign was already sent
   */
  isAlreadySent(): boolean {
    return [
      'ALREADY_SENT',
      'CAMPAIGN_ALREADY_SENT'
    ].includes(this.code);
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return [
      'DATABASE_ERROR',
      'INTERNAL_ERROR',
      'QUEUE_ERROR',
      'UNKNOWN_ERROR'
    ].includes(this.code);
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const bgWorkerApi = new BgWorkerApi();
