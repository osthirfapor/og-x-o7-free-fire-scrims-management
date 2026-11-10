import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  isAdmin: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  loginWithCredentials: async () => {},
  logout: async () => {},
  loading: true,
});

async function userHasAdminAccess(uid: string): Promise<boolean> {
  const adminRef = doc(db, 'admins', uid);
  const adminSnapshot = await getDoc(adminRef);
  return adminSnapshot.exists() && adminSnapshot.data().enabled === true;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const allowed = await userHasAdminAccess(user.uid);
        setIsAdmin(allowed);
        if (!allowed) await signOut(auth);
      } catch (error) {
        console.error('Could not verify Firebase admin access:', error);
        setIsAdmin(false);
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const loginWithCredentials = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    try {
      const allowed = await userHasAdminAccess(credential.user.uid);
      if (!allowed) {
        await signOut(auth);
        throw new Error('This Firebase account is not authorized as an admin.');
      }
      setIsAdmin(true);
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, loginWithCredentials, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
