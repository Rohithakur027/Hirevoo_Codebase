'use client';

import { SideBar } from '@/components/layout';
import { SidebarProvider } from '@/context/SidebarContext';
import { useSession } from '@/app/hooks/use-session';
import { useState, useEffect } from 'react';
import { Mail, Shield, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
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
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f0f4f5" }}>
        {/* Left Sidebar */}
        <SideBar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-10 py-3 flex-shrink-0">
            <div>
              <h1 className="text-lg font-semibold text-gray-800">Settings</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="pl-4">
                <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="text-right">
                    {isLoading ? (
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      <p className="text-sm font-medium text-gray-800">{user?.name || "Guest User"}</p>
                    )}
                  </div>
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">{userInitials}</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-10">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold mb-6">Settings</h2>

              {/* Success Message */}
              {successMessage && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-800">{successMessage}</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-800">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-600 hover:text-red-800"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Gmail Integration Section */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <Mail className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Gmail Integration</h3>
                      <p className="text-sm text-gray-600">Connect your Gmail account to send email campaigns</p>
                    </div>
                    <button
                      onClick={fetchGmailStatus}
                      disabled={isGmailLoading}
                      className="ml-auto p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Refresh status"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGmailLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {isGmailLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Checking Gmail status...</span>
                    </div>
                  ) : gmailStatus.isConnected ? (
                    /* Connected State */
                    <div className="space-y-6">
                      {/* Connection Status */}
                      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div className="flex-1">
                          <p className="font-medium text-green-800">Gmail Connected</p>
                          <p className="text-sm text-green-700">Your Gmail account is connected and ready to send campaigns</p>
                        </div>
                      </div>

                      {/* Account Details */}
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Connected Email */}
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500 mb-1">Connected Account</p>
                          <p className="font-medium text-gray-900">
                            {gmailStatus.email || 'Email not available'}
                          </p>
                        </div>

                        {/* Permission Level */}
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-500 mb-1">Permission Level</p>
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-gray-600" />
                            <span className="font-medium text-gray-900">
                              {getPermissionLevelDisplay(gmailStatus.permissionLevel).label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {getPermissionLevelDisplay(gmailStatus.permissionLevel).description}
                          </p>
                        </div>
                      </div>

                      {/* Security Note */}
                      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-800">Secure Connection</p>
                          <p className="text-sm text-blue-700">
                            Your Gmail credentials are encrypted and stored securely. We never store your Gmail password.
                            Tokens are automatically refreshed when needed.
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => setShowConnectModal(true)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Change Permission Level
                        </button>
                        <button
                          onClick={handleDisconnectGmail}
                          disabled={isDisconnecting}
                          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isDisconnecting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Disconnecting...
                            </>
                          ) : (
                            'Disconnect Gmail'
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Not Connected State */
                    <div className="space-y-6">
                      {/* Status */}
                      <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <div className="flex-1">
                          <p className="font-medium text-amber-800">Gmail Not Connected</p>
                          <p className="text-sm text-amber-700">Connect your Gmail account to start sending email campaigns</p>
                        </div>
                      </div>

                      {/* Benefits */}
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900 mb-3">Why connect Gmail?</p>
                        <ul className="space-y-2 text-sm text-gray-600">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Send personalized email campaigns directly from your Gmail
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Better email deliverability using your own domain reputation
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Emails appear in your Sent folder for easy tracking
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Secure OAuth 2.0 authentication (we never see your password)
                          </li>
                        </ul>
                      </div>

                      {/* Connect Button */}
                      <button
                        onClick={() => setShowConnectModal(true)}
                        disabled={isConnecting}
                        className="w-full px-6 py-3 text-white font-medium bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Mail className="w-5 h-5" />
                            Connect Gmail Account
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Section */}
              <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
                </div>
                <div className="p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Name</p>
                      <p className="font-medium text-gray-900">{user?.name || 'Not available'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Email</p>
                      <p className="font-medium text-gray-900">{user?.email || 'Not available'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

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
