// Openflou Authentication Screen
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import * as storage from '@/services/storage';
import { generateUserId } from '@/services/encryption';
import { User } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AuthScreen() {
  const { colors, t, setCurrentUser } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    if (!username.trim()) {
      showAlert(t.usernameRequired);
      return;
    }

    if (!password.trim()) {
      showAlert(t.passwordRequired);
      return;
    }

    setLoading(true);

    try {
      const existingUser = await storage.findUserByUsername(username);

      if (isSignUp) {
        if (existingUser) {
          showAlert('Username already exists');
          setLoading(false);
          return;
        }

        // Create new user
        const newUser: User = {
          id: generateUserId(username),
          username: username.trim(),
          password,
          isOnline: true,
          createdAt: new Date(),
        };

        await storage.saveUser(newUser);
        await storage.saveAuthState({
          isAuthenticated: true,
          currentUser: newUser,
          isNewUser: true,
        });

        setCurrentUser(newUser);
        showAlert(t.accountCreated);
        router.replace('/(tabs)');
      } else {
        // Sign in
        if (!existingUser || existingUser.password !== password) {
          showAlert(t.invalidCredentials);
          setLoading(false);
          return;
        }

        existingUser.isOnline = true;
        await storage.saveUser(existingUser);
        await storage.saveAuthState({
          isAuthenticated: true,
          currentUser: existingUser,
          isNewUser: false,
        });

        setCurrentUser(existingUser);
        router.replace('/(tabs)');
      }
    } catch (error) {
      showAlert('Authentication error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialIcons name="forum" size={64} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>{t.authTitle}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t.authSubtitle}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={20} color={colors.icon} style={styles.inputIcon} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder={t.enterUsername}
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color={colors.icon} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t.enterPassword}
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <Pressable
              onPress={handleAuth}
              disabled={loading}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: loading || pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: colors.textInverted }]}>
                {isSignUp ? t.signUp : t.signIn}
              </Text>
            </Pressable>

            <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleContainer}>
              <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {isSignUp ? t.signIn : t.signUp}
                </Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 16,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
    includeFontPadding: false,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: 18,
    zIndex: 1,
  },
  input: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 48,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  toggleContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  toggleText: {
    fontSize: 14,
    includeFontPadding: false,
  },
});
