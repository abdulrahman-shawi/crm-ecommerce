'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/lib/type';

interface AuthContextType {
  user: any;
  loading: boolean;
  isImpersonating: boolean;
  refreshUser: () => Promise<void>;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const IMPERSONATION_KEY = 'skynova_as_user_id';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  /**
    * Resolves the effective user for this tab by applying optional impersonation.
   */
  const resolveEffectiveUser = async (currentUser: User | null): Promise<User | null> => {
    if (!currentUser) {
      return null;
    }

    if (typeof window === 'undefined') {
      return currentUser;
    }

    const url = new URL(window.location.href);
    const asUserFromUrl = url.searchParams.get('asUser');

    if (asUserFromUrl === 'me') {
      window.sessionStorage.removeItem(IMPERSONATION_KEY);
      return currentUser;
    }

    if (asUserFromUrl && asUserFromUrl.trim().length > 0) {
      window.sessionStorage.setItem(IMPERSONATION_KEY, asUserFromUrl.trim());
    }

    const targetUserId = window.sessionStorage.getItem(IMPERSONATION_KEY);
    if (!targetUserId || targetUserId === currentUser.id) {
      return currentUser;
    }

    try {
      const response = await fetch(`/api/users/impersonate/${targetUserId}`, { cache: 'no-store' });
      if (!response.ok) {
        window.sessionStorage.removeItem(IMPERSONATION_KEY);
        return currentUser;
      }

      const result = await response.json();
      if (!result?.success || !result?.data) {
        window.sessionStorage.removeItem(IMPERSONATION_KEY);
        return currentUser;
      }

      return result.data as User;
    } catch {
      window.sessionStorage.removeItem(IMPERSONATION_KEY);
      return currentUser;
    }
  };

  /**
   * Refreshes authenticated user data and applies tab-specific impersonation when available.
   */
  const refreshUser = async () => {
    setLoading(true);
    try {
      const userData = await fetch('/api/users/get', { cache: 'no-store' });
      const data = await userData.json();
      const currentUser = (data?.data || null) as User | null;

      if (typeof window !== 'undefined' && currentUser) {
        const targetUserId = window.sessionStorage.getItem(IMPERSONATION_KEY);
        setIsImpersonating(Boolean(targetUserId && targetUserId !== currentUser.id));
      } else {
        setIsImpersonating(false);
      }

      const effectiveUser = await resolveEffectiveUser(currentUser);
      setUser(effectiveUser);
      console.log(data);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Stops impersonation for the current tab and returns to admin identity.
   */
  const stopImpersonation = () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(IMPERSONATION_KEY);
    const url = new URL(window.location.href);
    url.searchParams.set('asUser', 'me');
    window.location.href = url.toString();
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isImpersonating, refreshUser, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};