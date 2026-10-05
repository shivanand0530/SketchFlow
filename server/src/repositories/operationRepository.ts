import { pool } from '../db/pool.js';
import type { BoardObject } from '../types.js';

export type OperationType = 'CREATE_OBJECT' | 'UPDATE_OBJECT' | 'DELETE_OBJECT';
export type OperationAction = 'normal' | 'undo' | 'redo';

export type Mutation =
  | { type: 'CREATE_OBJECT'; object: BoardObject }
  | { type: 'UPDATE_OBJECT'; objectId: string; object: BoardObject }
  | { type: 'DELETE_OBJECT'; objectId: string };

export interface OperationRecord {
  id: string;
  boardId: string;
  userId: string;
  operationId: string;
  sequence: string;
  type: OperationType;
  action: OperationAction;
  payload: Mutation;
  inversePayload: Mutation;
  targetOperationId: string | null;
  timestamp: string;
}

interface StoredOperation extends OperationRecord {
  undone: boolean;
  redoInvalidated: boolean;
}

export interface AppliedOperation {
  operation: OperationRecord;
  eventPayload: BoardObject | { id: string };
}

export const inverseMutation = (mutation: Mutation, existing?: BoardObject): Mutation => {
  if (mutation.type === 'CREATE_OBJECT') return { type: 'DELETE_OBJECT', objectId: mutation.object.id };
  if (!existing) throw new Error('Canvas object not found');
  return mutation.type === 'UPDATE_OBJECT'
    ? { type: 'UPDATE_OBJECT', objectId: mutation.objectId, object: existing }
    : { type: 'CREATE_OBJECT', object: existing };
};

const rowToOperation = (row: Record<string, unknown>): StoredOperation => ({
  id: String(row.id),
  boardId: String(row.boardId),
  userId: String(row.userId),
  operationId: String(row.operationId),
  sequence: String(row.sequence),
  type: row.type as OperationType,
  action: row.action as OperationAction,
  payload: row.payload as Mutation,
  inversePayload: row.inversePayload as Mutation,
  targetOperationId: row.targetOperationId ? String(row.targetOperationId) : null,
  timestamp: new Date(String(row.timestamp)).toISOString(),
  undone: Boolean(row.undone),
  redoInvalidated: Boolean(row.redoInvalidated),
});

const selectOperation = `SELECT id, board_id AS "boardId", user_id AS "userId", operation_id AS "operationId", sequence,
  type, action, payload, inverse_payload AS "inversePayload", target_operation_id AS "targetOperationId",
  undone, redo_invalidated AS "redoInvalidated", created_at AS timestamp
  FROM board_operations`;

export class OperationRepository {
  async find(boardId: string, operationId: string): Promise<AppliedOperation | undefined> {
    const result = await pool.query<Record<string, unknown>>(`${selectOperation} WHERE board_id = $1 AND operation_id = $2`, [boardId, operationId]);
    if (!result.rows[0]) return undefined;
    const operation = rowToOperation(result.rows[0]);
    return { operation, eventPayload: this.eventPayload(operation.payload) };
  }

  async apply(boardId: string, userId: string, operationId: string, mutation: Mutation, action: OperationAction = 'normal', targetOperationId: string | null = null): Promise<AppliedOperation> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const duplicate = await client.query<Record<string, unknown>>(`${selectOperation} WHERE board_id = $1 AND operation_id = $2`, [boardId, operationId]);
      if (duplicate.rows[0]) {
        await client.query('COMMIT');
        const operation = rowToOperation(duplicate.rows[0]);
        return { operation, eventPayload: this.eventPayload(operation.payload) };
      }

