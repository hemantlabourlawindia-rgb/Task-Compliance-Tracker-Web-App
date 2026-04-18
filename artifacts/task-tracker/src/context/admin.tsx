import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const ADMIN_PIN = "YIZMPS421U";
const STORAGE_KEY = "llia_admin_mode";

interface AdminContextValue {
  isAdmin: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: false,
  login: () => false,
  logout: () => {},
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, isAdmin ? "true" : "false");
    } catch {}
  }, [isAdmin]);

  function login(pin: string): boolean {
    if (pin === ADMIN_PIN) {
      setIsAdmin(true);
      return true;
    }
    return false;
  }

  function logout() {
    setIsAdmin(false);
  }

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
