/**
 * Initialize Socket.IO server for real-time campaign progress updates.
 * Initializes server if not already running.
 */

import { NextRequest } from 'next/server';
import { getOrCreateSocketServer } from '@/lib/socket/server';

// This route initializes the Socket.IO server
// It's called once when the server starts
export async function GET(request: NextRequest) {
  try {
    // Initialize Socket.IO on first call via workaround
    console.log('[Socket.IO] Initializing Socket.IO server...');

    // Try to initialize Socket.IO server
    // This is a workaround since App Router doesn't expose the HTTP server directly
    const socketServer = getOrCreateSocketServer({} as any);

    if (socketServer) {
      console.log('[Socket.IO] ✅ Socket.IO server initialized successfully');
      return Response.json({
        success: true,
        message: 'Socket.IO server initialized'
      });
    } else {
      console.warn('[Socket.IO] ⚠️ Socket.IO server initialization deferred');
      return Response.json({
        success: false,
        message: 'Socket.IO server initialization deferred - will initialize on first WebSocket connection'
      });
    }
  } catch (error) {
    console.error('[Socket.IO] ❌ Failed to initialize Socket.IO server:', error);
    return Response.json({
      success: false,
      error: 'Failed to initialize Socket.IO server'
    }, { status: 500 });
  }
}