      const result = await this.applyMutation(client, boardId, mutation);
      const inversePayload = result.inversePayload;
      if (action === 'normal') {
        await client.query(`UPDATE board_operations SET redo_invalidated = true
          WHERE board_id = $1 AND user_id = $2 AND action = 'undo' AND NOT redo_invalidated`, [boardId, userId]);
      }
      const row = await client.query<Record<string, unknown>>(
        `INSERT INTO board_operations (board_id, user_id, operation_id, type, action, payload, inverse_payload, target_operation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, board_id AS "boardId", user_id AS "userId", operation_id AS "operationId", sequence,
           type, action, payload, inverse_payload AS "inversePayload", target_operation_id AS "targetOperationId",
           undone, redo_invalidated AS "redoInvalidated", created_at AS timestamp`,
        [boardId, userId, operationId, mutation.type, action, mutation, inversePayload, targetOperationId],
      );
      await client.query('COMMIT');
      return { operation: rowToOperation(row.rows[0]), eventPayload: result.eventPayload };
    } catch (error) {
      await client.query('ROLLBACK');
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.find(boardId, operationId);
        if (duplicate) return duplicate;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async undo(boardId: string, userId: string, operationId: string): Promise<AppliedOperation> {
    return this.applyHistoryAction(boardId, userId, operationId, 'undo');
  }

  async redo(boardId: string, userId: string, operationId: string): Promise<AppliedOperation> {
    return this.applyHistoryAction(boardId, userId, operationId, 'redo');
  }

  async list(boardId: string, limit: number, offset: number): Promise<OperationRecord[]> {
    const result = await pool.query<Record<string, unknown>>(`${selectOperation} WHERE board_id = $1 ORDER BY sequence DESC LIMIT $2 OFFSET $3`, [boardId, limit, offset]);
    return result.rows.map(rowToOperation);
  }

  async availability(boardId: string, userId: string): Promise<{ canUndo: boolean; canRedo: boolean }> {
    const result = await pool.query<{ canundo: boolean; canredo: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM board_operations WHERE board_id = $1 AND user_id = $2 AND action IN ('normal', 'redo') AND NOT undone) AS canundo,
        EXISTS (SELECT 1 FROM board_operations WHERE board_id = $1 AND user_id = $2 AND action = 'undo' AND NOT redo_invalidated AND undone) AS canredo`,
      [boardId, userId],
    );
    return { canUndo: result.rows[0]?.canundo ?? false, canRedo: result.rows[0]?.canredo ?? false };
  }

  private async applyHistoryAction(boardId: string, userId: string, operationId: string, action: 'undo' | 'redo'): Promise<AppliedOperation> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const duplicate = await client.query<Record<string, unknown>>(`${selectOperation} WHERE board_id = $1 AND operation_id = $2`, [boardId, operationId]);
      if (duplicate.rows[0]) {
        await client.query('COMMIT');
        const operation = rowToOperation(duplicate.rows[0]);
        return { operation, eventPayload: this.eventPayload(operation.payload) };
      }
      const targetQuery = action === 'undo'
        ? `SELECT * FROM board_operations WHERE board_id = $1 AND user_id = $2 AND action IN ('normal', 'redo') AND NOT undone ORDER BY sequence DESC LIMIT 1 FOR UPDATE`
        : `SELECT target_operation_id FROM board_operations WHERE board_id = $1 AND user_id = $2 AND action = 'undo' AND NOT redo_invalidated AND undone ORDER BY sequence DESC LIMIT 1 FOR UPDATE`;
      const targetResult = await client.query<Record<string, unknown>>(targetQuery, [boardId, userId]);
      if (!targetResult.rows[0]) throw new Error(action === 'undo' ? 'Nothing to undo' : 'Nothing to redo');
      const targetId = action === 'undo' ? String(targetResult.rows[0].id) : String(targetResult.rows[0].target_operation_id);
      const target = await client.query<Record<string, unknown>>(`${selectOperation} WHERE id = $1 FOR UPDATE`, [targetId]);
      if (!target.rows[0]) throw new Error('History operation not found');
      const original = rowToOperation(target.rows[0]);
      const mutation = (action === 'undo' ? original.inversePayload : original.payload) as Mutation;
      const result = await this.applyMutation(client, boardId, mutation);
      const inversePayload = action === 'undo' ? original.payload : original.inversePayload;
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO board_operations (board_id, user_id, operation_id, type, action, payload, inverse_payload, target_operation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, board_id AS "boardId", user_id AS "userId", operation_id AS "operationId", sequence,
           type, action, payload, inverse_payload AS "inversePayload", target_operation_id AS "targetOperationId",
           undone, redo_invalidated AS "redoInvalidated", created_at AS timestamp`,
        [boardId, userId, operationId, mutation.type, action, mutation, inversePayload, original.id],
      );
      if (action === 'undo') {
        await client.query('UPDATE board_operations SET undone = true WHERE id = $1', [original.id]);
      } else {
        await client.query('UPDATE board_operations SET undone = false WHERE id = $1', [original.id]);
        await client.query('UPDATE board_operations SET redo_invalidated = true WHERE board_id = $1 AND user_id = $2 AND action = \'undo\' AND target_operation_id = $3', [boardId, userId, original.id]);
      }
      await client.query('COMMIT');
      return { operation: rowToOperation(inserted.rows[0]), eventPayload: result.eventPayload };
    } catch (error) {
      await client.query('ROLLBACK');
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.find(boardId, operationId);
        if (duplicate) return duplicate;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyMutation(client: import('pg').PoolClient, boardId: string, mutation: Mutation): Promise<{ inversePayload: Mutation; eventPayload: BoardObject | { id: string } }> {
    if (mutation.type === 'CREATE_OBJECT') {
      await client.query('INSERT INTO board_objects (id, board_id, object_type, position, dimensions, rotation, style, text, properties, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [mutation.object.id, boardId, mutation.object.type, mutation.object.position, mutation.object.dimensions, mutation.object.rotation, mutation.object.style, mutation.object.text ?? null, mutation.object.properties ?? {}, mutation.object]);
      await client.query('UPDATE boards SET updated_at = now() WHERE id = $1', [boardId]);
      return { inversePayload: inverseMutation(mutation), eventPayload: mutation.object };
    }
    if (mutation.type === 'UPDATE_OBJECT') {
      const existing = await this.getObject(client, boardId, mutation.objectId);
      if (!existing) throw new Error('Canvas object not found');
      await this.updateObject(client, boardId, mutation.objectId, mutation.object);
      return { inversePayload: inverseMutation(mutation, existing), eventPayload: mutation.object };
    }
    const existing = await this.getObject(client, boardId, mutation.objectId);
    if (!existing) throw new Error('Canvas object not found');
    await client.query('DELETE FROM board_objects WHERE board_id = $1 AND id = $2', [boardId, mutation.objectId]);
    await client.query('UPDATE boards SET updated_at = now() WHERE id = $1', [boardId]);
    return { inversePayload: inverseMutation(mutation, existing), eventPayload: { id: mutation.objectId } };
  }

  private async getObject(client: import('pg').PoolClient, boardId: string, objectId: string): Promise<BoardObject | undefined> {
    const result = await client.query<{ data: BoardObject }>(`SELECT CASE WHEN data = '{}'::jsonb THEN jsonb_build_object('id', id, 'type', object_type, 'position', position, 'dimensions', dimensions, 'rotation', rotation, 'style', style, 'text', text, 'properties', properties) ELSE data END AS data FROM board_objects WHERE board_id = $1 AND id = $2`, [boardId, objectId]);
    return result.rows[0]?.data;
  }

  private async updateObject(client: import('pg').PoolClient, boardId: string, objectId: string, object: BoardObject) {
    await client.query('UPDATE board_objects SET object_type = $3, position = $4, dimensions = $5, rotation = $6, style = $7, text = $8, properties = $9, data = $10, updated_at = now() WHERE board_id = $1 AND id = $2', [boardId, objectId, object.type, object.position, object.dimensions, object.rotation, object.style, object.text ?? null, object.properties ?? {}, object]);
    await client.query('UPDATE boards SET updated_at = now() WHERE id = $1', [boardId]);
  }

  private eventPayload(mutation: Mutation): BoardObject | { id: string } {
    return mutation.type === 'DELETE_OBJECT' ? { id: mutation.objectId } : mutation.object;
  }

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}
