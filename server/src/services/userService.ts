import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserRepository } from '../repositories/userRepository.js';
import type { User } from '../types.js';
import { logger } from '../logging.js';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const registerSchema = z.object({ email, displayName: z.string().trim().min(1).max(120), password: z.string().min(8).max(128) }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();

export const authTokenSchema = z.object({ sub: z.string().uuid() });

export class UserService {
  constructor(private readonly repository = new UserRepository()) {}

  async register(email: string, displayName: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const user = await this.repository.create(email, displayName, passwordHash);
      return { user, accessToken: this.issueToken(user) };
    } catch (error) {
      if ((error as { code?: string }).code === '23505') this.fail(409, 'Email is already registered');
      throw error;
    }
  }

  async login(email: string, password: string) {
    const record = await this.repository.findByEmail(email);
    if (!record?.passwordHash || !(await bcrypt.compare(password, record.passwordHash))) {
      logger.warn('Authentication failed', { reason: 'invalid_credentials' });
      this.fail(401, 'Invalid email or password');
    }
    const user: User = { id: record.id, email: record.email, displayName: record.displayName };
    return { user, accessToken: this.issueToken(user) };
  }

  me(userId: string) {
    return this.repository.findById(userId);
  }

  verifyToken(token: string): string {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
      return authTokenSchema.parse(payload).sub;
    } catch {
      logger.warn('Authentication failed', { reason: 'invalid_token' });
      this.fail(401, 'Invalid or expired access token');
    }
  }

  private issueToken(user: User) {
    return jwt.sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  }

  private fail(statusCode: number, message: string): never {
    const error = new Error(message);
    Object.assign(error, { statusCode });
    throw error;
  }
}
