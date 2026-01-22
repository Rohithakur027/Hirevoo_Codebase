/**
 * lib/socket/server.ts
 *
 * Purpose: Socket.IO server + Redis Pub/Sub subscriber for real-time updates
 *
 * This file creates a Socket.IO server that integrates with the Next.js
 * HTTP server and subscribes to Redis Pub/Sub channels to relay events
 * from the background worker to connected browser clients.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                      NEXT.JS PROCESS                                │
 * │                                                                     │
 * │  ┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐ │
 * │  │ Socket.IO       │ ←── │ Redis Pub/Sub   │ ←── │ Worker       │ │
 * │  │ Server          │     │ Subscriber      │     │ (publishes)  │ │
 * │  └────────┬────────┘     └─────────────────┘     └──────────────┘ │
 * │           │                                                        │
 * │           │ WebSocket                                              │
 * │           ▼                                                        │
 * └───────────┼────────────────────────────────────────────────────────┘
 *             │
 *             ▼
 *      ┌─────────────┐
 *      │  Browser    │
 *      │  Client     │
 *      └─────────────┘
 *
 * Why separate Redis connection for Pub/Sub?
 * Redis connections can operate in either normal mode or subscribe mode,
 * but not both. Once a connection calls SUBSCRIBE, it can only receive
 * messages on subscribed channels - it cannot execute other commands.
 * Therefore, we need a dedicated connection for Pub/Sub.
 *
 * @module lib/socket/server
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createRedisConnection } from '../queue/config';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Socket.IO server instance type.
 */
type SocketServer = SocketIOServer;

/**
 * User authentication data passed during socket connection.
 */
interface SocketAuthData {
  userId: string;
  token?: string;
}

/**
 * Events published by the worker via Redis Pub/Sub.
 */
interface EmailSentEvent {
  userId: string;
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
  userId: string;
  campaignId: string;
  emailId: string;
  recipientEmail: string;
  error: string;
  errorCode: string;
  timestamp: string;
}

interface CampaignCompleteEvent {
  userId: string;
  campaignId: string;
  totalSent: number;
  totalFailed: number;
  duration: number;
  timestamp: string;
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

/**
 * Singleton Socket.IO server instance.
 * We only want one server per Next.js process.
 */
let io: SocketServer | null = null;

/**
 * Dedicated Redis connection for Pub/Sub subscription.
 * This connection will be in subscribe mode and cannot execute
 * other Redis commands.
 */
let subscriberRedis: ReturnType<typeof createRedisConnection> | null = null;

/**
 * Track connected clients by userId for debugging.
 */
const connectedClients = new Map<string, Set<string>>(); // userId -> Set<socketId>

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initializes the Socket.IO server and Redis Pub/Sub subscriber.
 *
 * This function should be called once during application startup,
 * typically in a custom server setup or API route that initializes
 * the WebSocket server.
 *
 * @param httpServer - The HTTP server to attach Socket.IO to
 * @returns The Socket.IO server instance
 *
 * @example
 * // In your custom server or initialization code
 * import { createServer } from 'http';
 * import { initSocket } from '@/lib/socket/server';
 *
 * const httpServer = createServer(app);
 * const io = initSocket(httpServer);
 * httpServer.listen(3000);
 */
export function initSocket(httpServer: HTTPServer): SocketServer {
  // ─────────────────────────────────────────────────────────
  // PREVENT DUPLICATE INITIALIZATION
  // ─────────────────────────────────────────────────────────
  if (io) {
    console.log('[Socket.IO] Already initialized, returning existing instance');
    return io;
  }

  console.log('[Socket.IO] Initializing Socket.IO server...');

  // ─────────────────────────────────────────────────────────
  // CREATE SOCKET.IO SERVER
  // ─────────────────────────────────────────────────────────
  io = new SocketIOServer(httpServer, {
    // CORS configuration for Next.js development
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },

    // Path for Socket.IO (default is /socket.io)
    path: '/socket.io',

    // Transports: prefer WebSocket, fall back to polling
    transports: ['websocket', 'polling'],

    // Connection settings
    pingTimeout: 60000, // How long to wait for pong before disconnecting
    pingInterval: 25000, // How often to ping clients
  });

