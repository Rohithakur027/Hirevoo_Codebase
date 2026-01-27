'use client';

import { SideBar } from '@/components/layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { SidebarProvider } from '@/context/SidebarContext';
import { useSession } from '@/app/hooks/use-session';
import { useState, useEffect } from 'react';
import { Mail, Shield, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw, Lock, Check, ChevronRight } from 'lucide-react';
import ConnectGmailModal, { PermissionLevel } from '@/components/dashboard/ConnectGmailModal';

interface GmailStatusData {
  isConnected: boolean;
  permissionLevel: 'SEND_ONLY' | 'FULL_ACCESS' | null;
  email: string | null;
}

export default function SettingsPage() {
  const { user, isLoading } = useSession();
  const [gmailStatus, setGmailStatus] = useState<GmailStatusData>({
    isConnected: false,
    permissionLevel: null,
    email: null,
  });
  const [isGmailLoading, setIsGmailLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "NW";

  // Fetch Gmail status
  const fetchGmailStatus = async () => {
    setIsGmailLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/gmail/status');
      if (response.ok) {
        const data = await response.json();
        setGmailStatus({
          isConnected: data.isConnected || false,
          permissionLevel: data.permissionLevel || null,
          email: data.email || null,
        });
      } else if (response.status === 401) {
        setError('Session expired. Please refresh the page and try again.');
      }
    } catch (err) {
      console.error('Error fetching Gmail status:', err);
      setError('Failed to check Gmail connection status');
    } finally {
      setIsGmailLoading(false);
    }
  };

  // Check URL params for success/error messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const errorParam = params.get('error');

    if (success === 'gmail_connected') {
      setSuccessMessage('Gmail connected successfully!');
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        missing_code: 'OAuth authorization code missing. Please try again.',
        unauthorized: 'Session expired. Please log in again.',
        database_error: 'Failed to save Gmail connection. Please try again.',
        token_exchange_failed: 'Failed to connect Gmail. Please try again.',
        no_access_token: 'Gmail did not provide access. Please try again.',
      };
      setError(errorMessages[errorParam] || `Connection error: ${errorParam}`);
    }

    // Clean URL params
    if (success || errorParam) {
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  // Fetch Gmail status on mount
  useEffect(() => {
    fetchGmailStatus();
  }, []);

  // Handle Gmail connect
  const handleConnectGmail = async (permissionLevel: PermissionLevel) => {
    setIsConnecting(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/gmail/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissionLevel }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowConnectModal(false);
        window.location.href = data.url;
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Failed to connect Gmail. Please try again.');
      }
    } catch (err) {
      console.error('Error connecting Gmail:', err);
      setError('Failed to connect Gmail. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle Gmail disconnect
  const handleDisconnectGmail = async () => {
    if (isDisconnecting) return;

    const confirmed = window.confirm(
      'Are you sure you want to disconnect Gmail? Your email campaigns will not be able to send until you reconnect.'
    );

    if (!confirmed) return;

    setIsDisconnecting(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/gmail/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setGmailStatus({
          isConnected: false,
          permissionLevel: null,
          email: null,
        });
        setSuccessMessage('Gmail disconnected successfully.');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Failed to disconnect Gmail. Please try again.');
      }
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
      setError('Failed to disconnect Gmail. Please try again.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getPermissionLevelDisplay = (level: string | null) => {
    switch (level) {
      case 'SEND_ONLY':
        return { label: 'Send Only', description: 'Can only send emails' };
      case 'FULL_ACCESS':
        return { label: 'Full Access', description: 'Can send, read, and modify emails' };
      default:
        return { label: 'Unknown', description: '' };
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden pb-[60px] md:pb-0" style={{ backgroundColor: "#fafafa" }}>
        {/* Left Sidebar */}
        <div className="hidden md:block">
          <SideBar />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-8 py-4 flex-shrink-0">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="pl-4">
                <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="text-right">
                    {isLoading ? (
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm font-bold text-gray-800 tracking-wide">{user?.name?.toUpperCase() || "GUEST USER"}</p>
                    )}
                  </div>
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200">
                    <span className="text-xs font-bold text-gray-600">{userInitials}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto space-y-6">

              {/* Success Message */}
              {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">{successMessage}</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-800">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-600 hover:text-red-800"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Integrations Card */}
              <section>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
                  <p className="text-sm text-gray-500">Manage your connected apps and services</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-50 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                        <Mail className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Gmail</h3>
                        <p className="text-sm text-gray-500">Send emails directly from your account</p>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <button
                      onClick={fetchGmailStatus}
                      disabled={isGmailLoading}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                      title="Refresh status"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGmailLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="p-6">
                    {isGmailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                      </div>
                    ) : gmailStatus.isConnected ? (
                      <div className="space-y-6">
                        {/* Connection Status Badge */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100 w-fit">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-wide">Active</span>
                          </div>

                          {/* Permissions Badge */}
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            {getPermissionLevelDisplay(gmailStatus.permissionLevel).label}
                          </div>
                        </div>

                        {/* Account Info Box */}
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 grid grid-cols-1 gap-1">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Connected Account</span>
                          <span className="text-sm font-medium text-gray-900 font-mono">{gmailStatus.email}</span>
                        </div>

                        {/* Security Verified */}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Lock className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs">
                            Credentials are <span className="font-medium text-gray-700">end-to-end encrypted</span>.
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="pt-4 mt-2 border-t border-gray-50 flex items-center justify-between">
                          <button
                            onClick={() => setShowConnectModal(true)}
                            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                          >
                            Manage Permissions
                          </button>

                          <button
                            onClick={handleDisconnectGmail}
                            disabled={isDisconnecting}
                            className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Not Connected State */
                      <div className="space-y-6">
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 flex gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium text-amber-800">No account connected</p>
                            <p className="text-amber-700 mt-1">Connect your Gmail to verify your identity and start sending campaigns.</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-gray-400 mt-0.5" />
                            <span className="text-sm text-gray-600">Personalized sending</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-gray-400 mt-0.5" />
                            <span className="text-sm text-gray-600">Automated follow-ups</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-gray-400 mt-0.5" />
                            <span className="text-sm text-gray-600">Secure OAuth 2.0</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-gray-400 mt-0.5" />
                            <span className="text-sm text-gray-600">Real-time tracking</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setShowConnectModal(true)}
                          disabled={isConnecting}
                          className="w-full px-4 py-2.5 text-white font-semibold bg-gray-900 hover:bg-black rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
                        >
                          {isConnecting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              Connect Gmail
                              <ChevronRight className="w-4 h-4 opacity-50" />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>


            </div>
          </main>
        </div>
        <BottomNav />

        {/* Connect Gmail Modal */}
        <ConnectGmailModal
          isOpen={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          onConnect={handleConnectGmail}
        />
      </div>
    </SidebarProvider>
  );
}
