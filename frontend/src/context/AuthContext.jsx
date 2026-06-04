import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

// ── helpers ──────────────────────────────────────────────────────────────────
const USER_KEY = 'user_data';

const saveUser = (user) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch {}
};

const loadUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};

const clearUser = () => {
  try { localStorage.removeItem(USER_KEY); } catch {}
};
// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  // FIX: seed state from localStorage so avatar/name survive a hard refresh
  // before the /auth/me response arrives.
  const [user, setUser] = useState(() => loadUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(res => {
          const freshUser = res.data.user;
          setUser(freshUser);
          saveUser(freshUser); // keep localStorage in sync with server
        })
        .catch((err) => {
          if (err.response?.status === 401) {
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
            clearUser();
            setUser(null);
          }
          // network/500 errors: keep the cached user so UI doesn't blank out
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginWithToken = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    saveUser(userData);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    saveUser(user);
    return user;
  }, []);

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data);
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    saveUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    clearUser();
    setUser(null);
    window.location.href = '/login';
  }, []);

  // FIX: deep-merge so partial updates (e.g. just avatar) don't wipe other fields.
  // Also persists the merged result so it survives refresh.
  const updateUser = useCallback((updatedUser) => {
    setUser(prev => {
      const merged = {
        ...prev,
        ...updatedUser,
        // deep-merge one level for nested objects (location, stats, notificationPreferences)
        ...(prev?.location || updatedUser?.location
          ? { location: { ...prev?.location, ...updatedUser?.location } }
          : {}),
        ...(prev?.notificationPreferences || updatedUser?.notificationPreferences
          ? { notificationPreferences: { ...prev?.notificationPreferences, ...updatedUser?.notificationPreferences } }
          : {}),
      };
      saveUser(merged);
      return merged;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};