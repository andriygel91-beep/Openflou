// Openflou Telegram Link Screen - Real Bot Integration
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

export default function TelegramLinkScreen() {
  const { colors, t, theme, currentUser } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [telegramUsername, setTelegramUsername] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [step, setStep] = useState<'input' | 'waiting'>('input');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [checking, setChecking] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (step === 'waiting' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  // Auto-check verification status every 2 seconds
  useEffect(() => {
    if (step === 'waiting' && timeLeft > 0) {
      const interval = setInterval(async () => {
        await checkVerificationStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [step, timeLeft]);

  async function checkVerificationStatus() {
    if (!currentUser || checking) return;

    setChecking(true);
    try {
      console.log('🔍 Checking verification status for user:', currentUser.id);
      
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: {
          action: 'check',
          userId: currentUser.id,
        },
      });

      if (error) {
        console.error('❌ Check verification error:', error);
        return;
      }

      console.log('✅ Check result:', data);

      if (data && data.verified) {
        console.log('🎉 User verified!');
        showAlert('Success!', 'Your Telegram account is now linked to Openflou!');
        router.back();
      }
    } catch (error: any) {
      console.error('❌ Check verification exception:', error);
    } finally {
      setChecking(false);
    }
  }

  async function handleGenerateCode() {
    if (!telegramUsername.trim() || !currentUser) return;

    // Remove @ if user included it
    const cleanUsername = telegramUsername.trim().replace('@', '');

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: {
          action: 'generate',
          userId: currentUser.id,
          telegramUsername: cleanUsername,
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

      setGeneratedCode(data.code);
      setStep('waiting');
      setTimeLeft(300);
      showAlert('Code Generated', 'Now open Telegram and send this code to @Openfloubot');
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    if (!currentUser) return;

    showAlert('Unlink Telegram?', 'Your Telegram account will be disconnected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const supabase = getSupabaseClient();
            await supabase.functions.invoke('telegram-verify', {
              body: {
                action: 'unlink',
                userId: currentUser.id,
              },
            });
            showAlert('Telegram account unlinked');
            router.back();
          } catch (error: any) {
            showAlert('Error', error.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Link Telegram</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        {step === 'input' ? (
          <>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="send" size={48} color={colors.textInverted} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>Link Your Telegram</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Connect your Telegram account for additional security and account recovery options.
            </Text>

            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
              <MaterialIcons name="alternate-email" size={20} color={colors.icon} />
              <TextInput
                value={telegramUsername}
                onChangeText={setTelegramUsername}
                placeholder="Your Telegram username"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                autoCapitalize="none"
                maxLength={32}
              />
            </View>

            <Pressable
              onPress={handleGenerateCode}
              disabled={!telegramUsername.trim() || loading}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: telegramUsername.trim() ? colors.primary : colors.surfaceSecondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverted} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.textInverted }]}>Generate Code</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.iconContainer, { backgroundColor: colors.online }]}>
              <MaterialIcons name="vpn-key" size={48} color={colors.textInverted} />
            </View>

            <Text style={[styles.title, { color: colors.text }]}>Send Code to Bot</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Open Telegram and send this code to @Openfloubot within {formatTime(timeLeft)}
            </Text>

            <View style={[styles.codeBox, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <Text style={[styles.codeText, { color: colors.primary }]}>{generatedCode}</Text>
            </View>

            <View style={[styles.instructionBox, { backgroundColor: colors.surface }]}>
              <View style={styles.instructionStep}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.stepNumberText, { color: colors.textInverted }]}>1</Text>
                </View>
                <Text style={[styles.instructionText, { color: colors.text }]}>
                  Open Telegram app
                </Text>
              </View>

              <View style={styles.instructionStep}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.stepNumberText, { color: colors.textInverted }]}>2</Text>
                </View>
                <Text style={[styles.instructionText, { color: colors.text }]}>
                  Search for <Text style={{ fontWeight: '700' }}>@Openfloubot</Text>
                </Text>
              </View>

              <View style={styles.instructionStep}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.stepNumberText, { color: colors.textInverted }]}>3</Text>
                </View>
                <Text style={[styles.instructionText, { color: colors.text }]}>
                  Send the code shown above
                </Text>
              </View>

              <View style={styles.instructionStep}>
                <View style={[styles.stepNumber, { backgroundColor: colors.online }]}>
                  <MaterialIcons name="check" size={16} color={colors.textInverted} />
                </View>
                <Text style={[styles.instructionText, { color: colors.text }]}>
                  Linking will complete automatically
                </Text>
              </View>
            </View>

            {checking && (
              <View style={styles.checkingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.checkingText, { color: colors.textSecondary }]}>
                  Waiting for verification...
                </Text>
              </View>
            )}

            {timeLeft === 0 && (
              <Pressable onPress={() => setStep('input')} style={styles.retryButton}>
                <MaterialIcons name="refresh" size={20} color={colors.primary} />
                <Text style={[styles.retryText, { color: colors.primary }]}>Code expired. Generate new code</Text>
              </Pressable>
            )}
          </>
        )}

        {currentUser?.telegram_verified && (
          <Pressable onPress={handleUnlink} style={styles.unlinkButton}>
            <MaterialIcons name="link-off" size={20} color={colors.error} />
            <Text style={[styles.unlinkText, { color: colors.error }]}>Unlink Telegram</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    includeFontPadding: false,
  },
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    includeFontPadding: false,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    includeFontPadding: false,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  codeBox: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
    includeFontPadding: false,
  },
  instructionBox: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
  },
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  checkingText: {
    fontSize: 14,
    includeFontPadding: false,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
  },
  unlinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
    gap: 8,
  },
  unlinkText: {
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
