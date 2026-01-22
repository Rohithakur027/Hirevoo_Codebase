/**
 * hooks/useCampaignProgress.ts
 *
 * Purpose: React hook for real-time campaign progress updates via Socket.IO
 *
 * This hook connects to the Socket.IO server and listens for events
 * related to a specific campaign. It provides reactive state that
 * updates automatically as emails are sent.
 *
 * Usage:
 * ```tsx
 * function CampaignPage({ campaignId, userId }) {
 *   const { progress, sent, failed, total, isComplete, error } =
 *     useCampaignProgress(userId, campaignId);
 *
 *   return (
 *     <div>
 *       <ProgressBar value={progress} />
 *       <p>{sent} of {total} emails sent</p>
 *       {isComplete && <p>Campaign complete!</p>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @module hooks/useCampaignProgress
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * State returned by the useCampaignProgress hook.
 */
export interface CampaignProgressState {
  /** Progress percentage (0-100) */
  progress: number;

  /** Number of successfully sent emails */
  sent: number;

  /** Number of failed emails */
  failed: number;

  /** Total emails in the campaign */
  total: number;

  /** Whether the campaign has finished processing */
  isComplete: boolean;

  /** Whether currently connected to Socket.IO */
  isConnected: boolean;

  /** Duration in seconds (only set when complete) */
  duration: number | null;

  /** Error message if connection failed */
  error: string | null;

  /** List of failed email addresses */
  failedEmails: FailedEmail[];
}

/**
 * Information about a failed email.
 */
export interface FailedEmail {
  emailId: string;
  recipientEmail: string;
  error: string;
  errorCode: string;
  timestamp: string;
}

/**
 * Events received from Socket.IO server.
 */
interface EmailSentEvent {
  campaignId: string;
  emailId: string;
  recipientEmail: string;
  progress: number;
  sent: number;
  failed: number;
  total: number;
  timestamp: string;
}

interface EmailFailedEvent {
  campaignId: string;
  emailId: string;
  recipientEmail: string;
  error: string;
  errorCode: string;
  timestamp: string;
}

interface CampaignCompleteEvent {
  campaignId: string;
  totalSent: number;
  totalFailed: number;
  duration: number;
  timestamp: string;
}

// ============================================================
// INITIAL STATE
// ============================================================

const initialState: CampaignProgressState = {
  progress: 0,
  sent: 0,
  failed: 0,
  total: 0,
  isComplete: false,
  isConnected: false,
  duration: null,
  error: null,
  failedEmails: [],
};

// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

/**
 * React hook for real-time campaign progress updates.
 *
 * Connects to Socket.IO and subscribes to events for the specified campaign.
 * Automatically handles connection/disconnection lifecycle.
 *
 * @param userId - The current user's ID (for authentication)
 * @param campaignId - The campaign to track (optional - won't connect if not provided)
 * @param options - Optional configuration
 * @returns Campaign progress state
 *
 * @example
 * const progress = useCampaignProgress(user.id, campaign.id);
 *
 * // In your component
 * {progress.isConnected ? (
 *   <ProgressBar value={progress.progress} />
 * ) : (
 *   <p>Connecting...</p>
 * )}
 */
