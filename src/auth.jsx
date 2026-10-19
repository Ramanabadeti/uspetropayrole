import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { ApiError } from "./api";

/**
 * Who is signed in, according to the server.
 *
 * The old scheme kept the logged-in user in localStorage, which the browser
 * wrote for itself after comparing passwords it had downloaded from
 * /api/employees — so "being an admin" was a value anyone could edit in
 * devtools. The session now lives in an httpOnly cookie and this context just
 * reflects what /api/auth/me reports.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await api.me();
      setUser(me);
      return me;
    } catch (err) {
      if (err instanceof ApiError && err.isAuthError) {
        setUser(null);
        return null;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const { user: me } = await api.login(username, password);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}

export default AuthContext;
