import { env } from './config/env.js';

const write = (level: 'error' | 'warn' | 'info' | 'debug', message: string, metadata: Record<string, unknown> = {}) => {
  const levels = ['error', 'warn', 'info', 'debug'];
  if (levels.indexOf(level) > levels.indexOf(env.LOG_LEVEL)) return;
  const output = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...(redact(metadata) as Record<string, unknown>) });
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
};

const sensitiveKey = /password|token|authorization|secret|hash|cookie/i;

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sensitiveKey.test(key) ? '[REDACTED]' : redact(entry)]));
};

export const logger = {
  error: (message: string, metadata?: Record<string, unknown>) => write('error', message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) => write('warn', message, metadata),
  info: (message: string, metadata?: Record<string, unknown>) => write('info', message, metadata),
  debug: (message: string, metadata?: Record<string, unknown>) => write('debug', message, metadata),
};
