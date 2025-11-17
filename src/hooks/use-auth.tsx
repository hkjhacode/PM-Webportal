
'use client';

import { USERS } from '@/lib/data';
import type { User } from '@/types';
import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const login = async (email: string, password: string) => {
    // FR-01: Prefer server-side auth via JWT
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, action: 'login' })
      });
      if (res.ok) {
        const data = await res.json();
        const roles = Array.isArray(data.user.roles)
          ? data.user.roles.map((r: any) => ({ role: r.role, state: r.state, division: r.branch }))
          : [];
        const userFromApi: User = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          roles,
          avatarUrl: data.user.avatarUrl ?? 'https://picsum.photos/seed/100/100',
        };
        setUser(userFromApi);
        if (userFromApi.roles.some(r => r.role === 'Super Admin')) {
          router.push('/dashboard/user-management');
        } else {
          router.push('/dashboard');
        }
        return true;
      }
    } catch (e) {
      // Fall back to local mock for dev/demo
      console.warn('Auth API unavailable, falling back to local mock.', e);
    }
    const userToLogin = USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (userToLogin) {
      setUser(userToLogin);
      if (userToLogin.roles.some(r => r.role === 'Super Admin')) {
        router.push('/dashboard/user-management');
      } else {
        router.push('/dashboard');
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    router.push('/');
  };

  const hasRole = (role: string) => {
    return user?.roles.some(r => r.role === role) || false;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
