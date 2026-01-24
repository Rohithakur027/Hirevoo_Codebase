'use client';

/**
 * hooks/useCampaignProgress.ts
 *
 * React hook for real-time campaign progress updates via Socket.IO.
 * Connects to the bg-worker backend for live email sending progress.
 */

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

  /** Individual email status updates */
  emailStatuses: Map<string, EmailStatusUpdate>;
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
 * Status update for an individual email
 */
export interface EmailStatusUpdate {
  emailId: string;
  recipientEmail: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  timestamp: string;
  error?: string;
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
  emailStatuses: new Map(),
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
    /** Socket.IO server URL (default: from env or localhost:3001) */
    serverUrl?: string;
    /** Initial total count for progress calculation */
    initialTotal?: number;
  } = {}
): CampaignProgressState {
  const {
    autoReconnect = true,
    serverUrl = process.env.NEXT_PUBLIC_BG_WORKER_SOCKET_URL || 'http://localhost:3001',
    initialTotal = 0,
  } = options;

  // State for progress tracking
  const [state, setState] = useState<CampaignProgressState>({
    ...initialState,
    total: initialTotal,
  });

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

    // Skip connection entirely if socket is disabled (focus on email sending first)
    if (serverUrl === 'http://disabled-socket-server') {
      console.log('[useCampaignProgress] Socket.IO disabled - progress updates unavailable');
      setState((prev) => ({ ...prev, isConnected: false, error: null }));
      return;
    }

    // Don't create duplicate connections
    if (socketRef.current?.connected) {
      return;
    }

    console.log('[useCampaignProgress] Connecting to Socket.IO...', serverUrl);

    // Create socket connection
    const socket = io(serverUrl, {
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
      // Only log connection errors if we're actually trying to connect
      if (serverUrl !== 'http://disabled-socket-server') {
        console.error('[useCampaignProgress] Connection error:', error.message);
      }
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: serverUrl === 'http://disabled-socket-server' ? null : `Connection failed: ${error.message}`,
      }));
    });

    // ─────────────────────────────────────────────────────
    // CAMPAIGN EVENTS
    // ─────────────────────────────────────────────────────

    socket.on('email:sent', (data: EmailSentEvent) => {
      // Only process events for our campaign
      if (data.campaignId !== campaignId) return;

      console.log('[useCampaignProgress] Email sent:', data.recipientEmail);

      setState((prev) => {
        const newStatuses = new Map(prev.emailStatuses);
        newStatuses.set(data.recipientEmail, {
          emailId: data.emailId,
          recipientEmail: data.recipientEmail,
          status: 'sent',
          timestamp: data.timestamp,
        });

        return {
          ...prev,
          progress: data.progress,
          sent: data.sent,
          failed: data.failed,
          total: data.total,
          emailStatuses: newStatuses,
        };
      });
    });

    socket.on('email:failed', (data: EmailFailedEvent) => {
      if (data.campaignId !== campaignId) return;

      console.warn('[useCampaignProgress] Email failed:', data.recipientEmail);

      setState((prev) => {
        const newStatuses = new Map(prev.emailStatuses);
        newStatuses.set(data.recipientEmail, {
          emailId: data.emailId,
          recipientEmail: data.recipientEmail,
          status: 'failed',
          timestamp: data.timestamp,
          error: data.error,
        });

        return {
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
          emailStatuses: newStatuses,
        };
      });
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
    setState({
      ...initialState,
      total: initialTotal,
    });
    shouldReconnectRef.current = true;

    // Connect when we have userId and campaignId
    connect();

    // Cleanup on unmount or when deps change
    return () => {
      disconnect();
    };
  }, [userId, campaignId, connect, disconnect, initialTotal]);

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
export function useSendCampaign(userId: string | undefined) {
  const [campaignId, setCampaignId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

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
        const bgWorkerUrl = process.env.NEXT_PUBLIC_BG_WORKER_URL || 'http://localhost:3001';
        const response = await fetch(`${bgWorkerUrl}/api/campaigns/${targetCampaignId}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        const data = await response.json();

        if (data.success) {
          // Start tracking progress
          setCampaignId(targetCampaignId);
          setJobId(data.jobId);
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
    setJobId(null);
  }, []);

  return {
    sendCampaign,
    reset,
    progress,
    isLoading,
    error: apiError || progress.error,
    isTracking: !!campaignId,
    jobId,
  };
}
