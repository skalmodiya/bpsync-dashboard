import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  user_id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  authenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authenticated: false,
  loading: true,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const res = await api.get<any>('/api/auth/status');
    if (res.ok && res.data) {
      if (res.data.authenticated && res.data.user) {
        setUser(res.data.user);
        setAuthenticated(true);
        setLoading(false);
      } else if (res.data.ias_configured && res.data.login_url) {
        // IAS configured but not authenticated — redirect to login
        window.location.href = res.data.login_url;
      } else {
        // IAS not configured — allow anonymous access (local dev without IAS)
        setUser({ user_id: 'local-dev', name: 'Local Developer', email: 'dev@local.test' });
        setAuthenticated(true);
        setLoading(false);
      }
    } else {
      // Backend not reachable — allow through for dev
      setUser({ user_id: 'local-dev', name: 'Local Developer', email: 'dev@local.test' });
      setAuthenticated(true);
      setLoading(false);
    }
  };

  const logout = async () => {
    const res = await api.post<any>('/api/auth/logout');
    if (res.ok && res.data?.ias_logout_url) {
      window.location.href = res.data.ias_logout_url;
    } else {
      window.location.href = '/';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Authenticating with SAP IAS...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, authenticated, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
