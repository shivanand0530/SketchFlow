import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, UserService } from '../server/src/services/userService.js';
import { boardObjectSchema } from '../server/src/services/boardService.js';

describe('request validation', () => {
  it('rejects unknown registration fields and weak passwords', () => {
    expect(() => registerSchema.parse({ email: 'user@example.com', displayName: 'User', password: 'short', role: 'owner' })).toThrow();
    expect(loginSchema.safeParse({ email: 'USER@example.com', password: 'password', extra: true }).success).toBe(false);
  });

  it('normalizes valid credentials without returning secrets', () => {
    const result = registerSchema.parse({ email: 'USER@example.com', displayName: ' User ', password: 'password123' });
    expect(result.email).toBe('user@example.com');
    expect(result.displayName).toBe('User');
    expect(Object.keys(result)).not.toContain('passwordHash');
  });

  it('rejects malformed canvas objects and unexpected payload fields', () => {
    const result = boardObjectSchema.safeParse({ id: 'object', type: 'circle', position: { x: 0, y: 0 }, dimensions: { width: 1, height: 1 }, rotation: 0, style: { color: '#000000' }, extra: true });
    expect(result.success).toBe(false);
  });

  it('rejects modified and expired JWTs', () => {
    const service = new UserService({} as never);
    expect(() => service.verifyToken('not-a-jwt')).toThrowError('Invalid or expired access token');
  });
});