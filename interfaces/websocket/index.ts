import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { Server as HttpsServer } from "https";
import type { IncomingMessage } from "http";
import { pool, db } from "../../db";
import { chatMessages, chatChannelMembers, users, demandReports } from "@shared/schema";
import { userHasAllEffectivePermissions, type CustomPermissions, type Role } from "@shared/permissions";
import { eq, and, or, desc } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import signature from "cookie-signature";
import { logger } from "@platform/logging/Logger";
import { resolveDevelopmentSessionSecret } from "@platform/config/devSessionSecret";

const PgStore = connectPgSimple(session);
const SESSION_SECRET = process.env.NODE_ENV === "production"
  ? (process.env.SESSION_SECRET || "")
  : resolveDevelopmentSessionSecret();
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "corevia.sid";

// Create the shared session store used by the canonical API runtime.
const sessionStore = new PgStore({
  pool: pool,
  tableName: "session",
  createTableIfMissing: true,
});

// Types for WebSocket messages
export type WSMessageType =
  | "presence:update"
  | "presence:request"
  | "chat:message"
  | "chat:history"
  | "chat:typing"
  | "video:offer"
  | "video:answer"
  | "video:ice-candidate"
  | "video:call-start"
  | "video:call-end"
  | "version:viewing"
  | "version:editing"
  | "version:stopped"
  | "version:presence:update"
  | "version:presence:request"
  | "version:edit:takeover"
  | "version:edit:taken"
  | "version:edit:conflict"
  | "heartbeat:ping"
  | "heartbeat:pong"
  | "intelligence:stats:update"
  | "intelligence:learning:complete"
  | "intelligence:generation:complete";

export interface WSMessage {
  type: WSMessageType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export interface UserPresence {
  userId: string;
  displayName?: string;
  status: "online" | "away" | "busy" | "offline";
  lastSeen: Date;
}

// Extended WebSocket to store authenticated userId and heartbeat tracking
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  heartbeatInterval?: NodeJS.Timeout;
}

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const _HEARTBEAT_TIMEOUT = 60000; // 60 seconds - terminate if no response

// Store active WebSocket connections by user ID
const activeConnections = new Map<string, Set<AuthenticatedWebSocket>>();
const userPresence = new Map<string, UserPresence>();

// Version Presence Tracking
// Map<versionId, Map<userId, { activityType, displayName, role, startedAt }>>
interface VersionPresenceInfo {
  userId: string;
  displayName: string;
  role?: string;
  activityType: "viewing" | "editing";
  startedAt: Date;
  lastHeartbeat: Date;
}

const versionPresence = new Map<string, Map<string, VersionPresenceInfo>>();

// Track which versions each user is active on (for cleanup on disconnect)
// Map<userId, Set<versionId>>
const userVersions = new Map<string, Set<string>>();

// Parse session cookie from request headers
function parseCookie(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const key = parts[0]!.trim();
    const value = parts.slice(1).join('=').trim();
    cookies[key] = value;
  });

  return cookies;
}

// Fetch user display name from database
async function getUserDisplayName(userId: string): Promise<string | undefined> {
  try {
    const user = await db.select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user[0]?.displayName || undefined;
  } catch (error) {
    logger.error("[WebSocket] Error fetching user display name:", error);
    return undefined;
  }
}

