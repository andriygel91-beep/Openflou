import React, { useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import * as storage from '@/services/storage';
import { clearAIMessages } from '@/services/aiStorage';
import * as api from '@/services/api';

export default function RootIndex() {
  const { currentUser, setCurrentUser } = useOpenFlou();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [showSplash, setShowSplash] = React.useState(true);

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
          setLoading(false);
          setShowSplash(false);
        } else {
          // Session expired or deleted — show splash then auth
          await storage.clearCurrentUser();
          await storage.clearAuthState();
          await storage.clearSessionId();
          setLoading(false);
          // Show splash briefly before going to auth
          setTimeout(() => setShowSplash(false), 2000);
        }
      } else {
        setLoading(false);
        setTimeout(() => setShowSplash(false), 3500);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setLoading(false);
      setTimeout(() => setShowSplash(false), 3500);
    }
  }

  if (loading || showSplash) {
    if (!currentUser) {
      return <Redirect href="/splash" />;
    }
  }

  if (currentUser) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth" />;
}
