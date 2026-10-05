import type { User } from '@/auth/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'sketchflow-access-token';

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string | { message?: string } };
    const message = typeof body.error === 'string' ? body.error : body.error?.message;
    throw new Error(message ?? `Authentication request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const register = (email: string, displayName: string, password: string) => request<{ user: User; accessToken: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, displayName, password }) });
export const login = (email: string, password: string) => request<{ user: User; accessToken: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const currentUser = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return Promise.reject(new Error('Not authenticated'));
  return request<User>('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
};
export const saveToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);