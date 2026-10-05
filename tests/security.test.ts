import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import app from '../server/src/app.js';
import { env } from '../server/src/config/env.js';
import { UserService } from '../server/src/services/userService.js';
import { collaborationEventSchema, collaborationObjectSchema } from '../server/src/collaboration/websocketServer.js';
import { collaborationClientEvents } from '../shared/collaboration.js';
import { fixedWindowRateLimit } from '../server/src/middleware/rateLimit.js';
import express from 'express';

describe('HTTP security contracts', () => {
  it('sets baseline security headers on public responses', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('returns a stable error for missing and malformed authentication', async () => {
    const missing = await request(app).get('/api/auth/me');
    const malformed = await request(app).get('/api/auth/me').set('Authorization', 'Token secret');
    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(missing.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    expect(malformed.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('normalizes malformed and oversized request bodies', async () => {
    const malformed = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    const oversized = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(2 * 1024 * 1024) }));
    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toMatchObject({ code: 'INVALID_JSON' });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('does not grant CORS access to an unrelated origin', async () => {
    const response = await request(app).get('/health').set('Origin', 'https://untrusted.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns 429 after the configured request budget', async () => {
    const limited = express();
    limited.use(fixedWindowRateLimit(1, 60_000));
    limited.get('/', (_request, response) => response.sendStatus(204));
    const first = await request(limited).get('/');
    const second = await request(limited).get('/');
    expect(first.status).toBe(204);
    expect(second.status).toBe(429);
    expect(second.body.error).toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('authentication and WebSocket validation', () => {
  it('rejects modified and expired tokens and accepts only the configured algorithm', () => {
    const service = new UserService({} as never);
    const valid = jwt.sign({}, env.JWT_SECRET, { subject: '00000000-0000-0000-0000-000000000001', expiresIn: '1m', algorithm: 'HS256' });
    expect(service.verifyToken(valid)).toBe('00000000-0000-0000-0000-000000000001');
    expect(() => service.verifyToken(`${valid}tampered`)).toThrow('Invalid or expired access token');
    const expired = jwt.sign({}, env.JWT_SECRET, { subject: '00000000-0000-0000-0000-000000000001', expiresIn: -1, algorithm: 'HS256' });
    expect(() => service.verifyToken(expired)).toThrow('Invalid or expired access token');
  });

  it('rejects spoofed identities, malformed board IDs, and unknown payload fields', () => {
    expect(collaborationEventSchema.safeParse({ type: collaborationClientEvents.createObject, boardId: 'not-a-uuid', timestamp: Date.now(), payload: { userId: 'another-user' } }).success).toBe(false);
    expect(collaborationObjectSchema.safeParse({ id: 'object', type: 'circle', position: { x: 0, y: 0 }, dimensions: { width: 1, height: 1 }, rotation: 0, style: { color: '#000000' }, userId: 'another-user' }).success).toBe(false);
    expect(collaborationEventSchema.safeParse({ type: collaborationClientEvents.cursorMove, boardId: '00000000-0000-0000-0000-000000000001', timestamp: Date.now(), payload: { x: 0, y: 0 }, extra: true }).success).toBe(false);
  });
});
