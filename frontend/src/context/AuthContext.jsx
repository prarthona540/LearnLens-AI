import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('learnlens_token');
      if (token) {
        try {
          const profile = await api.getProfile();
          setUser(profile);
        } catch {
          localStorage.removeItem('learnlens_token');
          localStorage.removeItem('learnlens_user');
        }
      } else {
        // Provide demo user for seamless exploration
        const demoUser = {
          _id: 'usr_demo_1',
          name: 'Prarthona Chowdhury',
          email: 'prarthona@learnlens.ai',
          role: 'student',
          preferredLanguage: 'en',
        };
        setUser(demoUser);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    setUser(res.user);
    return res;
  };

  const register = async (name, email, password) => {
    const res = await api.register(name, email, password);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('learnlens_token');
    localStorage.removeItem('learnlens_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
