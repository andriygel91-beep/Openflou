// Openflou Root Index - Auth Check
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import * as storage from '@/services/storage';

export default function RootIndex() {
  const { currentUser, setCurrentUser, colors } = useOpenFlou();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const authState = await storage.getAuthState();
      
      if (authState?.isAuthenticated && authState.currentUser) {
        setCurrentUser(authState.currentUser);
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (currentUser) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth" />;
}
