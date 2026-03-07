// Openflou Telegram Link Screen
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
  const { colors, t, theme, currentUser, updateUser } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [telegramUsername, setTelegramUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    if (step === 'verify' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  async function handleGenerateCode() {
    if (!telegramUsername.trim() || !currentUser) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: {
          action: 'generate',
          userId: currentUser.id,
          telegramUsername: telegramUsername.trim(),
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
      setStep('verify');
      setTimeLeft(300);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!verificationCode.trim() || !currentUser) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('telegram-verify', {
        body: {
          action: 'verify',
          userId: currentUser.id,
          verificationCode: verificationCode.trim().toUpperCase(),
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

      showAlert('Success', 'Telegram account linked successfully!');
      router.back();
    } catch (error: any) {
      showAlert('Error', error.message || 'Verification failed');
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
              Connect your Telegram account for additional security and recovery options.
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

            <Text style={[styles.title, { color: colors.text }]}>Verification Code</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Enter the verification code shown below in the Openflou Telegram bot (@openfloubot) within {formatTime(timeLeft)}
            </Text>

            <View style={[styles.codeBox, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <Text style={[styles.codeText, { color: colors.primary }]}>{generatedCode}</Text>
            </View>

            <Text style={[styles.instruction, { color: colors.textSecondary }]}>
              1. Open Telegram and find @openfloubot{'\n'}
              2. Send the code above{'\n'}
              3. Enter the confirmation code below
            </Text>

            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
              <MaterialIcons name="lock" size={20} color={colors.icon} />
              <TextInput
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Enter confirmation code"
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, { color: colors.text }]}
                autoCapitalize="characters"
                maxLength={6}
              />
            </View>

            <Pressable
              onPress={handleVerify}
              disabled={!verificationCode.trim() || loading || timeLeft === 0}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: verificationCode.trim() && timeLeft > 0 ? colors.primary : colors.surfaceSecondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverted} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.textInverted }]}>Verify & Link</Text>
              )}
            </Pressable>

            {timeLeft === 0 && (
              <Pressable onPress={() => setStep('input')} style={styles.retryButton}>
                <Text style={[styles.retryText, { color: colors.primary }]}>Code expired. Try again</Text>
              </Pressable>
            )}
          </>
        )}

        {currentUser?.telegram_verified && (
          <Pressable onPress={handleUnlink} style={styles.unlinkButton}>
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
  instruction: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    includeFontPadding: false,
  },
  retryButton: {
    padding: 12,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
  },
  unlinkButton: {
    marginTop: 24,
    padding: 12,
  },
  unlinkText: {
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
