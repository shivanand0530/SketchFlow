import { pool } from '../db/pool.js';
import type { User } from '../types.js';

export class UserRepository {
  async create(email: string, displayName: string, passwordHash: string): Promise<User> {
    const result = await pool.query<User>(
      'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, display_name AS "displayName"',
      [email, displayName, passwordHash],
    );
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string | null }) | undefined> {
    const result = await pool.query<User & { passwordHash: string | null }>(
      'SELECT id, email, display_name AS "displayName", password_hash AS "passwordHash" FROM users WHERE email = $1',
      [email],
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<User | undefined> {
    const result = await pool.query<User>(
      'SELECT id, email, display_name AS "displayName" FROM users WHERE id = $1',
      [id],
    );
    return result.rows[0];
  }
}
