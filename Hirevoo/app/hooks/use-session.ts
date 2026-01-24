"use client";

import { useSession as useNextAuthSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

interface GmailStatus {
  isConnected: boolean;
  permissionLevel: 'SEND_ONLY' | 'FULL_ACCESS' | null;
  email: string | null;
}

interface SessionUser {
  id?: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  gmail?: GmailStatus;
}

export function useSession() {
  const { data: session, status } = useNextAuthSession();
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({
    isConnected: false,
    permissionLevel: null,
    email: null,
  });
  const [isGmailLoading, setIsGmailLoading] = useState(true);

  // Fetch Gmail connection status
  const fetchGmailStatus = useCallback(async () => {
    if (status !== "authenticated") {
      setIsGmailLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/gmail/status');
      if (response.ok) {
        const data = await response.json();
        setGmailStatus({
          isConnected: data.isConnected || false,
          permissionLevel: data.permissionLevel || null,
          email: data.email || null,
        });
      }
    } catch (error) {
      console.error('Error fetching Gmail status:', error);
    } finally {
      setIsGmailLoading(false);
    }
  }, [status]);

  // Fetch Gmail status when session is authenticated
  useEffect(() => {
    fetchGmailStatus();
  }, [fetchGmailStatus]);

  // Refresh Gmail status function (for use after connect/disconnect)
  const refreshGmailStatus = useCallback(() => {
    setIsGmailLoading(true);
    fetchGmailStatus();
  }, [fetchGmailStatus]);

  const isLoading = status === "loading" || isGmailLoading;

  const user: SessionUser | null = session?.user ? {
    id: (session.user as any).id,
    name: session.user.name || "User",
    email: session.user.email || "",
    avatar: session.user.image || undefined,
    role: "User",
    gmail: gmailStatus,
  } : null;

  return {
    user,
    isLoading,
    isAuthenticated: status === "authenticated",
    refreshGmailStatus,
  };
}