async function getUserAccess(userId: string) {
  const user = await db
    .select({
      role: users.role,
      customPermissions: users.customPermissions,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user[0];
}

async function canUserReadReport(userId: string, reportId: string): Promise<boolean> {
  const userAccess = await getUserAccess(userId);
  if (!userAccess) return false;

  const hasRead = userHasAllEffectivePermissions(
    userAccess.role as Role,
    ['report:read'],
    userAccess.customPermissions as CustomPermissions | null | undefined
  );

  if (!hasRead) return false;

  const report = await db
    .select({ id: demandReports.id })
    .from(demandReports)
    .where(eq(demandReports.id, reportId))
    .limit(1);
  return !!report[0];
}

async function canUserEditReport(userId: string, reportId: string): Promise<boolean> {
  const userAccess = await getUserAccess(userId);
  if (!userAccess) return false;

  const report = await db
    .select({ id: demandReports.id, createdBy: demandReports.createdBy })
    .from(demandReports)
    .where(eq(demandReports.id, reportId))
    .limit(1);

  if (!report[0]) return false;

  const hasUpdateAny = userHasAllEffectivePermissions(
    userAccess.role as Role,
    ['report:update-any'],
    userAccess.customPermissions as CustomPermissions | null | undefined
  );
  if (hasUpdateAny) return true;

  const hasUpdateSelf = userHasAllEffectivePermissions(
    userAccess.role as Role,
    ['report:update-self'],
    userAccess.customPermissions as CustomPermissions | null | undefined
  );

  return hasUpdateSelf && report[0].createdBy === userId;
}

// Verify session and extract userId
async function verifySession(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const cookies = parseCookie(req.headers.cookie);
    const sessionCookie = cookies[SESSION_COOKIE_NAME];

    if (!sessionCookie) {
      logger.info("[WebSocket] No session cookie found in headers");
      resolve(null);
      return;
    }

    // Decode URL-encoded cookie value
    const decodedCookie = decodeURIComponent(sessionCookie);

    // Parse session ID from signed cookie
    // Format: s:<sessionId>.<signature>
    if (!decodedCookie.startsWith('s:')) {
      logger.info("[WebSocket] Unsigned session cookie rejected");
      resolve(null);
      return;
    }

    if (!SESSION_SECRET) {
      logger.error("[WebSocket] SESSION_SECRET missing; cannot verify session cookie");
      resolve(null);
      return;
    }

    const unsigned = signature.unsign(decodedCookie.slice(2), SESSION_SECRET);
    if (!unsigned) {
      logger.info("[WebSocket] Invalid session cookie signature");
      resolve(null);
      return;
    }

    const sessionId = unsigned;

    logger.info("[WebSocket] Attempting to verify session ID:", sessionId.substring(0, 10) + "...");

    // Get session from store
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionStore.get(sessionId, (err, session: any) => {
      if (err) {
        logger.error("[WebSocket] Error retrieving session:", err);
        resolve(null);
        return;
      }

      if (!session) {
        logger.info("[WebSocket] No session found in store for ID:", sessionId.substring(0, 10) + "...");
        resolve(null);
        return;
      }

      if (!session.userId) {
        logger.info("[WebSocket] Session found but no userId in session");
        resolve(null);
        return;
      }

      logger.info("[WebSocket] Session verified for user:", session.userId);
      resolve(session.userId);
    });
  });
}

