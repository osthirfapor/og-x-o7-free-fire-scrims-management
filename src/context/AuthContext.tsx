import React, { createContext, useContext, useState } from 'react';

interface AuthContextType {
  isAdmin: boolean;
  adminPasscodeActive: boolean;
  loginWithCredentials: (username: string, password: string) => boolean;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  adminPasscodeActive: false,
  loginWithCredentials: () => false,
  logout: () => {},
  loading: false,
});

const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME || '';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';
const ADMIN_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ADMIN_ENABLED === 'true';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminPasscodeActive, setAdminPasscodeActive] = useState<boolean>(() => {
    return ADMIN_ENABLED && localStorage.getItem('ogxo7_admin_auth') === 'true';
  });

  const isAdmin = adminPasscodeActive;

  const loginWithCredentials = (username: string, password: string): boolean => {
    if (ADMIN_ENABLED && ADMIN_USERNAME && ADMIN_PASSWORD && username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setAdminPasscodeActive(true);
      localStorage.setItem('ogxo7_admin_auth', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setAdminPasscodeActive(false);
    localStorage.removeItem('ogxo7_admin_auth');
  };

  return (
    <AuthContext.Provider
      value={{
        isAdmin,
        adminPasscodeActive,
        loginWithCredentials,
        logout,
        loading: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
