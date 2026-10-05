process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.JWT_EXPIRES_IN ??= '15m';

import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false }),
});