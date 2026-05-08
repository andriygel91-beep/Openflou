// Openflou Authentication Screen - Enhanced with Telegram Login
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import * as api from '@/services/api';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

export default function AuthScreen() {
  const { colors, t, setCurrentUser, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password strength
  const getPasswordStrength = (pass: string): { level: number; label: string; color: string } => {
    if (!pass) return { level: 0, label: '', color: 'transparent' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', color: '#ef4444' };
    if (score === 2) return { level: 2, label: 'Fair', color: '#f59e0b' };
    if (score === 3) return { level: 3, label: 'Good', color: '#3b82f6' };
    return { level: 4, label: 'Strong', color: '#10b981' };
  };
  const passwordStrength = getPasswordStrength(password);

  // Telegram login modal
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramLoading, setTelegramLoading] = useState(false);

  async function handleSignUp() {
    if (!username.trim() || !password.trim() || !displayName.trim()) {
      showAlert('Please fill all fields');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('Passwords do not match');
      return;
    }

    setLoading(true);

    const { user, error } = await api.signUp(username.toLowerCase(), displayName, password);
    
    if (error) {
      showAlert(error);
      setLoading(false);
      return;
    }

    if (user) {
      setCurrentUser(user);
      setLoading(false);
      router.replace('/(tabs)');
    }
  }

  async function handleSignIn() {
    if (!username.trim() || !password.trim()) {
      showAlert('Please fill all fields');
      return;
    }

    setLoading(true);

    const { user, error } = await api.signIn(username.toLowerCase(), password);
    
    if (error) {
      showAlert(error);
      setLoading(false);
      return;
    }

    if (user) {
      setCurrentUser(user);
      setLoading(false);
      router.replace('/(tabs)');
    }
  }

  async function handleTelegramLogin() {
    if (!telegramToken.trim()) {
      showAlert('Please enter login code from Telegram bot');
      return;
    }

    setTelegramLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: {
          action: 'telegram_login',
          loginToken: telegramToken.toUpperCase(),
        },
      });

      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const textContent = await error.context?.text();
            errorMessage = textContent || error.message;
          } catch {}
        }
        throw new Error(errorMessage);
      }

      if (data && data.user) {
        setCurrentUser(data.user);
        setShowTelegramModal(false);
        setTelegramToken('');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      showAlert('Login Error', error.message || 'Failed to login via Telegram');
    } finally {
      setTelegramLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialIcons name="forum" size={64} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>Openflou</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Secure Messenger</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <MaterialIcons name="alternate-email" size={20} color={colors.icon} style={styles.inputIcon} />
              <TextInput
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase())}
                placeholder="username (lowercase)"
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
                editable={!loading}
              />
            </View>

            {isSignUp && (
              <View style={styles.inputContainer}>
                <MaterialIcons name="person" size={20} color={colors.icon} style={styles.inputIcon} />
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Display Name (nickname)"
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                  editable={!loading}
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color={colors.icon} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
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
                editable={!loading}
              />
            </View>

            {isSignUp && password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            i <= passwordStrength.level
                              ? passwordStrength.color
                              : colors.surfaceSecondary,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              </View>
            )}

            {isSignUp && (
              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={20} color={colors.icon} style={styles.inputIcon} />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm Password"
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
                  editable={!loading}
                />
              </View>
            )}

            <Pressable
              onPress={isSignUp ? handleSignUp : handleSignIn}
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
                {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            </Pressable>

            {!isSignUp && (
              <Pressable
                onPress={() => setShowTelegramModal(true)}
                disabled={loading}
                style={({ pressed }) => [
                  styles.telegramButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <MaterialIcons name="send" size={20} color={colors.primary} />
                <Text style={[styles.telegramButtonText, { color: colors.text }]}>
                  Login with Telegram
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                setIsSignUp(!isSignUp);
                setConfirmPassword('');
                setDisplayName('');
              }}
              style={styles.toggleContainer}
              disabled={loading}
            >
              <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Telegram Login Modal */}
      <Modal
        visible={showTelegramModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTelegramModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !telegramLoading && setShowTelegramModal(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <MaterialIcons name="send" size={32} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Login via Telegram</Text>
            </View>

            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              1. Open Telegram and find @Openfloubot{'\n'}
              2. Send /login command{'\n'}
              3. Copy the 8-character code{'\n'}
              4. Enter it below
            </Text>

            <View style={[styles.tokenInputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <TextInput
                value={telegramToken}
                onChangeText={(text) => setTelegramToken(text.toUpperCase())}
                placeholder="Enter login code"
                placeholderTextColor={colors.textTertiary}
                style={[styles.tokenInput, { color: colors.text }]}
                autoCapitalize="characters"
                maxLength={8}
                editable={!telegramLoading}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowTelegramModal(false)}
                disabled={telegramLoading}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleTelegramLogin}
                disabled={telegramLoading || !telegramToken.trim()}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: telegramToken.trim() ? colors.primary : colors.surfaceSecondary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                {telegramLoading ? (
                  <ActivityIndicator color={colors.textInverted} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: colors.textInverted }]}>Login</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  telegramButton: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  telegramButtonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    includeFontPadding: false,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
    includeFontPadding: false,
  },
  tokenInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  tokenInput: {
    height: 56,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