  // ─────────────────────────────────────────────────────────
  // HANDLE CLIENT CONNECTIONS
  // ─────────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    handleClientConnection(socket);
  });

  // ─────────────────────────────────────────────────────────
  // SETUP REDIS PUB/SUB SUBSCRIBER
  // ─────────────────────────────────────────────────────────
  setupRedisPubSub();

  console.log('[Socket.IO] ✅ Socket.IO server initialized');

  return io;
}

// ============================================================
// CLIENT CONNECTION HANDLING
// ============================================================

/**
 * Handles a new client connection.
 *
 * When a client connects, we:
 * 1. Authenticate them (verify userId)
 * 2. Join them to their user-specific room
 * 3. Track the connection for debugging
 * 4. Set up disconnect handler
 *
 * @param socket - The connected socket
 */
function handleClientConnection(socket: Socket): void {
  const auth = socket.handshake.auth as SocketAuthData;
  const userId = auth.userId;

  // ─────────────────────────────────────────────────────────
  // AUTHENTICATION
  // ─────────────────────────────────────────────────────────
  // Require userId for all connections. In production, you'd also
  // verify a JWT token here.

  if (!userId) {
    console.warn(
      `[Socket.IO] Connection rejected - no userId provided. ` +
        `Socket ID: ${socket.id}`
    );
    socket.emit('error', { message: 'Authentication required: userId missing' });
    socket.disconnect(true);
    return;
  }

  // TODO: In production, verify the auth.token JWT here
  // const isValid = await verifyToken(auth.token, userId);
  // if (!isValid) {
  //   socket.disconnect(true);
  //   return;
  // }

  console.log(
    `[Socket.IO] Client connected - User: ${userId.substring(0, 8)}..., ` +
      `Socket: ${socket.id}`
  );

  // ─────────────────────────────────────────────────────────
  // JOIN USER ROOM
  // ─────────────────────────────────────────────────────────
  // Each user gets their own room. Events are broadcast to
  // rooms, so only the relevant user receives their updates.

  const userRoom = `user:${userId}`;
  socket.join(userRoom);

  console.log(`[Socket.IO] Socket ${socket.id} joined room: ${userRoom}`);

  // ─────────────────────────────────────────────────────────
  // TRACK CONNECTION
  // ─────────────────────────────────────────────────────────

  if (!connectedClients.has(userId)) {
    connectedClients.set(userId, new Set());
  }
  connectedClients.get(userId)!.add(socket.id);

  // Send connection confirmation to client
  socket.emit('connected', {
    socketId: socket.id,
    userId,
    room: userRoom,
    timestamp: new Date().toISOString(),
  });

  // ─────────────────────────────────────────────────────────
  // HANDLE DISCONNECT
  // ─────────────────────────────────────────────────────────

  socket.on('disconnect', (reason: string) => {
    console.log(
      `[Socket.IO] Client disconnected - User: ${userId.substring(0, 8)}..., ` +
        `Socket: ${socket.id}, Reason: ${reason}`
    );

    // Remove from tracking
    const userSockets = connectedClients.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        connectedClients.delete(userId);
      }
    }
  });

  // ─────────────────────────────────────────────────────────
  // HANDLE CLIENT EVENTS
  // ─────────────────────────────────────────────────────────
  // Clients can subscribe to specific campaign updates

  socket.on('subscribe:campaign', (campaignId: string) => {
    const campaignRoom = `campaign:${campaignId}`;
    socket.join(campaignRoom);
    console.log(
      `[Socket.IO] Socket ${socket.id} subscribed to campaign: ${campaignId}`
    );
  });

  socket.on('unsubscribe:campaign', (campaignId: string) => {
    const campaignRoom = `campaign:${campaignId}`;
    socket.leave(campaignRoom);
    console.log(
      `[Socket.IO] Socket ${socket.id} unsubscribed from campaign: ${campaignId}`
    );
  });
}

