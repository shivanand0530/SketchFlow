import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { BoardRepository } from '../repositories/boardRepository.js';
import { OperationRepository, type OperationType } from '../repositories/operationRepository.js';
import type { Board, BoardDocument, BoardMember, BoardObject } from '../types.js';
import { logger } from '../logging.js';

const pointSchema = z.object({ x: z.number().finite().gte(-1000000).lte(1000000), y: z.number().finite().gte(-1000000).lte(1000000) }).strict();
export const boardObjectSchema = z.object({
  id: z.string().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  type: z.enum(['circle', 'rectangle', 'point', 'polygon', 'polyline', 'pen', 'line', 'arrow', 'note']),
  position: pointSchema,
  dimensions: z.object({ width: z.number().finite().gte(0).lte(1000000), height: z.number().finite().gte(0).lte(1000000) }).strict(),
  rotation: z.number().finite().gte(-1000).lte(1000),
  style: z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict(),
  text: z.string().max(10000).optional(),
  properties: z.record(z.string().max(64), z.unknown()).optional(),
}).strict();

export const boardDocumentSchema: z.ZodType<BoardDocument> = z.object({ objects: z.array(boardObjectSchema).max(10000) }).strict();

export class BoardService {
  constructor(private readonly repository = new BoardRepository(), private readonly operationRepository = new OperationRepository()) {}

  create(name: string, userId: string) {
    return this.repository.create(name, userId);
  }

  async list(userId: string): Promise<Board[]> {
    return this.repository.list(userId);
  }

  async get(boardId: string, userId: string): Promise<Board> {
    await this.requireAccess(boardId, userId, 'viewer');
    const board = await this.repository.get(boardId, userId);
    if (!board) throw this.notFound('Board not found');
    return board;
  }

  async update(boardId: string, userId: string, name: string): Promise<Board> {
    await this.requireOwner(boardId, userId);
    const board = await this.repository.update(boardId, name);
    if (!board) throw this.notFound('Board not found');
    return board;
  }

  async delete(boardId: string, userId: string): Promise<void> {
    await this.requireOwner(boardId, userId);
    await this.repository.delete(boardId);
  }

  async load(boardId: string, userId: string): Promise<BoardDocument> {
    await this.requireAccess(boardId, userId, 'viewer');
    return this.repository.getDocument(boardId);
  }

  async save(boardId: string, userId: string, document: BoardDocument): Promise<BoardDocument> {
    await this.requireAccess(boardId, userId, 'editor');
    const current = await this.repository.getDocument(boardId);
    const currentById = new Map(current.objects.map((object) => [object.id, object]));
    const nextById = new Map(document.objects.map((object) => [object.id, object]));
    for (const object of document.objects) {
      const previous = currentById.get(object.id);
      if (!previous) await this.operationRepository.apply(boardId, userId, randomUUID(), { type: 'CREATE_OBJECT', object });
      else if (JSON.stringify(previous) !== JSON.stringify(object)) await this.operationRepository.apply(boardId, userId, randomUUID(), { type: 'UPDATE_OBJECT', objectId: object.id, object });
    }
    for (const object of current.objects) {
      if (!nextById.has(object.id)) await this.operationRepository.apply(boardId, userId, randomUUID(), { type: 'DELETE_OBJECT', objectId: object.id });
    }
    return document;
  }

  async applyObjectOperation(boardId: string, userId: string, operationId: string, type: OperationType, input: BoardObject | { objectId: string; updates: Partial<BoardObject> } | { objectId: string }) {
    await this.requireAccess(boardId, userId, 'editor');
    const duplicate = await this.operationRepository.find(boardId, operationId);
    if (duplicate) return duplicate;
    if (type === 'CREATE_OBJECT') {
      return this.operationRepository.apply(boardId, userId, operationId, { type, object: boardObjectSchema.parse(input) });
    }
    const objectId = z.object({ objectId: boardObjectSchema.shape.id }).strict().parse(input).objectId;
    const existing = await this.repository.getObject(boardId, objectId);
    if (!existing) throw this.notFound('Canvas object not found');
    if (type === 'DELETE_OBJECT') {
      return this.operationRepository.apply(boardId, userId, operationId, { type, objectId });
    }
    const updates = z.object({ objectId: boardObjectSchema.shape.id, updates: boardObjectSchema.partial() }).strict().parse(input).updates;
    const object = { ...existing, ...updates, id: objectId, style: { ...existing.style, ...updates.style }, properties: { ...existing.properties, ...updates.properties } } as BoardObject;
    return this.operationRepository.apply(boardId, userId, operationId, { type, objectId, object });
  }

