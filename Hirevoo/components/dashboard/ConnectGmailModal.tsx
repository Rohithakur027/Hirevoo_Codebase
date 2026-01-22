import React, { useState } from 'react';
import { Mail, Lock, Shield, X } from 'lucide-react';


export type PermissionLevel = 'SEND_ONLY' | 'FULL_ACCESS';

export interface ConnectGmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (permissionLevel: PermissionLevel) => Promise<void>;
}

const ConnectGmailModal: React.FC<ConnectGmailModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>('FULL_ACCESS');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnect(selectedPermission);
      // Optional: Reset state or close automatically depending on your needs
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Return null if not open to prevent rendering
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="relative bg-gray-50 p-6 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Connect Your Gmail</h2>
              <p className="text-gray-600 text-sm mt-1">
                Choose how you want to connect your Gmail for maximum productivity
              </p>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="px-6 py-3">
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Secure & Encrypted
              </span>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="px-6 pb-6 space-y-3">

          {/* Send Only Option */}
          <div
            onClick={() => setSelectedPermission('SEND_ONLY')}
            className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
              selectedPermission === 'SEND_ONLY'
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedPermission === 'SEND_ONLY'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedPermission === 'SEND_ONLY' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">Send Only</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    Basic
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Perfect for simple sending needs. Just send emails without advanced features.
                </p>
                <div className="text-xs text-gray-500">
                  • Send campaign emails<br />
                  • Basic email delivery<br />
                  • Quick setup with minimal permissions
                </div>
              </div>
            </div>
          </div>

          {/* Full Access Option */}
          <div
            onClick={() => setSelectedPermission('FULL_ACCESS')}
            className={`border-2 rounded-xl p-4 cursor-pointer transition-all relative ${
              selectedPermission === 'FULL_ACCESS'
                ? 'border-black bg-gray-50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="absolute -top-2 -right-2 text-black text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#cef562' }}>
              Recommended
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedPermission === 'FULL_ACCESS'
                      ? 'border-black bg-black'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedPermission === 'FULL_ACCESS' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">Read & Write</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Full Access
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Unlock the full power of automated email marketing with complete Gmail integration.
                </p>
                <div className="text-xs text-gray-500">
                  • Send and manage campaigns<br />
                  • Track opens, clicks, and replies<br />
                  • Automated follow-ups and sequences<br />
                  • Advanced analytics and insights
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-3">
            <Lock className="w-4 h-4" />
            <span>Secured by Google OAuth 2.0</span>
          </div>
          <div className="flex items-center justify-center">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-6 py-2 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  connect securely
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectGmailModal;