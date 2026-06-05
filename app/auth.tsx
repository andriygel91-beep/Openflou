// Openflou Authentication Screen — with password recovery via Telegram
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, Modal, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import * as api from '@/services/api';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

type RecoveryStep =
  | 'menu'             // choose recovery method
  | 'tg_code'          // enter Telegram-linked username to get code via bot
  | 'reset_token'      // enter admin-issued reset token
  | 'new_password';    // enter new password after token validated

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
  const getPasswordStrength = (pass: string) => {
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

  // Recovery modal
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('menu');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  // tg_code flow
  const [recoveryUsername, setRecoveryUsername] = useState('');
  // reset_token flow
  const [resetToken, setResetToken] = useState('');
  const [resetUserId, setResetUserId] = useState('');
  const [resetUserDisplay, setResetUserDisplay] = useState('');
  // new_password flow
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  function openRecovery() {
    setRecoveryStep('menu');
    setRecoveryUsername('');
    setResetToken('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setShowRecovery(true);
  }

  // Step 1a: User knows their Openflou username — send reset code via Telegram bot
  async function handleRequestTgReset() {
    if (!recoveryUsername.trim()) {
      showAlert('Please enter your Openflou username');
      return;
    }
    setRecoveryLoading(true);
    try {
      const supabase = getSupabaseClient();
      // Trigger /recover flow by calling edge function directly
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: { action: 'request_tg_reset', username: recoveryUsername.trim().toLowerCase() },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = (await error.context?.text()) || msg; } catch {}
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      showAlert(
        'Code Sent',
        'A password reset code has been sent to your linked Telegram. Check the @Openfloubot bot.'
      );
      // Jump straight to token entry
      setRecoveryStep('reset_token');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to send reset code');
    } finally {
      setRecoveryLoading(false);
    }
  }

  // Step 1b: Validate admin-issued reset token
  async function handleValidateToken() {
    if (!resetToken.trim()) {
      showAlert('Please enter your reset token');
      return;
    }
    setRecoveryLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: { action: 'validate_reset_token', resetToken: resetToken.trim().toUpperCase() },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = (await error.context?.text()) || msg; } catch {}
        }
        throw new Error(msg);
      }
      if (!data?.valid) throw new Error(data?.error || 'Invalid or expired token');
      setResetUserId(data.userId);
      setResetUserDisplay(data.displayName || data.username || '');
      setRecoveryStep('new_password');
    } catch (e: any) {
      showAlert('Error', e.message || 'Token validation failed');
    } finally {
      setRecoveryLoading(false);
    }
  }

  // Step 2: Apply new password
  async function handleResetPassword() {
    if (!newPassword.trim() || newPassword.length < 6) {
      showAlert('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showAlert('Passwords do not match');
      return;
    }
    setRecoveryLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: { action: 'reset_password', resetToken: resetToken.trim().toUpperCase(), newPassword },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = (await error.context?.text()) || msg; } catch {}
        }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      showAlert('Password Reset!', 'Your password has been changed. You can now log in.');
      setShowRecovery(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Password reset failed');
    } finally {
      setRecoveryLoading(false);
    }
  }

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
    if (error) { showAlert(error); setLoading(false); return; }
    if (user) { setCurrentUser(user); setLoading(false); router.replace('/(tabs)'); }
  }

  async function handleSignIn() {
    if (!username.trim() || !password.trim()) {
      showAlert('Please fill all fields');
      return;
    }
    setLoading(true);
    const { user, error } = await api.signIn(username.toLowerCase(), password);
    if (error) { showAlert(error); setLoading(false); return; }
    if (user) { setCurrentUser(user); setLoading(false); router.replace('/(tabs)'); }
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
        body: { action: 'telegram_login', loginToken: telegramToken.toUpperCase() },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = (await error.context?.text()) || msg; } catch {}
        }
        throw new Error(msg);
      }
      if (data?.user) {
        setCurrentUser(data.user);
        setShowTelegramModal(false);
        setTelegramToken('');
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      showAlert('Login Error', e.message || 'Failed to login via Telegram');
    } finally {
      setTelegramLoading(false);
    }
  }

  // -------------------------------------------------------
  // RECOVERY MODAL CONTENT
  // -------------------------------------------------------
  const renderRecoveryContent = () => {
    if (recoveryStep === 'menu') {
      return (
        <>
          <View style={styles.modalHeader}>
            <MaterialIcons name="lock-reset" size={36} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Account Recovery</Text>
          </View>
          <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
            Choose a recovery method:
          </Text>

          {/* Option 1 — via Telegram */}
          <Pressable
            onPress={() => setRecoveryStep('tg_code')}
            style={({ pressed }) => [
              styles.recoveryOption,
              { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialIcons name="send" size={28} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.recoveryOptionTitle, { color: colors.text }]}>
                Reset via Telegram
              </Text>
              <Text style={[styles.recoveryOptionDesc, { color: colors.textSecondary }]}>
                If your Telegram is linked to your account, get a reset code instantly.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.icon} />
          </Pressable>

          {/* Option 2 — admin-issued token */}
          <Pressable
            onPress={() => setRecoveryStep('reset_token')}
            style={({ pressed }) => [
              styles.recoveryOption,
              { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1, marginTop: 12 },
            ]}
          >
            <MaterialIcons name="admin-panel-settings" size={28} color={colors.warning || '#f59e0b'} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.recoveryOptionTitle, { color: colors.text }]}>
                I have a reset code
              </Text>
              <Text style={[styles.recoveryOptionDesc, { color: colors.textSecondary }]}>
                Enter a code issued by the admin or received via bot.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.icon} />
          </Pressable>

          {/* Option 3 — contact support */}
          <Pressable
            onPress={() => {
              setShowRecovery(false);
              showAlert(
                'Contact Support',
                'Open Telegram and message @Openfloubot\nSend: /support @your_username\n\nAn admin will contact you and help recover your account.'
              );
            }}
            style={({ pressed }) => [
              styles.recoveryOption,
              { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1, marginTop: 12 },
            ]}
          >
            <MaterialIcons name="support-agent" size={28} color={colors.online || '#10b981'} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.recoveryOptionTitle, { color: colors.text }]}>
                Contact Admin Support
              </Text>
              <Text style={[styles.recoveryOptionDesc, { color: colors.textSecondary }]}>
                Message @Openfloubot with /support and provide your username. Admin will review your request.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.icon} />
          </Pressable>
        </>
      );
    }

    if (recoveryStep === 'tg_code') {
      return (
        <>
          <View style={styles.modalHeader}>
            <MaterialIcons name="send" size={36} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Reset via Telegram</Text>
          </View>
          <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
            Enter your Openflou username. A reset code will be sent to your linked Telegram account via @Openfloubot.
          </Text>

          <View style={[styles.tokenInputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <TextInput
              value={recoveryUsername}
              onChangeText={setRecoveryUsername}
              placeholder="Your Openflou username"
              placeholderTextColor={colors.textTertiary}
              style={[styles.tokenInput, { color: colors.text, textAlign: 'left', letterSpacing: 0 }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              onPress={() => setRecoveryStep('menu')}
              style={({ pressed }) => [styles.modalButton, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleRequestTgReset}
              disabled={recoveryLoading || !recoveryUsername.trim()}
              style={({ pressed }) => [
                styles.modalButton,
                { backgroundColor: recoveryUsername.trim() ? colors.primary : colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              {recoveryLoading
                ? <ActivityIndicator color={colors.textInverted} />
                : <Text style={[styles.modalButtonText, { color: colors.textInverted }]}>Send Code</Text>}
            </Pressable>
          </View>
        </>
      );
    }

    if (recoveryStep === 'reset_token') {
      return (
        <>
          <View style={styles.modalHeader}>
            <MaterialIcons name="vpn-key" size={36} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Enter Reset Code</Text>
          </View>
          <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
            Enter the code you received from @Openfloubot or from admin support.
          </Text>

          <View style={[styles.tokenInputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <TextInput
              value={resetToken}
              onChangeText={(t) => setResetToken(t.toUpperCase())}
              placeholder="RESET CODE"
              placeholderTextColor={colors.textTertiary}
              style={[styles.tokenInput, { color: colors.text }]}
              autoCapitalize="characters"
              maxLength={12}
            />
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              onPress={() => setRecoveryStep('menu')}
              style={({ pressed }) => [styles.modalButton, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleValidateToken}
              disabled={recoveryLoading || !resetToken.trim()}
              style={({ pressed }) => [
                styles.modalButton,
                { backgroundColor: resetToken.trim() ? colors.primary : colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              {recoveryLoading
                ? <ActivityIndicator color={colors.textInverted} />
                : <Text style={[styles.modalButtonText, { color: colors.textInverted }]}>Verify</Text>}
            </Pressable>
          </View>
        </>
      );
    }

    if (recoveryStep === 'new_password') {
      return (
        <>
          <View style={styles.modalHeader}>
            <MaterialIcons name="lock-open" size={36} color={colors.online || '#10b981'} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Set New Password</Text>
          </View>
          {resetUserDisplay ? (
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Account: <Text style={{ fontWeight: '700', color: colors.text }}>{resetUserDisplay}</Text>
            </Text>
          ) : null}

          <View style={[styles.tokenInputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: 12 }]}>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (min 6 chars)"
              placeholderTextColor={colors.textTertiary}
              style={[styles.tokenInput, { color: colors.text, textAlign: 'left', letterSpacing: 0 }]}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <View style={[styles.tokenInputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <TextInput
              value={newPasswordConfirm}
              onChangeText={setNewPasswordConfirm}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textTertiary}
              style={[styles.tokenInput, { color: colors.text, textAlign: 'left', letterSpacing: 0 }]}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.modalButtons}>
            <Pressable
              onPress={() => setRecoveryStep('reset_token')}
              style={({ pressed }) => [styles.modalButton, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleResetPassword}
              disabled={recoveryLoading || !newPassword.trim() || !newPasswordConfirm.trim()}
              style={({ pressed }) => [
                styles.modalButton,
                {
                  backgroundColor:
                    newPassword.trim() && newPasswordConfirm.trim() ? colors.primary : colors.surfaceSecondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {recoveryLoading
                ? <ActivityIndicator color={colors.textInverted} />
                : <Text style={[styles.modalButtonText, { color: colors.textInverted }]}>Reset Password</Text>}
            </Pressable>
          </View>
        </>
      );
    }
    return null;
  };

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
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
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
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
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
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
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
                      style={[styles.strengthBar, {
                        backgroundColor: i <= passwordStrength.level ? passwordStrength.color : colors.surfaceSecondary,
                      }]}
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
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            )}

            <Pressable
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={loading}
              style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: loading || pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: colors.textInverted }]}>
                {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            </Pressable>

            {!isSignUp && (
              <>
                <Pressable
                  onPress={() => setShowTelegramModal(true)}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.telegramButton,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <MaterialIcons name="send" size={20} color={colors.primary} />
                  <Text style={[styles.telegramButtonText, { color: colors.text }]}>Login with Telegram</Text>
                </Pressable>

                <Pressable onPress={openRecovery} style={styles.forgotContainer} disabled={loading}>
                  <MaterialIcons name="lock-reset" size={16} color={colors.primary} />
                  <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={() => { setIsSignUp(!isSignUp); setConfirmPassword(''); setDisplayName(''); }}
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
      <Modal visible={showTelegramModal} transparent animationType="fade" onRequestClose={() => setShowTelegramModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => !telegramLoading && setShowTelegramModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="send" size={32} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Login via Telegram</Text>
            </View>
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              {'1. Open Telegram → @Openfloubot\n2. Send /login\n3. Copy the 8-character code\n4. Enter it below'}
            </Text>
            <View style={[styles.tokenInputContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <TextInput
                value={telegramToken}
                onChangeText={(t) => setTelegramToken(t.toUpperCase())}
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
                style={({ pressed }) => [styles.modalButton, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleTelegramLogin}
                disabled={telegramLoading || !telegramToken.trim()}
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: telegramToken.trim() ? colors.primary : colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {telegramLoading
                  ? <ActivityIndicator color={colors.textInverted} />
                  : <Text style={[styles.modalButtonText, { color: colors.textInverted }]}>Login</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Account Recovery Modal */}
      <Modal visible={showRecovery} transparent animationType="fade" onRequestClose={() => !recoveryLoading && setShowRecovery(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => !recoveryLoading && setShowRecovery(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {renderRecoveryContent()}
              <Pressable
                onPress={() => !recoveryLoading && setShowRecovery(false)}
                style={[styles.cancelLink, { opacity: recoveryLoading ? 0.4 : 1 }]}
              >
                <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>Close</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 32, fontWeight: '700', marginTop: 16, includeFontPadding: false },
  subtitle: { fontSize: 15, marginTop: 8, textAlign: 'center', includeFontPadding: false },
  form: { gap: 16 },
  inputContainer: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 16, top: 18, zIndex: 1 },
  input: { height: 56, borderRadius: 12, paddingHorizontal: 48, fontSize: 16, borderWidth: 1 },
  button: { height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: '600', includeFontPadding: false },
  telegramButton: { height: 56, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1 },
  telegramButtonText: { fontSize: 16, fontWeight: '600', includeFontPadding: false },
  strengthContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', width: 50, textAlign: 'right', includeFontPadding: false },
  forgotContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -4 },
  forgotText: { fontSize: 14, fontWeight: '600', includeFontPadding: false },
  toggleContainer: { alignItems: 'center', marginTop: 16 },
  toggleText: { fontSize: 14, includeFontPadding: false },
  // Modal shared
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '88%', borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalHeader: { alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginTop: 10, includeFontPadding: false },
  modalDescription: { fontSize: 14, lineHeight: 22, marginBottom: 20, includeFontPadding: false },
  tokenInputContainer: { borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  tokenInput: { height: 56, paddingHorizontal: 16, fontSize: 18, fontWeight: '600', textAlign: 'center', letterSpacing: 2 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalButtonText: { fontSize: 16, fontWeight: '600', includeFontPadding: false },
  // Recovery options
  recoveryOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14 },
  recoveryOptionTitle: { fontSize: 15, fontWeight: '600', includeFontPadding: false },
  recoveryOptionDesc: { fontSize: 13, lineHeight: 18, marginTop: 2, includeFontPadding: false },
  cancelLink: { alignItems: 'center', paddingVertical: 16 },
  cancelLinkText: { fontSize: 14, includeFontPadding: false },
});
