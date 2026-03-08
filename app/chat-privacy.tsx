// Openflou Chat Privacy Settings - Disappearing Messages
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const TIMER_OPTIONS = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '1 hour', value: 3600 },
  { label: '1 day', value: 86400 },
  { label: '1 week', value: 604800 },
];

export default function ChatPrivacyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, t, chats, theme, updateChat } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const chat = chats.find((c) => c.id === id);
  const [enabled, setEnabled] = useState(chat?.disappearingMessagesEnabled || false);
  const [timer, setTimer] = useState(chat?.disappearingMessagesTimer || 60);

  async function handleSave() {
    if (!chat) return;

    const updatedChat = {
      ...chat,
      disappearingMessagesEnabled: enabled,
      disappearingMessagesTimer: enabled ? timer : undefined,
    };

    const { error } = await updateChat(updatedChat);
    if (error) {
      showAlert('Error', error);
    } else {
      showAlert(
        'Settings Saved',
        enabled
          ? `Messages will disappear after ${getTimerLabel(timer)}`
          : 'Disappearing messages disabled'
      );
      router.back();
    }
  }

  function getTimerLabel(seconds: number): string {
    const option = TIMER_OPTIONS.find((o) => o.value === seconds);
    return option?.label || `${seconds} seconds`;
  }

  if (!chat) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Settings</Text>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView>
        {/* Disappearing Messages */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="timer" size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Disappearing Messages</Text>
          </View>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Messages will automatically delete after the selected time period
          </Text>

          <View style={[styles.settingItem, { borderTopColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Enable</Text>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.textInverted}
            />
          </View>

          {enabled && (
            <>
              <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>Delete after</Text>
              {TIMER_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setTimer(option.value)}
                  style={({ pressed }) => [
                    styles.timerOption,
                    {
                      backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.timerOptionText, { color: colors.text }]}>
                    {option.label}
                  </Text>
                  {timer === option.value && (
                    <MaterialIcons name="check" size={24} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <MaterialIcons name="info-outline" size={20} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Timer starts when message is sent, not when it's read
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="lock-outline" size={20} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Messages are permanently deleted from all devices
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="screenshot" size={20} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Users can still take screenshots before messages disappear
            </Text>
          </View>
        </View>
      </ScrollView>
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
  saveButton: {
    padding: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  section: {
    padding: 20,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    includeFontPadding: false,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    includeFontPadding: false,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  settingLabel: {
    fontSize: 16,
    includeFontPadding: false,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    includeFontPadding: false,
  },
  timerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  timerOptionText: {
    fontSize: 15,
    includeFontPadding: false,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
    includeFontPadding: false,
  },
});
