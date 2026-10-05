import type { NextFunction, Request, Response } from 'express';

type Entry = { count: number; resetAt: number };

export function fixedWindowRateLimit(limit: number, windowMs: number) {
  const entries = new Map<string, Entry>();
  return (request: Request, response: Response, next: NextFunction) => {
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const current = entries.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    if (entries.size > 10000) {
      for (const [entryKey, value] of entries) if (value.resetAt <= now) entries.delete(entryKey);
    }
    entry.count += 1;
    entries.set(key, entry);
    if (entry.count > limit) {
      response.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      response.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
      return;
    }
    next();
  };
}