export function setupWebSocket(server: HttpServer | HttpsServer) {
  const wss = new WebSocketServer({ noServer: true });

  // Only handle /ws upgrades here so Vite HMR can handle its own WS path.
  server.on("upgrade", (req, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(req.url ?? "", "http://localhost").pathname;
    } catch {
      pathname = (req.url || "").split("?")[0]!;
    }

    if (pathname !== "/ws") {
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    logger.info("[WebSocket] New connection attempt");

    // Authenticate the connection using session
    const userId = await verifySession(req);

    if (!userId) {
      logger.info("[WebSocket] Unauthenticated connection rejected");
      ws.send(JSON.stringify({
        type: "error",
        payload: { message: "Authentication required" }
      }));
      ws.close(1008, "Authentication required");
      return;
    }

    // Store authenticated userId with the WebSocket
    ws.userId = userId;
    ws.isAlive = true;
    logger.info(`[WebSocket] Authenticated connection for user: ${userId}`);

    // Register this connection for the user
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId)!.add(ws);

    // Set up heartbeat mechanism to detect stale connections
    ws.heartbeatInterval = setInterval(() => {
      if (ws.isAlive === false) {
        logger.info(`[WebSocket] Terminating stale connection for user: ${userId}`);
        clearInterval(ws.heartbeatInterval);
        ws.terminate();
        return;
      }

      ws.isAlive = false;
      // Send ping via WebSocket protocol
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        // Also send application-level heartbeat for clients that don't handle protocol pings
        ws.send(JSON.stringify({ type: "heartbeat:ping", payload: { timestamp: Date.now() } }));
      }
    }, HEARTBEAT_INTERVAL);

    // Handle pong response (protocol-level)
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Fetch user display name
    const displayName = await getUserDisplayName(userId);

    // Set user as online with display name
    updateUserPresence(userId, "online", displayName);

    // Broadcast presence update with display name
    broadcastToAll({
      type: "presence:update",
      payload: {
        userId,
        displayName,
        status: "online",
        lastSeen: new Date(),
      },
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());

        switch (message.type) {
          case "presence:update":
            await handlePresenceUpdate(ws, message.payload);
            break;

          case "presence:request":
            await handlePresenceRequest(ws);
            break;

          case "chat:message":
            await handleChatMessage(ws, message.payload);
            break;

          case "chat:history":
            await handleChatHistory(ws, message.payload);
            break;

          case "chat:typing":
            await handleTypingIndicator(ws, message.payload);
            break;

          case "video:offer":
          case "video:answer":
          case "video:ice-candidate":
            await handleWebRTCSignaling(ws, message);
            break;

          case "video:call-start":
          case "video:call-end":
            await handleCallEvent(ws, message);
            break;

          case "version:viewing":
            await handleVersionViewing(ws, message.payload);
            break;

          case "version:editing":
            await handleVersionEditing(ws, message.payload);
            break;

          case "version:stopped":
            await handleVersionStopped(ws, message.payload);
            break;

          case "version:presence:request":
            await handleVersionPresenceRequest(ws, message.payload);
            break;

          case "version:edit:takeover":
            await handleVersionEditTakeover(ws, message.payload);
            break;

          case "heartbeat:pong":
            // Client responded to heartbeat - mark connection as alive
            ws.isAlive = true;
            break;

          default:
            logger.info("[WebSocket] Unknown message type:", message.type);
        }
      } catch (error) {
        logger.error("[WebSocket] Error processing message:", error);
        ws.send(JSON.stringify({ type: "error", payload: { message: "Invalid message format" } }));
      }
    });

    ws.on("close", () => {
      logger.info(`[WebSocket] Connection closed for user: ${userId}`);

      // Clear heartbeat interval
      if (ws.heartbeatInterval) {
        clearInterval(ws.heartbeatInterval);
      }

      // Clean up version presence for this user
      const versions = userVersions.get(userId);
      if (versions) {
        versions.forEach((versionId) => {
          removeVersionPresence(versionId, userId);
        });
        userVersions.delete(userId);
      }

      // Remove this connection from active connections
      const userConnections = activeConnections.get(userId);
      if (userConnections) {
        userConnections.delete(ws);

        // If no more connections for this user, mark as offline
        if (userConnections.size === 0) {
          activeConnections.delete(userId);
          updateUserPresence(userId, "offline");

          // Broadcast offline status
          broadcastToAll({
            type: "presence:update",
            payload: {
              userId,
              status: "offline",
              lastSeen: new Date(),
            },
          });
        }
      }
    });

    ws.on("error", (error) => {
      logger.error(`[WebSocket] WebSocket error for user ${userId}:`, error);
    });
  });

  logger.info("[WebSocket] WebSocket server initialized on path /ws");
  return wss;
}

// Presence Handlers
async function handlePresenceUpdate(ws: AuthenticatedWebSocket, payload: { status: "online" | "away" | "busy" }) {
  // Use authenticated userId from the WebSocket, not from client payload
  const userId = ws.userId!;
  const { status } = payload;

  // Fetch user display name
  const displayName = await getUserDisplayName(userId);

  updateUserPresence(userId, status, displayName);

  // Broadcast presence update to all connected clients
  broadcastToAll({
    type: "presence:update",
    payload: {
      userId,
      displayName,
      status,
      lastSeen: new Date(),
    },
  });
}

function updateUserPresence(userId: string, status: "online" | "away" | "busy" | "offline", displayName?: string) {
  userPresence.set(userId, {
    userId,
    displayName,
    status,
    lastSeen: new Date(),
  });
}

async function handlePresenceRequest(ws: AuthenticatedWebSocket) {
  const presence = Array.from(userPresence.values());

  // Fetch display names for all users if not already set
  const presenceWithNames = await Promise.all(
    presence.map(async (p) => {
      if (!p.displayName) {
        const displayName = await getUserDisplayName(p.userId);
        return { ...p, displayName };
      }
      return p;
    })
  );

  ws.send(JSON.stringify({
    type: "presence:update",
    payload: presenceWithNames,
  }));
}

