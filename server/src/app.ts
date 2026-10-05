import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { env } from './config/env.js';
import boardRoutes from './routes/boardRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { logger } from './logging.js';
import { fixedWindowRateLimit } from './middleware/rateLimit.js';

const app = express();
const allowedOrigins = new Set(env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean));

app.disable('x-powered-by');
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: false, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Operation-Id'] }));
app.use((_request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (env.NODE_ENV === 'production') response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: '2mb', strict: true, type: 'application/json' }));
app.get('/health', (_request, response) => response.json({ ok: true }));

app.use('/api/auth', fixedWindowRateLimit(20, 15 * 60 * 1000), authRoutes);
app.use('/api/boards', boardRoutes);

app.use((error: Error & { statusCode?: number; code?: string }, _request: Request, response: Response, _next: NextFunction) => {
  void _next;
  const parserError = error as Error & { status?: number; type?: string };
  const status = error instanceof z.ZodError ? 400 : parserError.type === 'entity.too.large' ? 413 : parserError.type === 'entity.parse.failed' ? 400 : error.statusCode ?? 500;
  const code = error instanceof z.ZodError ? 'VALIDATION_ERROR' : parserError.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : parserError.type === 'entity.parse.failed' ? 'INVALID_JSON' : error.code ?? (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status === 429 ? 'RATE_LIMITED' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR');
  const publicMessage = status >= 500 ? 'Internal server error' : code === 'PAYLOAD_TOO_LARGE' ? 'Request payload is too large' : code === 'INVALID_JSON' ? 'Request body must be valid JSON' : error.message || 'Request failed';
  if (status >= 500) logger.error('Unhandled request error', { name: error.name, message: error.message });
  return response.status(status).json({ error: { code, message: publicMessage } });
});

export default app;
