import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { z } from 'zod';
import { collaborationClientEvents, collaborationServerEvents, collaborationColor, type CollaborationClientEvent, type CollaborationPresence, type CollaborationServerEvent } from '../../../shared/collaboration.js';
import { UserService } from '../services/userService.js';
import { BoardService } from '../services/boardService.js';
import type { BoardObject } from '../types.js';
import { logger } from '../logging.js';

type Client = WebSocket & { userId?: string; boards: Set<string> };

export const collaborationObjectSchema = z.object({
  id: z.string().min(1).max(200), type: z.enum(['circle', 'rectangle', 'point', 'polygon', 'polyline', 'pen', 'line', 'arrow', 'note']),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).strict(), dimensions: z.object({ width: z.number().finite().nonnegative(), height: z.number().finite().nonnegative() }).strict(),
  rotation: z.number().finite(), style: z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict(), text: z.string().max(10000).optional(), properties: z.record(z.string().max(64), z.unknown()).optional(),
}).strict();
export const collaborationEventSchema = z.object({ type: z.enum(Object.values(collaborationClientEvents) as [string, ...string[]]), boardId: z.string().uuid(), operationId: z.string().uuid().optional(), timestamp: z.number().finite(), payload: z.unknown().optional() }).strict();
export const collaborationCursorSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const userService = new UserService();
const boardService = new BoardService();

const send = (client: Client, event: CollaborationServerEvent) => {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
};

export class CollaborationServer {
  private readonly webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  private readonly rooms = new Map<string, Set<Client>>();

