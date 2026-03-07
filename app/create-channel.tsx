// Openflou Create Channel Screen
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { generateChatId } from '@/services/encryption';
import { Chat } from '@/types';
import { StatusBar } from 'expo-status-bar';

export default function CreateChannelScreen() {
  const { colors, t, currentUser, addChat, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [channelName, setChannelName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');

  async function handleCreate() {
    if (!channelName.trim()) {
      showAlert('Please enter channel name');
      return;
    }

    if (!currentUser) return;

    const newChannel: Chat = {
      id: generateChatId([currentUser.id, 'channel', Date.now().toString()]),
      type: 'channel',
      name: channelName.trim(),
      username: username.trim() || undefined,
      description: description.trim() || undefined,
      participants: [currentUser.id],
      admins: [currentUser.id],
      creatorId: currentUser.id,
      bannedUsers: [],
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      createdAt: new Date(),
    };

    await addChat(newChannel);
    showAlert('Channel created');
    router.back();
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.createChannel}</Text>
        <Pressable
          onPress={handleCreate}
          disabled={!channelName.trim()}
          style={({ pressed }) => [
            styles.createButton,
            {
              opacity: !channelName.trim() ? 0.3 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.createButtonText, { color: colors.primary }]}>{t.createChannel}</Text>
        </Pressable>
      </View>

      <ScrollView>
        {/* Channel Icon */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={[styles.channelIcon, { backgroundColor: colors.surfaceSecondary }]}>
            <MaterialIcons name="campaign" size={32} color={colors.icon} />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              value={channelName}
              onChangeText={setChannelName}
              placeholder={t.channelName}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.text }]}
              maxLength={50}
            />
            <TextInput
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="@username (optional)"
              placeholderTextColor={colors.textTertiary}
              style={[styles.usernameInput, { color: colors.textSecondary }]}
              maxLength={32}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Description */}
        <View style={[styles.descriptionSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t.channelDescription}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is your channel about?"
            placeholderTextColor={colors.textTertiary}
            style={[styles.descriptionInput, { color: colors.text }]}
            maxLength={200}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <MaterialIcons name="info-outline" size={20} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Channels are for broadcasting messages to unlimited subscribers
            </Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="lock-outline" size={20} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Only admins can post messages in channels
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
  createButton: {
    padding: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  channelIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    marginLeft: 16,
  },
  input: {
    fontSize: 16,
    marginBottom: 4,
  },
  usernameInput: {
    fontSize: 14,
  },
  descriptionSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    includeFontPadding: false,
  },
  descriptionInput: {
    fontSize: 15,
    minHeight: 80,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
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