  async undo(boardId: string, userId: string, operationId: string) {
    await this.requireAccess(boardId, userId, 'editor');
    return this.operationRepository.undo(boardId, userId, operationId);
  }

  async redo(boardId: string, userId: string, operationId: string) {
    await this.requireAccess(boardId, userId, 'editor');
    return this.operationRepository.redo(boardId, userId, operationId);
  }

  async history(boardId: string, userId: string, limit: number, offset: number) {
    await this.requireAccess(boardId, userId, 'viewer');
    const [operations, availability] = await Promise.all([
      this.operationRepository.list(boardId, limit, offset),
      this.operationRepository.availability(boardId, userId),
    ]);
    const items = operations.map(({ id, boardId: historyBoardId, userId: actorId, operationId: historyOperationId, sequence, type: operationType, action, timestamp }) => ({
      id, boardId: historyBoardId, userId: actorId, operationId: historyOperationId, sequence, type: operationType, action, timestamp,
    }));
    return { items, ...availability, limit, offset };
  }

  async addMember(boardId: string, actorId: string, userId: string, role: BoardMember['role']): Promise<BoardMember> {
    await this.requireOwner(boardId, actorId);
    return this.repository.addMember(boardId, userId, role);
  }

  async listMembers(boardId: string, userId: string): Promise<BoardMember[]> {
    await this.requireAccess(boardId, userId, 'viewer');
    return this.repository.listMembers(boardId);
  }

  async updateMember(boardId: string, actorId: string, userId: string, role: BoardMember['role']): Promise<BoardMember> {
    await this.requireOwner(boardId, actorId);
    const member = await this.repository.updateMember(boardId, userId, role);
    if (!member) throw this.notFound('Board member not found or cannot be changed');
    return member;
  }

  async deleteMember(boardId: string, actorId: string, userId: string): Promise<void> {
    await this.requireOwner(boardId, actorId);
    if (!(await this.repository.deleteMember(boardId, userId))) throw this.notFound('Board member not found or cannot be removed');
  }

  async createShareToken(boardId: string, userId: string): Promise<string> {
    await this.requireOwner(boardId, userId);
    return jwt.sign({ boardId, purpose: 'board-share' }, env.JWT_SECRET, { expiresIn: '7d' });
  }

  async acceptShareToken(token: string, userId: string): Promise<Board> {
    let boardId: string;
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      const parsed = z.object({ boardId: z.string().uuid(), purpose: z.literal('board-share') }).strict().parse(payload);
      boardId = parsed.boardId;
    } catch {
      const error = new Error('Invalid or expired board share link');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
    await this.repository.addMember(boardId, userId, 'viewer');
    return this.get(boardId, userId);
  }

  private async requireAccess(boardId: string, userId: string, role: 'editor' | 'viewer') {
    if (!(await this.repository.hasAccess(boardId, userId, role))) {
      logger.warn('Board authorization failed', { boardId, requiredRole: role, reason: 'insufficient_access' });
      const error = new Error('Board access denied');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }
  }

  private async requireOwner(boardId: string, userId: string) {
    if (!(await this.repository.hasRole(boardId, userId, 'owner'))) {
      logger.warn('Board authorization failed', { boardId, requiredRole: 'owner', reason: 'owner_required' });
      const error = new Error('Owner permission required');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }
  }

  private notFound(message: string) {
    const error = new Error(message);
    Object.assign(error, { statusCode: 404 });
    return error;
  }
}
