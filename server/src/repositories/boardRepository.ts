import { pool } from '../db/pool.js';
import type { Board, BoardDocument, BoardMember, BoardObject } from '../types.js';

export class BoardRepository {
  async create(name: string, userId: string): Promise<Board> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const board = (await client.query<Board>(
        'INSERT INTO boards (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"',
        [name, userId],
      )).rows[0];
      await client.query('INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)', [board.id, userId, 'owner']);
      await client.query('COMMIT');
      return board;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(userId: string): Promise<Board[]> {
    const result = await pool.query<Board>(
      'SELECT b.id, b.name, b.created_by AS "createdBy", b.created_at AS "createdAt", b.updated_at AS "updatedAt", bm.role FROM boards b INNER JOIN board_members bm ON bm.board_id = b.id WHERE bm.user_id = $1 ORDER BY b.updated_at DESC',
      [userId],
    );
    return result.rows;
  }

  async get(boardId: string, userId: string): Promise<Board | undefined> {
    const result = await pool.query<Board>(
      'SELECT b.id, b.name, b.created_by AS "createdBy", b.created_at AS "createdAt", b.updated_at AS "updatedAt", bm.role FROM boards b INNER JOIN board_members bm ON bm.board_id = b.id WHERE b.id = $1 AND bm.user_id = $2',
      [boardId, userId],
    );
    return result.rows[0];
  }

  async update(boardId: string, name: string): Promise<Board | undefined> {
    const result = await pool.query<Board>(
      'UPDATE boards SET name = $2, updated_at = now() WHERE id = $1 RETURNING id, name, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"',
      [boardId, name],
    );
    return result.rows[0];
  }

  async delete(boardId: string): Promise<void> {
    await pool.query('DELETE FROM boards WHERE id = $1', [boardId]);
  }

  async hasAccess(boardId: string, userId: string, minimumRole?: 'editor' | 'viewer'): Promise<boolean> {
    const result = await pool.query<{ role: BoardMember['role'] }>('SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId]);
    if (!result.rows[0]) return false;
    if (!minimumRole) return true;
    return minimumRole === 'viewer' || result.rows[0].role === 'owner' || result.rows[0].role === 'editor';
  }

  async hasRole(boardId: string, userId: string, role: BoardMember['role']): Promise<boolean> {
    const result = await pool.query<{ role: BoardMember['role'] }>('SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId]);
    return result.rows[0]?.role === role;
  }

  async getDocument(boardId: string): Promise<BoardDocument> {
    const result = await pool.query<{ data: BoardObject }>(
      `SELECT CASE WHEN data = '{}'::jsonb THEN jsonb_build_object(
        'id', id, 'type', object_type, 'position', position, 'dimensions', dimensions,
        'rotation', rotation, 'style', style, 'text', text, 'properties', properties
      ) ELSE data END AS data FROM board_objects WHERE board_id = $1 ORDER BY created_at, id`,
      [boardId],
    );
    return { objects: result.rows.map((row) => row.data) };
  }

  async getObject(boardId: string, objectId: string): Promise<BoardObject | undefined> {
    const result = await pool.query<{ data: BoardObject }>(
      `SELECT CASE WHEN data = '{}'::jsonb THEN jsonb_build_object(
        'id', id, 'type', object_type, 'position', position, 'dimensions', dimensions,
        'rotation', rotation, 'style', style, 'text', text, 'properties', properties
      ) ELSE data END AS data FROM board_objects WHERE board_id = $1 AND id = $2`,
      [boardId, objectId],
    );
    return result.rows[0]?.data;
  }

  async createObject(boardId: string, object: BoardObject): Promise<BoardObject> {
    await pool.query(
      'INSERT INTO board_objects (id, board_id, object_type, position, dimensions, rotation, style, text, properties, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [object.id, boardId, object.type, object.position, object.dimensions, object.rotation, object.style, object.text ?? null, object.properties ?? {}, object],
    );
    await pool.query('UPDATE boards SET updated_at = now() WHERE id = $1', [boardId]);
    return object;
  }

  async updateObject(boardId: string, objectId: string, object: BoardObject): Promise<BoardObject | undefined> {
    const result = await pool.query(
      'UPDATE board_objects SET object_type = $3, position = $4, dimensions = $5, rotation = $6, style = $7, text = $8, properties = $9, data = $10, updated_at = now() WHERE board_id = $1 AND id = $2 RETURNING id',
      [boardId, objectId, object.type, object.position, object.dimensions, object.rotation, object.style, object.text ?? null, object.properties ?? {}, object],
    );
    if (!result.rowCount) return undefined;
    await pool.query('UPDATE boards SET updated_at = now() WHERE id = $1', [boardId]);
    return { ...object, id: objectId };
  }

  async deleteObject(boardId: string, objectId: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM board_objects WHERE board_id = $1 AND id = $2', [boardId, objectId]);
    if (result.rowCount) await pool.query('UPDATE boards SET updated_at = now() WHERE id = $1', [boardId]);
    return Boolean(result.rowCount);
  }

  async replaceDocument(boardId: string, document: BoardDocument): Promise<BoardDocument> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM board_objects WHERE board_id = $1', [boardId]);
      for (const object of document.objects) {
        await client.query(
          'INSERT INTO board_objects (id, board_id, object_type, position, dimensions, rotation, style, text, properties, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [object.id, boardId, object.type, object.position, object.dimensions, object.rotation, object.style, object.text ?? null, object.properties ?? {}, object],
        );
      }
      await client.query('UPDATE boards SET updated_at = now() WHERE id = $1', [boardId]);
      await client.query('COMMIT');
      return document;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async addMember(boardId: string, userId: string, role: BoardMember['role']): Promise<BoardMember> {
    const result = await pool.query<BoardMember>(
      'INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role RETURNING board_id AS "boardId", user_id AS "userId", role',
      [boardId, userId, role],
    );
    return result.rows[0];
  }

  async listMembers(boardId: string): Promise<BoardMember[]> {
    const result = await pool.query<BoardMember>('SELECT board_id AS "boardId", user_id AS "userId", role FROM board_members WHERE board_id = $1 ORDER BY created_at', [boardId]);
    return result.rows;
  }

  async updateMember(boardId: string, userId: string, role: BoardMember['role']): Promise<BoardMember | undefined> {
    const result = await pool.query<BoardMember>(
      'UPDATE board_members SET role = $3 WHERE board_id = $1 AND user_id = $2 AND role <> $4 RETURNING board_id AS "boardId", user_id AS "userId", role',
      [boardId, userId, role, 'owner'],
    );
    return result.rows[0];
  }

  async deleteMember(boardId: string, userId: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2 AND role <> $3', [boardId, userId, 'owner']);
    return Boolean(result.rowCount);
  }
}