// Chat Handlers
async function handleChatMessage(ws: AuthenticatedWebSocket, payload: {
  recipientId?: string;
  channelId?: string;
  message: string;
  messageType?: string;
}) {
  // Use authenticated userId from the WebSocket, not from client payload
  const senderId = ws.userId!;

  try {
    // Save message to database with server-verified senderId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageData: Record<string, any> = {
      senderId: senderId, // Use server-verified userId
      message: payload.message,
      messageType: payload.messageType || "text",
    };

    if (payload.recipientId) {
      messageData.recipientId = payload.recipientId;
    }

    if (payload.channelId) {
      messageData.channelId = payload.channelId;
    }

    const [newMessage] = await db.insert(chatMessages).values(messageData as typeof chatMessages.$inferInsert).returning();

    // Broadcast to relevant users
    if (payload.recipientId) {
      // Direct message - send to sender and recipient
      broadcastToUsers([senderId, payload.recipientId], {
        type: "chat:message",
        payload: newMessage,
      });
    } else if (payload.channelId) {
      // Channel message - send only to channel members
      const members = await db.select({ userId: chatChannelMembers.userId })
        .from(chatChannelMembers)
        .where(eq(chatChannelMembers.channelId, payload.channelId));

      const memberIds = members.map(m => m.userId);
      // Always include the sender
      if (!memberIds.includes(senderId)) {
        memberIds.push(senderId);
      }
      broadcastToUsers(memberIds, {
        type: "chat:message",
        payload: newMessage,
      });
    }
  } catch (error) {
    logger.error("[WebSocket] Error saving chat message:", error);
    ws.send(JSON.stringify({ type: "error", payload: { message: "Failed to send message" } }));
  }
}

async function handleChatHistory(ws: AuthenticatedWebSocket, payload: { recipientId?: string; channelId?: string; limit?: number }) {
  // Use authenticated userId from the WebSocket, not from client payload
  const userId = ws.userId!;

  try {
    const limit = payload.limit || 50;
    let messages;

    if (payload.recipientId) {
      // Get direct message history using server-verified userId
      messages = await db
        .select()
        .from(chatMessages)
        .where(
          or(
            and(
              eq(chatMessages.senderId, userId),
              eq(chatMessages.recipientId, payload.recipientId)
            ),
            and(
              eq(chatMessages.senderId, payload.recipientId),
              eq(chatMessages.recipientId, userId)
            )
          )
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);
    } else if (payload.channelId) {
      // Get channel message history
      messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.channelId, payload.channelId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);
    }

    ws.send(JSON.stringify({
      type: "chat:history",
      payload: messages || [],
    }));
  } catch (error) {
    logger.error("[WebSocket] Error fetching chat history:", error);
    ws.send(JSON.stringify({ type: "error", payload: { message: "Failed to fetch chat history" } }));
  }
}

async function handleTypingIndicator(ws: AuthenticatedWebSocket, payload: { recipientId?: string; channelId?: string; isTyping: boolean }) {
  // Use authenticated userId from the WebSocket, not from client payload
  const userId = ws.userId!;

  const typingPayload = {
    userId, // Use server-verified userId
    isTyping: payload.isTyping,
    recipientId: payload.recipientId,
    channelId: payload.channelId,
  };

  if (payload.recipientId) {
    broadcastToUsers([payload.recipientId], {
      type: "chat:typing",
      payload: typingPayload,
    });
  } else if (payload.channelId) {
    // Broadcast to all channel members except sender
    broadcastToAll({
      type: "chat:typing",
      payload: typingPayload,
    });
  }
}

// WebRTC Signaling Handlers
async function handleWebRTCSignaling(ws: AuthenticatedWebSocket, message: WSMessage) {
  // Use authenticated userId from the WebSocket, not from client payload
  const senderId = ws.userId!;
  const { recipientId, ...payloadRest } = message.payload;

  if (recipientId) {
    // Include server-verified sender's userId in the payload
    broadcastToUsers([recipientId], {
      ...message,
      payload: {
        ...payloadRest,
        senderId, // Use server-verified userId
        recipientId,
      },
    });
  }
}

