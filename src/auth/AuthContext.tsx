import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, currentUser, login as loginRequest, register as registerRequest, saveToken } from '@/services/authService';

export interface User { id: string; email: string; displayName: string; type?: 'registered' | 'guest'; }
interface AuthContextValue { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; register: (email: string, displayName: string, password: string) => Promise<void>; continueAsGuest: () => void; logout: () => void; }
const AuthContext = createContext<AuthContextValue | null>(null);
const GUEST_USER_KEY = 'sketchflow-guest-user';

const readGuestUser = (): User | null => {
  try {
    const guest = JSON.parse(localStorage.getItem(GUEST_USER_KEY) ?? 'null') as User | null;
    return guest?.type === 'guest' && guest.id && guest.displayName ? guest : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const guest = readGuestUser();
    if (guest) {
      setUser(guest);
      setLoading(false);
      return;
    }
    currentUser().then((current) => setUser({ ...current, type: 'registered' })).catch(() => clearToken()).finally(() => setLoading(false));
  }, []);
  const login = async (email: string, password: string) => { const result = await loginRequest(email, password); localStorage.removeItem(GUEST_USER_KEY); saveToken(result.accessToken); setUser({ ...result.user, type: 'registered' }); };
  const register = async (email: string, displayName: string, password: string) => { const result = await registerRequest(email, displayName, password); localStorage.removeItem(GUEST_USER_KEY); saveToken(result.accessToken); setUser({ ...result.user, type: 'registered' }); };
  const continueAsGuest = useCallback(() => {
    const guest = { id: `guest-${crypto.randomUUID()}`, email: '', displayName: 'Guest', type: 'guest' as const };
    localStorage.setItem(GUEST_USER_KEY, JSON.stringify(guest));
    setUser(guest);
  }, []);
  const logout = () => { clearToken(); localStorage.removeItem(GUEST_USER_KEY); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, login, register, continueAsGuest, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};