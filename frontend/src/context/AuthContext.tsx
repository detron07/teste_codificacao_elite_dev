import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Role, User, WalletView } from '../types';

interface AuthContextType {
  user: User | null;
  wallet: WalletView | null;
  isAuthenticated: boolean;
  isAuctioneer: boolean;
  isBidder: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: Role) => Promise<void>;
  logout: () => void;
  quickLoginAs: (email: string) => Promise<void>;
  refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [wallet, setWallet] = useState<WalletView | null>(null);

  const refreshWallet = useCallback(async () => {
    if (!user || user.role !== 'BIDDER') {
      setWallet(null);
      return;
    }
    try {
      const data = await api.getWallet();
      setWallet(data);
    } catch {
      // Ignora falha de carteira se nao logado
    }
  }, [user]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setWallet(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (user && user.role === 'BIDDER') {
      void refreshWallet();
    }
  }, [user, refreshWallet]);

  const login = async (email: string, password: string): Promise<void> => {
    const res = await api.login(email, password);
    localStorage.setItem('auth_token', res.accessToken);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    setUser(res.user);
    if (res.user.role === 'BIDDER') {
      try {
        const w = await api.getWallet();
        setWallet(w);
      } catch {
        // Ignora
      }
    } else {
      setWallet(null);
    }
  };

  const register = async (name: string, email: string, password: string, role: Role): Promise<void> => {
    const res = await api.register(name, email, password, role);
    localStorage.setItem('auth_token', res.accessToken);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    setUser(res.user);
    if (res.user.role === 'BIDDER') {
      try {
        const w = await api.getWallet();
        setWallet(w);
      } catch {
        // Ignora
      }
    } else {
      setWallet(null);
    }
  };

  const logout = (): void => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    setWallet(null);
  };

  const quickLoginAs = async (email: string): Promise<void> => {
    await login(email, 'Leilao123');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        isAuthenticated: !!user,
        isAuctioneer: user?.role === 'AUCTIONEER',
        isBidder: user?.role === 'BIDDER',
        login,
        register,
        logout,
        quickLoginAs,
        refreshWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