async function handleCallEvent(ws: AuthenticatedWebSocket, message: WSMessage) {
  // Use authenticated userId from the WebSocket, not from client payload
  const senderId = ws.userId!;
  const { recipientId, participants, ...payloadRest } = message.payload;

  if (recipientId) {
    broadcastToUsers([recipientId], {
      ...message,
      payload: {
        ...payloadRest,
        senderId, // Use server-verified userId
        recipientId,
      },
    });
  } else if (participants) {
    broadcastToUsers(participants, {
      ...message,
      payload: {
        ...payloadRest,
        senderId, // Use server-verified userId
        participants,
      },
    });
  }
}

// Version Presence Handlers
async function handleVersionViewing(ws: AuthenticatedWebSocket, payload: { versionId: string; reportId: string }) {
  const userId = ws.userId!;
  const { versionId, reportId } = payload;

  if (!versionId || !reportId) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing versionId or reportId" } }));
    return;
  }

  if (!(await canUserReadReport(userId, reportId))) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Insufficient permissions to view report" } }));
    return;
  }

  // Fetch user details
  const displayName = await getUserDisplayName(userId);
  const user = await db.select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const presenceInfo: VersionPresenceInfo = {
    userId,
    displayName: displayName || "Unknown User",
    role: user[0]?.role,
    activityType: "viewing",
    startedAt: new Date(),
    lastHeartbeat: new Date(),
  };

  // Update version presence
  if (!versionPresence.has(versionId)) {
    versionPresence.set(versionId, new Map());
  }
  versionPresence.get(versionId)!.set(userId, presenceInfo);

  // Track user's active versions
  if (!userVersions.has(userId)) {
    userVersions.set(userId, new Set());
  }
  userVersions.get(userId)!.add(versionId);

  logger.info(`[Version Presence] User ${displayName} started viewing version ${versionId}`);

  // Broadcast presence update to all users viewing this version
  broadcastVersionPresence(versionId);
}

async function handleVersionEditing(ws: AuthenticatedWebSocket, payload: { versionId: string; reportId: string; takeover?: boolean }) {
  const userId = ws.userId!;
  const { versionId, reportId, takeover } = payload;

  if (!versionId || !reportId) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing versionId or reportId" } }));
    return;
  }

  if (!(await canUserEditReport(userId, reportId))) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Insufficient permissions to edit report" } }));
    return;
  }

  // Check if someone else is already editing
  const currentEditor = getVersionEditor(versionId);
  if (currentEditor && currentEditor.userId !== userId && !takeover) {
    // Someone else is editing - send conflict notification
    ws.send(JSON.stringify({
      type: "version:edit:conflict",
      payload: {
        versionId,
        currentEditor: {
          userId: currentEditor.userId,
          displayName: currentEditor.displayName,
          role: currentEditor.role,
        },
      },
    }));
    return;
  }

  // Notify previous editor if this is a takeover
  if (currentEditor && currentEditor.userId !== userId && takeover) {
    broadcastToUsers([currentEditor.userId], {
      type: "version:edit:taken",
      payload: {
        versionId,
        takenBy: userId,
        message: "Another user has taken over editing this version",
      },
    });
  }

  // Fetch user details
  const displayName = await getUserDisplayName(userId);
  const user = await db.select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const presenceInfo: VersionPresenceInfo = {
    userId,
    displayName: displayName || "Unknown User",
    role: user[0]?.role,
    activityType: "editing",
    startedAt: new Date(),
    lastHeartbeat: new Date(),
  };

  // Update version presence
  if (!versionPresence.has(versionId)) {
    versionPresence.set(versionId, new Map());
  }
  versionPresence.get(versionId)!.set(userId, presenceInfo);

  // Track user's active versions
  if (!userVersions.has(userId)) {
    userVersions.set(userId, new Set());
  }
  userVersions.get(userId)!.add(versionId);

  logger.info(`[Version Presence] User ${displayName} started editing version ${versionId}`);

  // Broadcast presence update
  broadcastVersionPresence(versionId);
}

async function handleVersionStopped(ws: AuthenticatedWebSocket, payload: { versionId: string }) {
  const userId = ws.userId!;
  const { versionId } = payload;

  if (!versionId) {
    return;
  }

  removeVersionPresence(versionId, userId);
}

