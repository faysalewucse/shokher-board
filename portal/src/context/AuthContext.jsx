import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/services/api';

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading]         = useState(true);

  const loadMe = async () => {
    const res = await api.get('/users/me');
    setUser(res.data.data.user);
    setPermissions(res.data.data.permissions || []);
  };

  useEffect(() => {
    const token = localStorage.getItem('shokherboard.token');
    const request = token ? api.get('/users/me') : Promise.resolve(null);
    request
      .then((res) => {
        if (!res) return;
        setUser(res.data.data.user);
        setPermissions(res.data.data.permissions || []);
      })
      .catch(() => localStorage.removeItem('shokherboard.token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData, permissions: perms } = res.data.data;
    localStorage.setItem('shokherboard.token', token);
    setUser(userData);
    setPermissions(perms || []);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('shokherboard.token');
    setUser(null);
    setPermissions([]);
  };

  const isAdmin = !loading && !!user && user?.role?.name === 'admin';

  // Re-fetch the current user (e.g. after a self-profile update).
  const refreshMe = () => loadMe();

  return (
    <AuthContext.Provider value={{ user, permissions, isAdmin, loading, login, logout, setUser, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}
