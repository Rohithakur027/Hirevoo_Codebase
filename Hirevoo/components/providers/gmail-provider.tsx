"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface GmailContextType {
    isConnected: boolean;
    permissionLevel: string | null;
    email: string | null;
    isLoading: boolean;
    checkStatus: () => Promise<void>;
}

const GmailContext = createContext<GmailContextType | undefined>(undefined);

export function GmailProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();
    const [isConnected, setIsConnected] = useState(false);
    const [permissionLevel, setPermissionLevel] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Function to check status - can be called manually if needed
    const checkStatus = useCallback(async () => {
        if (status !== "authenticated") {
            setIsLoading(false);
            return;
        }

        try {
            // Don't set loading to true here to avoid UI flickering on re-checks
            // unless it's the initial load
            const response = await fetch("/api/auth/gmail/status");
            if (response.ok) {
                const data = await response.json();
                setIsConnected(data.isConnected);
                setPermissionLevel(data.permissionLevel);
                setEmail(data.email);
            }
        } catch (error) {
            console.error("Failed to check Gmail status:", error);
        } finally {
            setIsLoading(false);
        }
    }, [status]);

    // Initial check when session becomes available
    useEffect(() => {
        if (status === "loading") return;
        checkStatus();
    }, [status, checkStatus]);

    return (
        <GmailContext.Provider
            value={{
                isConnected,
                permissionLevel,
                email,
                isLoading,
                checkStatus,
            }}
        >
            {children}
        </GmailContext.Provider>
    );
}

export function useGmail() {
    const context = useContext(GmailContext);
    if (context === undefined) {
        throw new Error("useGmail must be used within a GmailProvider");
    }
    return context;
}
