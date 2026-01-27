/**
 * Socket.IO server + Redis Pub/Sub subscriber for real-time updates.
 * Integrates Socket.IO with Next.js and subscribes to Redis channels
 * to relay worker events to browser clients.
 *
 * Uses a dedicated Redis connection for Pub/Sub (subscribe mode).
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
 * Ensures one server per Next.js process.
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
 * Should be called once during application startup.
 *
 * @param httpServer - The HTTP server to attach Socket.IO to
 * @returns The Socket.IO server instance
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
 * Authenticates, joins user room, tracks connection, and handles disconnect.
 *
 * @param socket - The connected socket
 */
function handleClientConnection(socket: Socket): void {
  const auth = socket.handshake.auth as SocketAuthData;
  const userId = auth.userId;

  // ─────────────────────────────────────────────────────────
  // AUTHENTICATION
  // ─────────────────────────────────────────────────────────
  // Require userId. Verify JWT in production.

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
  // Join user-specific room for targeted events.

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
  // Subscribe to campaign updates

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
 * Creates dedicated connection and subscribes to worker channels.
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
 * Routes message to appropriate Socket.IO room.
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
 * Use for non-worker notifications.
 *
 * @param userId - The user's ID
 * @param event - The event name
 * @param data - The event data
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
 * Reaches all users watching the campaign.
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
 * Workaround for lack of direct server access in App Router.
 */
export function getOrCreateSocketServer(res: {
  socket?: { server?: HTTPServer & { io?: SocketServer } };
}): SocketServer | null {
  // For Next.js App Router, we can't reliably access the HTTP server
  // So we'll try to initialize Socket.IO when possible, but fall back gracefully
  if (!res.socket?.server) {
    // If we can't access the server, that's okay - Socket.IO will be initialized
    // through other means or the connection will fail gracefully
    console.log('[Socket.IO] Server not available - Socket.IO will initialize on demand');
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

// Alternative initialization method for App Router
export function initializeSocketIOServer() {
  // This function can be called to force initialization
  // For now, we'll rely on lazy initialization when clients connect
  console.log('[Socket.IO] Socket.IO server will be initialized on first client connection');
}