async function handleVersionPresenceRequest(ws: AuthenticatedWebSocket, payload: { versionId: string }) {
  const { versionId } = payload;

  if (!versionId) {
    ws.send(JSON.stringify({ type: "error", payload: { message: "Missing versionId" } }));
    return;
  }

  const presence = versionPresence.get(versionId);
  const presenceList = presence ? Array.from(presence.values()) : [];

  ws.send(JSON.stringify({
    type: "version:presence:update",
    payload: {
      versionId,
      viewers: presenceList.filter(p => p.activityType === "viewing"),
      editors: presenceList.filter(p => p.activityType === "editing"),
    },
  }));
}

async function handleVersionEditTakeover(ws: AuthenticatedWebSocket, payload: { versionId: string; reportId: string }) {
  // Handle takeover by calling handleVersionEditing with takeover flag
  await handleVersionEditing(ws, { ...payload, takeover: true });
}

// Helper function to remove version presence
function removeVersionPresence(versionId: string, userId: string) {
  const presence = versionPresence.get(versionId);
  if (presence) {
    presence.delete(userId);
    if (presence.size === 0) {
      versionPresence.delete(versionId);
    } else {
      // Broadcast updated presence
      broadcastVersionPresence(versionId);
    }
  }

  // Clean up user's version tracking
  const versions = userVersions.get(userId);
  if (versions) {
    versions.delete(versionId);
    if (versions.size === 0) {
      userVersions.delete(userId);
    }
  }

  logger.info(`[Version Presence] User ${userId} stopped activity on version ${versionId}`);
}

// Helper function to get current editor of a version
function getVersionEditor(versionId: string): VersionPresenceInfo | null {
  const presence = versionPresence.get(versionId);
  if (!presence) return null;

  const presenceArray = Array.from(presence.values());
  for (const info of presenceArray) {
    if (info.activityType === "editing") {
      return info;
    }
  }
  return null;
}

// Helper function to broadcast version presence updates
function broadcastVersionPresence(versionId: string) {
  const presence = versionPresence.get(versionId);
  const presenceList = presence ? Array.from(presence.values()) : [];

  // Get all users viewing or editing this version
  const affectedUserIds = presenceList.map(p => p.userId);

  if (affectedUserIds.length > 0) {
    broadcastToUsers(affectedUserIds, {
      type: "version:presence:update",
      payload: {
        versionId,
        viewers: presenceList.filter(p => p.activityType === "viewing"),
        editors: presenceList.filter(p => p.activityType === "editing"),
      },
    });
  }
}

// Export function to get version viewers/editors for API endpoints
export function getVersionPresence(versionId: string): { viewers: VersionPresenceInfo[]; editors: VersionPresenceInfo[] } {
  const presence = versionPresence.get(versionId);
  const presenceList = presence ? Array.from(presence.values()) : [];

  return {
    viewers: presenceList.filter(p => p.activityType === "viewing"),
    editors: presenceList.filter(p => p.activityType === "editing"),
  };
}

// Utility functions
function broadcastToAll(message: WSMessage) {
  const messageStr = JSON.stringify(message);
  activeConnections.forEach((connections) => {
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  });
}

function broadcastToUsers(userIds: string[], message: WSMessage) {
  const messageStr = JSON.stringify(message);
  userIds.forEach((userId) => {
    const connections = activeConnections.get(userId);
    if (connections) {
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  });
}

export function getOnlineUsers(): string[] {
  return Array.from(activeConnections.keys());
}

export function getUserPresenceStatus(userId: string): UserPresence | null {
  return userPresence.get(userId) || null;
}

export function broadcastIntelligenceUpdate(
  eventType: 'intelligence:stats:update' | 'intelligence:learning:complete' | 'intelligence:generation:complete',
  payload: Record<string, unknown>
): void {
  const message = JSON.stringify({
    type: eventType,
    payload: {
      ...payload,
      timestamp: new Date().toISOString(),
    },
  });

  let sentCount = 0;
  activeConnections.forEach((sockets) => {
    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    });
  });

  if (sentCount > 0) {
    logger.info(`[WebSocket] Broadcast ${eventType} to ${sentCount} clients`);
  }
}
