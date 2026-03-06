// Openflou Root Layout
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { OpenFlouProvider } from '@/contexts/OpenFlouContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <OpenFlouProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="create-group" />
            <Stack.Screen name="search-messages" />
            <Stack.Screen
              name="ai-assistant"
              options={{
                presentation: 'modal',
              }}
            />
          </Stack>
        </OpenFlouProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
