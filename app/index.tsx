import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import * as storage from '@/services/storage';
import { clearAIMessages } from '@/services/aiStorage';
import * as api from '@/services/api';

export default function RootIndex() {
  const { currentUser, setCurrentUser } = useOpenFlou();
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      await clearAIMessages();
      
      const authState = await storage.getAuthState();
      
      if (authState?.isAuthenticated && authState.currentUser) {
        const sessionId = await storage.getSessionId();
        
        if (sessionId) {
          // Validate session exists on server
          const sessionValid = await api.checkSessionExists(authState.currentUser.id, sessionId);
          if (sessionValid) {
            // Session valid — refresh user data from server
            const freshUser = await api.getUserById(authState.currentUser.id);
            setCurrentUser(freshUser || authState.currentUser);
          } else {
            // Session was deleted remotely — clear and go to auth
            await storage.clearCurrentUser();
            await storage.clearAuthState();
            await storage.clearSessionId();
          }
        } else {
          // No session ID stored (e.g. after app reinstall) — try to restore user without session check
          // This allows the user to stay logged in; session will be created on next sign-in action
          const freshUser = await api.getUserById(authState.currentUser.id);
          if (freshUser) {
            setCurrentUser(freshUser);
          } else {
            await storage.clearCurrentUser();
            await storage.clearAuthState();
          }
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;

  if (currentUser) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth" />;
}
