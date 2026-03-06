// Openflou Root Index - Auth Check
import React, { useEffect } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import * as storage from '@/services/storage';

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
      const authState = await storage.getAuthState();
      
      if (authState?.isAuthenticated && authState.currentUser) {
        setCurrentUser(authState.currentUser);
        setLoading(false);
        // Skip splash if already authenticated
        setShowSplash(false);
      } else {
        setLoading(false);
        // Show splash for new users
        setTimeout(() => {
          setShowSplash(false);
        }, 3500);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setLoading(false);
      setTimeout(() => {
        setShowSplash(false);
      }, 3500);
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
