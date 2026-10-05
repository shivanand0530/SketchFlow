import { describe, expect, it, vi } from 'vitest';
import { BoardService, boardObjectSchema } from '../server/src/services/boardService.js';
import { logger } from '../server/src/logging.js';
import { inverseMutation } from '../server/src/repositories/operationRepository.js';

const boardId = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000002';
const targetUserId = '00000000-0000-0000-0000-000000000003';
const object = boardObjectSchema.parse({ id: 'shape-1', type: 'rectangle', position: { x: 1, y: 2 }, dimensions: { width: 10, height: 20 }, rotation: 0, style: { color: '#000000' } });

describe('board service authorization and operation dispatch', () => {
  it('denies viewers before any object or history repository operation', async () => {
    const repository = { hasAccess: vi.fn().mockResolvedValue(false) };
    const operations = { apply: vi.fn(), undo: vi.fn(), redo: vi.fn() };
    const service = new BoardService(repository as never, operations as never);
    await expect(service.applyObjectOperation(boardId, userId, '00000000-0000-0000-0000-000000000004', 'CREATE_OBJECT', object)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.undo(boardId, userId, '00000000-0000-0000-0000-000000000005')).rejects.toMatchObject({ statusCode: 403 });
    expect(operations.apply).not.toHaveBeenCalled();
    expect(operations.undo).not.toHaveBeenCalled();
  });

  it('requires owner authorization for membership changes', async () => {
    const repository = { hasRole: vi.fn().mockResolvedValue(false) };
    const service = new BoardService(repository as never, {} as never);
    await expect(service.updateMember(boardId, userId, targetUserId, 'editor')).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.deleteMember(boardId, userId, targetUserId)).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.hasRole).toHaveBeenCalledWith(boardId, userId, 'owner');
  });

  it('validates and records an editor create operation with the authenticated actor', async () => {
    const repository = { hasAccess: vi.fn().mockResolvedValue(true) };
    const operations = { find: vi.fn().mockResolvedValue(undefined), apply: vi.fn().mockResolvedValue({ eventPayload: object }) };
    const service = new BoardService(repository as never, operations as never);
    await service.applyObjectOperation(boardId, userId, '00000000-0000-0000-0000-000000000004', 'CREATE_OBJECT', object);
    expect(operations.apply).toHaveBeenCalledWith(boardId, userId, '00000000-0000-0000-0000-000000000004', { type: 'CREATE_OBJECT', object });
  });
});

describe('structured logging redaction', () => {
  it('redacts sensitive fields recursively', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logger.info('security event', { password: 'secret', accessToken: 'jwt', nested: { authorization: 'Bearer token' }, boardId });
    const record = JSON.parse(String(output.mock.calls[0][0])) as Record<string, unknown>;
    expect(record.password).toBe('[REDACTED]');
    expect(record.accessToken).toBe('[REDACTED]');
    expect(record.nested).toEqual({ authorization: '[REDACTED]' });
    expect(record.boardId).toBe(boardId);
    output.mockRestore();
  });
});

describe('operation inverse mapping', () => {
  it('maps create to delete, update to the prior object, and delete to create', () => {
    const prior = { ...object, properties: { strokeWidth: 2 } };
    const updated = { ...object, properties: { strokeWidth: 4 } };
    expect(inverseMutation({ type: 'CREATE_OBJECT', object })).toEqual({ type: 'DELETE_OBJECT', objectId: object.id });
    expect(inverseMutation({ type: 'UPDATE_OBJECT', objectId: object.id, object: updated }, prior)).toEqual({ type: 'UPDATE_OBJECT', objectId: object.id, object: prior });
    expect(inverseMutation({ type: 'DELETE_OBJECT', objectId: object.id }, prior)).toEqual({ type: 'CREATE_OBJECT', object: prior });
  });
});