// ============================================================
// REDIS PUB/SUB SETUP
// ============================================================

/**
 * Sets up the Redis Pub/Sub subscriber.
 *
 * Creates a dedicated Redis connection for subscribing to channels
 * and relays received messages to connected Socket.IO clients.
 */
function setupRedisPubSub(): void {
  if (subscriberRedis) {
    console.log('[Redis PubSub] Already subscribed');
    return;
  }

  console.log('[Redis PubSub] Setting up subscriber...');

  // Create dedicated connection for Pub/Sub
  subscriberRedis = createRedisConnection('socket-pubsub-subscriber');

  // ─────────────────────────────────────────────────────────
  // SUBSCRIBE TO CHANNELS
  // ─────────────────────────────────────────────────────────
  // These channels match what the worker publishes to
  const channels = ['email:sent', 'email:failed', 'campaign:complete'];

  subscriberRedis.subscribe(...channels, (err, count) => {
    if (err) {
      console.error('[Redis PubSub] Failed to subscribe:', err);
      return;
    }
    console.log(`[Redis PubSub] ✅ Subscribed to ${count} channels:`, channels);
  });

  // ─────────────────────────────────────────────────────────
  // HANDLE INCOMING MESSAGES
  // ─────────────────────────────────────────────────────────
  subscriberRedis.on('message', (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      handlePubSubMessage(channel, data);
    } catch (error) {
      console.error(
        `[Redis PubSub] Failed to parse message on ${channel}:`,
        error
      );
    }
  });

  // Handle Redis errors
  subscriberRedis.on('error', (error) => {
    console.error('[Redis PubSub] Connection error:', error.message);
  });
}

/**
 * Handles a message received from Redis Pub/Sub.
 *
 * Routes the message to the appropriate Socket.IO room based on
 * the channel and message content.
 *
 * @param channel - The Redis channel the message was received on
 * @param data - The parsed message data
 */
function handlePubSubMessage(
  channel: string,
  data: EmailSentEvent | EmailFailedEvent | CampaignCompleteEvent
): void {
  if (!io) {
    console.warn('[Redis PubSub] Socket.IO not initialized, dropping message');
    return;
  }

  const { userId, campaignId } = data;
  const userRoom = `user:${userId}`;
  const campaignRoom = `campaign:${campaignId}`;

  console.log(
    `[Redis PubSub] Received on ${channel} - ` +
      `User: ${userId.substring(0, 8)}, Campaign: ${campaignId.substring(0, 8)}`
  );

  // ─────────────────────────────────────────────────────────
  // ROUTE MESSAGE TO APPROPRIATE ROOMS
  // ─────────────────────────────────────────────────────────

  switch (channel) {
    case 'email:sent': {
      const event = data as EmailSentEvent;

      // Emit to user's room
      io.to(userRoom).emit('email:sent', {
        campaignId: event.campaignId,
        emailId: event.emailId,
        recipientEmail: event.recipientEmail,
        progress: event.progress,
        sent: event.sent,
        failed: event.failed,
        total: event.total,
        timestamp: event.timestamp,
      });

      // Also emit to campaign-specific room
      io.to(campaignRoom).emit('email:sent', event);

      break;
    }

    case 'email:failed': {
      const event = data as EmailFailedEvent;

      io.to(userRoom).emit('email:failed', {
        campaignId: event.campaignId,
        emailId: event.emailId,
        recipientEmail: event.recipientEmail,
        error: event.error,
        errorCode: event.errorCode,
        timestamp: event.timestamp,
      });

      io.to(campaignRoom).emit('email:failed', event);

      break;
    }

    case 'campaign:complete': {
      const event = data as CampaignCompleteEvent;

      io.to(userRoom).emit('campaign:complete', {
        campaignId: event.campaignId,
        totalSent: event.totalSent,
        totalFailed: event.totalFailed,
        duration: event.duration,
        timestamp: event.timestamp,
      });

      io.to(campaignRoom).emit('campaign:complete', event);

      break;
    }

    default:
      console.warn(`[Redis PubSub] Unknown channel: ${channel}`);
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Emits an event directly to a specific user.
 *
 * Use this for events that don't come from the worker (e.g.,
 * notifications from API routes).
 *
 * @param userId - The user's ID
 * @param event - The event name
 * @param data - The event data
 *
 * @example
 * // Notify user of something from an API route
 * emitToUser(userId, 'notification', {
 *   title: 'Campaign Ready',
 *   message: 'Your campaign is ready to send'
 * });
 */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) {
    console.warn('[Socket.IO] Cannot emit - server not initialized');
    return;
  }

  const userRoom = `user:${userId}`;
  io.to(userRoom).emit(event, data);

  console.log(
    `[Socket.IO] Emitted ${event} to user ${userId.substring(0, 8)}:`,
    typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : data
  );
}