  attach(server: HttpServer) {
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname !== '/ws') return;
      this.webSocketServer.handleUpgrade(request, socket, head, (client) => this.handleConnection(client as Client, request));
    });
  }

  private async handleConnection(client: Client, request: IncomingMessage) {
    try {
      const token = new URL(request.url ?? '/', 'http://localhost').searchParams.get('token');
      if (!token) throw new Error('Authentication required');
      client.userId = userService.verifyToken(token);
      client.boards = new Set();
      logger.info('WebSocket client connected');
      client.on('message', (raw) => void this.handleMessage(client, raw));
      client.on('close', () => {
        logger.info('WebSocket client disconnected');
        this.leaveAll(client);
      });
      client.on('error', () => {
        logger.warn('WebSocket client error');
        this.leaveAll(client);
      });
    } catch {
      logger.warn('WebSocket authentication failed', { reason: 'invalid_or_missing_token' });
      client.close(1008, 'Authentication failed');
    }
  }

  private async handleMessage(client: Client, raw: RawData) {
    let boardId = '';
    try {
      const event = collaborationEventSchema.parse(JSON.parse(raw.toString())) as CollaborationClientEvent;
      boardId = event.boardId;
      if (event.type === collaborationClientEvents.joinBoard) return this.joinBoard(client, event.boardId);
      if (event.type === collaborationClientEvents.leaveBoard) return this.leaveBoard(client, event.boardId);
      if (event.type === collaborationClientEvents.cursorMove) {
        if (!client.boards.has(event.boardId)) throw new Error('Join the board before moving the cursor');
        const cursor = collaborationCursorSchema.parse(event.payload);
        return this.broadcastEvent(client, event.boardId, collaborationServerEvents.cursorMoved, { userId: client.userId, boardId: event.boardId, ...cursor }, event.operationId);
      }
      await this.handleObjectOperation(client, event);
    } catch {
      logger.warn('Rejected collaboration event', { boardId, userId: client.userId ?? 'anonymous' });
      send(client, { type: collaborationServerEvents.error, boardId, userId: '', timestamp: Date.now(), payload: { code: 'INVALID_EVENT', message: 'Invalid collaboration event' } });
    }
  }

  private async joinBoard(client: Client, boardId: string) {
    await boardService.get(boardId, client.userId!);
    if (client.boards.has(boardId)) return;
    const user = await userService.me(client.userId!);
    if (!user) throw new Error('User not found');
    client.boards.add(boardId);
    logger.info('WebSocket board joined', { boardId });
    const room = this.rooms.get(boardId) ?? new Set<Client>();
    room.add(client);
    this.rooms.set(boardId, room);
    const presence = this.getPresence(boardId, client.userId!, user.displayName);
    this.broadcastEvent(client, boardId, collaborationServerEvents.userJoined, presence);
    this.broadcastPresence(boardId);
  }

  private leaveBoard(client: Client, boardId: string) {
    if (!client.boards.delete(boardId)) return;
    logger.info('WebSocket board left', { boardId });
    const room = this.rooms.get(boardId);
    room?.delete(client);
    if (room?.size === 0) this.rooms.delete(boardId);
    this.broadcastEvent(client, boardId, collaborationServerEvents.userLeft, { userId: client.userId });
    this.broadcastPresence(boardId);
  }

  private leaveAll(client: Client) { for (const boardId of [...client.boards]) this.leaveBoard(client, boardId); }

  private async handleObjectOperation(client: Client, event: CollaborationClientEvent) {
    if (!client.boards.has(event.boardId)) throw new Error('Join the board before editing');
    const operationId = event.operationId ?? randomUUID();
    if (event.type === collaborationClientEvents.undo || event.type === collaborationClientEvents.redo) {
      const result = event.type === collaborationClientEvents.undo
        ? await boardService.undo(event.boardId, client.userId!, operationId)
        : await boardService.redo(event.boardId, client.userId!, operationId);
      this.broadcastEvent(client, event.boardId, event.type === collaborationClientEvents.undo ? collaborationServerEvents.operationUndone : collaborationServerEvents.operationRedone, result.eventPayload, operationId);
      return;
    }
    let payload: BoardObject | undefined;
    let type: string;
    if (event.type === collaborationClientEvents.createObject) {
      const result = await boardService.applyObjectOperation(event.boardId, client.userId!, operationId, 'CREATE_OBJECT', collaborationObjectSchema.parse(event.payload) as BoardObject);
      payload = result.eventPayload as BoardObject;
      type = collaborationServerEvents.objectCreated;
    } else if (event.type === collaborationClientEvents.updateObject) {
      const input = z.object({ objectId: collaborationObjectSchema.shape.id, updates: collaborationObjectSchema.partial() }).strict().parse(event.payload);
      const result = await boardService.applyObjectOperation(event.boardId, client.userId!, operationId, 'UPDATE_OBJECT', input);
      payload = result.eventPayload as BoardObject;
      type = collaborationServerEvents.objectUpdated;
    } else if (event.type === collaborationClientEvents.deleteObject) {
      const input = z.object({ objectId: collaborationObjectSchema.shape.id }).strict().parse(event.payload);
      const result = await boardService.applyObjectOperation(event.boardId, client.userId!, operationId, 'DELETE_OBJECT', input);
      type = collaborationServerEvents.objectDeleted;
      payload = result.eventPayload as BoardObject;
    } else return;
    this.broadcastEvent(client, event.boardId, type, payload, operationId);
  }

  private getPresence(boardId: string, userId: string, displayName: string): CollaborationPresence {
    return { userId, displayName, color: collaborationColor(userId), boardId };
  }

  private async broadcastPresence(boardId: string) {
    const room = this.rooms.get(boardId);
    if (!room) return;
    const users = await Promise.all([...room].map(async (client) => {
      const user = await userService.me(client.userId!);
      return user ? this.getPresence(boardId, client.userId!, user.displayName) : null;
    }));
    const event: CollaborationServerEvent = { type: collaborationServerEvents.presenceUpdate, boardId, userId: '', operationId: randomUUID(), timestamp: Date.now(), payload: users.filter((user): user is CollaborationPresence => user !== null) };
    for (const client of room) send(client, event);
  }

  private broadcastEvent(sender: Client, boardId: string, type: string, payload: unknown, operationId?: string) {
    const event: CollaborationServerEvent = { type, boardId, userId: sender.userId!, operationId: operationId ?? randomUUID(), timestamp: Date.now(), payload };
    for (const client of this.rooms.get(boardId) ?? []) send(client, event);
  }
}