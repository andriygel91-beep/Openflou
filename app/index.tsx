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
        // Validate session is still active on server
        const sessionId = await storage.getSessionId();
        let sessionValid = false;
        if (sessionId) {
          sessionValid = await api.checkSessionExists(authState.currentUser.id, sessionId);
        }

        if (sessionValid) {
          // Re-fetch fresh user data from server
          const freshUser = await api.getUserById(authState.currentUser.id);
          setCurrentUser(freshUser || authState.currentUser);
        } else {
          // Session expired or deleted — clear and go to auth
          await storage.clearCurrentUser();
          await storage.clearAuthState();
          await storage.clearSessionId();
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