/**
 * Emits an event to a specific campaign room.
 *
 * Use this for campaign-specific updates that should reach all
 * users watching that campaign.
 *
 * @param campaignId - The campaign ID
 * @param event - The event name
 * @param data - The event data
 */
export function emitToCampaign(
  campaignId: string,
  event: string,
  data: unknown
): void {
  if (!io) {
    console.warn('[Socket.IO] Cannot emit - server not initialized');
    return;
  }

  const campaignRoom = `campaign:${campaignId}`;
  io.to(campaignRoom).emit(event, data);
}

/**
 * Gets the current Socket.IO server instance.
 *
 * @returns The Socket.IO server or null if not initialized
 */
export function getSocketServer(): SocketServer | null {
  return io;
}

/**
 * Gets connection statistics.
 *
 * Useful for monitoring and debugging.
 *
 * @returns Connection statistics
 */
export function getConnectionStats(): {
  totalConnections: number;
  uniqueUsers: number;
  userConnections: Record<string, number>;
} {
  const userConnections: Record<string, number> = {};
  let totalConnections = 0;

  connectedClients.forEach((sockets, userId) => {
    userConnections[userId.substring(0, 8) + '...'] = sockets.size;
    totalConnections += sockets.size;
  });

  return {
    totalConnections,
    uniqueUsers: connectedClients.size,
    userConnections,
  };
}

/**
 * Gracefully closes the Socket.IO server and Redis subscriber.
 *
 * Call this during application shutdown.
 */
export async function closeSocket(): Promise<void> {
  console.log('[Socket.IO] Closing...');

  if (subscriberRedis) {
    await subscriberRedis.unsubscribe();
    subscriberRedis.disconnect();
    subscriberRedis = null;
  }

  if (io) {
    await new Promise<void>((resolve) => {
      io!.close(() => {
        console.log('[Socket.IO] Server closed');
        resolve();
      });
    });
    io = null;
  }
}

// ============================================================
// NEXT.JS INTEGRATION HELPERS
// ============================================================

/**
 * Helper for initializing Socket.IO in Next.js API routes.
 *
 * Next.js doesn't give direct access to the HTTP server in App Router,
 * so we use a workaround: attach Socket.IO to the response socket's server.
 *
 * @example
 * // In app/api/socket/route.ts
 * import { initSocketInNextJS } from '@/lib/socket/server';
 *
 * export async function GET(req: Request) {
 *   // This won't work directly in App Router
 *   // See README for proper Next.js integration
 * }
 */
export function getOrCreateSocketServer(res: {
  socket?: { server?: HTTPServer & { io?: SocketServer } };
}): SocketServer | null {
  // Check if socket is available (won't be in Edge runtime)
  if (!res.socket?.server) {
    console.warn('[Socket.IO] No server available on response socket');
    return null;
  }

  const server = res.socket.server;

  // Check if Socket.IO is already attached
  if (server.io) {
    return server.io;
  }

  // Initialize and attach
  const socketServer = initSocket(server);
  server.io = socketServer;

  return socketServer;
}
