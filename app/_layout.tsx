// Openflou Root Layout
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { OpenFlouProvider } from '@/contexts/OpenFlouContext';
import { Platform } from 'react-native';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <OpenFlouProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 250,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen
              name="splash"
              options={{
                animation: 'fade',
                animationDuration: 400,
              }}
            />
            <Stack.Screen
              name="auth"
              options={{
                animation: 'fade',
              }}
            />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="chat"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-group"
              options={{
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="create-channel"
              options={{
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="edit-profile"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="edit-chat"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="privacy"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="sessions"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="search-messages"
              options={{
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="ai-assistant"
              options={{
                presentation: 'modal',
                animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom',
              }}
            />
          </Stack>
        </OpenFlouProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
