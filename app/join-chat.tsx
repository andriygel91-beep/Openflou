// Openflou Join Group/Channel by Username
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as api from '@/services/api';
import { Image } from 'expo-image';

export default function JoinChatScreen() {
  const { colors, t, theme, currentUser, loadChats } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundChat, setFoundChat] = useState<any>(null);

  async function handleSearch() {
    if (!username.trim()) return;

    setLoading(true);
    setFoundChat(null);

    try {
      const { chat, error } = await api.searchChatByUsername(username.trim());

      if (error) {
        showAlert('Not found', error);
        return;
      }

      setFoundChat(chat);
    } catch (error: any) {
      showAlert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!foundChat || !currentUser) return;

    setLoading(true);

    try {
      const { error } = await api.joinChat(foundChat.id, currentUser.id);

      if (error) {
        showAlert('Error', error);
        return;
      }

      showAlert('Success', `Joined ${foundChat.name}`);
      await loadChats();
      router.replace('/(tabs)');
    } catch (error: any) {
      showAlert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Join Group/Channel</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        {/* Search Input */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <MaterialIcons name="search" size={20} color={colors.icon} />
          <TextInput
            value={username}
            onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="Enter @username"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text }]}
            autoCapitalize="none"
            maxLength={32}
            onSubmitEditing={handleSearch}
          />
          <Pressable
            onPress={handleSearch}
            disabled={!username.trim() || loading}
            style={({ pressed }) => [
              styles.searchButton,
              {
                backgroundColor: username.trim() ? colors.primary : colors.surfaceSecondary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textInverted} />
            ) : (
              <MaterialIcons name="search" size={20} color={username.trim() ? colors.textInverted : colors.icon} />
            )}
          </Pressable>
        </View>

        {/* Found Chat */}
        {foundChat && (
          <View style={[styles.chatCard, { backgroundColor: colors.surface }]}>
            <View style={styles.chatHeader}>
              <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                {foundChat.avatar ? (
                  <Image source={{ uri: foundChat.avatar }} style={styles.avatarImage} />
                ) : (
                  <MaterialIcons
                    name={foundChat.type === 'channel' ? 'campaign' : 'group'}
                    size={32}
                    color={colors.icon}
                  />
                )}
              </View>
              <View style={styles.chatInfo}>
                <Text style={[styles.chatName, { color: colors.text }]}>{foundChat.name}</Text>
                {foundChat.username && (
                  <Text style={[styles.chatUsername, { color: colors.primary }]}>@{foundChat.username}</Text>
                )}
                <Text style={[styles.chatType, { color: colors.textSecondary }]}>
                  {foundChat.type === 'channel' ? 'Channel' : 'Group'} • {foundChat.participants?.length || 0} members
                </Text>
              </View>
            </View>

            {foundChat.description && (
              <Text style={[styles.chatDescription, { color: colors.textSecondary }]} numberOfLines={3}>
                {foundChat.description}
              </Text>
            )}

            <Pressable
              onPress={handleJoin}
              disabled={loading}
              style={({ pressed }) => [
                styles.joinButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textInverted} />
              ) : (
                <>
                  <MaterialIcons name="person-add" size={20} color={colors.textInverted} />
                  <Text style={[styles.joinButtonText, { color: colors.textInverted }]}>
                    Join {foundChat.type === 'channel' ? 'Channel' : 'Group'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoContainer}>
          <MaterialIcons name="info-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Enter the username of a group or channel to join. Usernames are case-insensitive and can contain letters, numbers, and underscores.
          </Text>
        </View>
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
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  chatCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  chatHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  chatName: {
    fontSize: 18,
    fontWeight: '700',
    includeFontPadding: false,
    marginBottom: 4,
  },
  chatUsername: {
    fontSize: 14,
    fontWeight: '600',
    includeFontPadding: false,
    marginBottom: 4,
  },
  chatType: {
    fontSize: 13,
    includeFontPadding: false,
  },
  chatDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    includeFontPadding: false,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  infoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
});
