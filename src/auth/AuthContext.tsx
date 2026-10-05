import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, currentUser, login as loginRequest, register as registerRequest, saveToken } from '@/services/authService';

export interface User { id: string; email: string; displayName: string; }
interface AuthContextValue { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; register: (email: string, displayName: string, password: string) => Promise<void>; logout: () => void; }
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { currentUser().then(setUser).catch(() => clearToken()).finally(() => setLoading(false)); }, []);
  const login = async (email: string, password: string) => { const result = await loginRequest(email, password); saveToken(result.accessToken); setUser(result.user); };
  const register = async (email: string, displayName: string, password: string) => { const result = await registerRequest(email, displayName, password); saveToken(result.accessToken); setUser(result.user); };
  const logout = () => { clearToken(); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};