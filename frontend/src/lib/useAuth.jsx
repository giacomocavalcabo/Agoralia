import { useState, useEffect, createContext, useContext } from 'react';
import { api } from './api';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me');
      // Gestisce sia {user:{...}} che {...}
      const u = response?.user ?? response;
      if (u && u.id && u.email) {
        setUser(u);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.log('Not authenticated');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    
    if (response.requires_totp) {
      return response;
    }
    
    // Login successful
    await checkAuth();
    return response;
  };

  const verifyTOTP = async (user_id, code) => {
    const response = await api.post('/auth/totp/verify', { user_id, code });
    
    if (response.ok) {
      await checkAuth();
    }
    
    return response;
  };

  const loginWithOAuth = async (provider) => {
    try {
      const response = await api.post(`/auth/oauth/${provider}/start`);
      
      // Redirect to OAuth provider
      window.location.href = response.auth_url;
    } catch (error) {
      throw new Error(`Failed to start ${provider} OAuth: ${error.message}`);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      // Redirect to login page using React Router
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    verifyTOTP,
    loginWithOAuth,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