export function useCampaignProgress(
  userId: string | undefined,
  campaignId: string | undefined,
  options: {
    /** Auto-reconnect on disconnect (default: true) */
    autoReconnect?: boolean;
    /** Socket.IO server URL (default: window.location.origin) */
    serverUrl?: string;
  } = {}
): CampaignProgressState {
  const { autoReconnect = true, serverUrl } = options;

  // State for progress tracking
  const [state, setState] = useState<CampaignProgressState>(initialState);

  // Ref to hold socket instance (persists across renders)
  const socketRef = useRef<Socket | null>(null);

  // Ref to track if we should reconnect
  const shouldReconnectRef = useRef(true);

  // ─────────────────────────────────────────────────────────
  // CONNECTION MANAGEMENT
  // ─────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    // Don't connect without required params
    if (!userId || !campaignId) {
      return;
    }

    // Don't create duplicate connections
    if (socketRef.current?.connected) {
      return;
    }

    console.log('[useCampaignProgress] Connecting to Socket.IO...');

    // Create socket connection
    const socket = io(serverUrl || undefined, {
      auth: { userId },
      transports: ['websocket', 'polling'],
      reconnection: autoReconnect,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // ─────────────────────────────────────────────────────
    // CONNECTION EVENTS
    // ─────────────────────────────────────────────────────

    socket.on('connect', () => {
      console.log('[useCampaignProgress] Connected');
      setState((prev) => ({ ...prev, isConnected: true, error: null }));

      // Subscribe to this campaign's events
      socket.emit('subscribe:campaign', campaignId);
    });

    socket.on('connected', (data) => {
      console.log('[useCampaignProgress] Server acknowledged:', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('[useCampaignProgress] Disconnected:', reason);
      setState((prev) => ({ ...prev, isConnected: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('[useCampaignProgress] Connection error:', error.message);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: `Connection failed: ${error.message}`,
      }));
    });

    // ─────────────────────────────────────────────────────
    // CAMPAIGN EVENTS
    // ─────────────────────────────────────────────────────

    socket.on('email:sent', (data: EmailSentEvent) => {
      // Only process events for our campaign
      if (data.campaignId !== campaignId) return;

      console.log('[useCampaignProgress] Email sent:', data.recipientEmail);

      setState((prev) => ({
        ...prev,
        progress: data.progress,
        sent: data.sent,
        failed: data.failed,
        total: data.total,
      }));
    });

    socket.on('email:failed', (data: EmailFailedEvent) => {
      if (data.campaignId !== campaignId) return;

      console.warn('[useCampaignProgress] Email failed:', data.recipientEmail);

      setState((prev) => ({
        ...prev,
        failedEmails: [
          ...prev.failedEmails,
          {
            emailId: data.emailId,
            recipientEmail: data.recipientEmail,
            error: data.error,
            errorCode: data.errorCode,
            timestamp: data.timestamp,
          },
        ],
      }));
    });

    socket.on('campaign:complete', (data: CampaignCompleteEvent) => {
      if (data.campaignId !== campaignId) return;

      console.log('[useCampaignProgress] Campaign complete!', data);

      setState((prev) => ({
        ...prev,
        progress: 100,
        sent: data.totalSent,
        failed: data.totalFailed,
        total: data.totalSent + data.totalFailed,
        isComplete: true,
        duration: data.duration,
      }));

      // Stop reconnecting after completion
      shouldReconnectRef.current = false;
    });
  }, [userId, campaignId, serverUrl, autoReconnect]);

  // ─────────────────────────────────────────────────────────
  // DISCONNECT FUNCTION
  // ─────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[useCampaignProgress] Disconnecting...');

      // Unsubscribe from campaign before disconnecting
      if (campaignId) {
        socketRef.current.emit('unsubscribe:campaign', campaignId);
      }

      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [campaignId]);

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE MANAGEMENT
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    // Reset state when campaign changes
    setState(initialState);
    shouldReconnectRef.current = true;

    // Connect when we have userId and campaignId
    connect();

    // Cleanup on unmount or when deps change
    return () => {
      disconnect();
    };
  }, [userId, campaignId, connect, disconnect]);

  return state;
}

// ============================================================
// CONVENIENCE HOOKS
// ============================================================

/**
 * Hook to manually trigger campaign send and track progress.
 *
 * @example
 * const { sendCampaign, progress, isLoading, error } = useSendCampaign(userId);
 *
 * const handleClick = async () => {
 *   const result = await sendCampaign(campaignId);
 *   if (result.success) {
 *     // Progress will now be tracked automatically
 *   }
 * };
 */
export function useSendCampaign(userId: string) {
  const [campaignId, setCampaignId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Track progress once campaign is set
  const progress = useCampaignProgress(userId, campaignId);

  const sendCampaign = useCallback(
    async (
      targetCampaignId: string
    ): Promise<{
      success: boolean;
      jobId?: string;
      error?: string;
    }> => {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await fetch(`/api/campaigns/${targetCampaignId}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();

        if (data.success) {
          // Start tracking progress
          setCampaignId(targetCampaignId);
          return { success: true, jobId: data.jobId };
        } else {
          setApiError(data.error);
          return { success: false, error: data.error };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setApiError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setCampaignId(undefined);
    setApiError(null);
  }, []);

  return {
    sendCampaign,
    reset,
    progress,
    isLoading,
    error: apiError || progress.error,
    isTracking: !!campaignId,
  };
}
