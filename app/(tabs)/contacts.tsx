// Openflou Friends Tab — search by username, add friends, start chats
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar, EmptyState } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { generateChatId } from '@/services/encryption';
import { Contact, Chat } from '@/types';
import { StatusBar } from 'expo-status-bar';
import * as api from '@/services/api';

export default function ContactsTab() {
  const { colors, t, contacts, loadContacts, addContact, currentUser, addChat, chats, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  // Debounced username search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const query = searchQuery.trim().replace('@', '');
    if (!query) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      setHasSearched(true);
      const { data, error } = await api.searchUsersByUsername(query);
      setSearching(false);
      if (!error && data) {
        // Exclude self
        setSearchResults(data.filter((u: any) => u.id !== currentUser?.id));
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  async function handleAddContact(userId: string, username: string, avatar?: string) {
    if (!currentUser) return;
    const exists = contacts.some((c) => c.userId === userId);
    if (exists) {
      showAlert('Already in friends');
      return;
    }
    const contact: Contact = {
      userId,
      username,
      avatar,
      isOnline: false,
      lastSeen: new Date(),
      addedAt: new Date(),
    };
    await addContact(contact);
    showAlert('Friend added!');
  }

  async function handleStartChat(userId: string, username: string, avatar?: string) {
    if (!currentUser) return;
    const chatId = generateChatId([currentUser.id, userId]);
    const existingChat = chats.find((c) => c.id === chatId);

    if (existingChat) {
      router.push(`/chat?id=${chatId}`);
      return;
    }

    const otherUser = searchResults.find((u: any) => u.id === userId);
    const chatName = otherUser?.display_name || otherUser?.username || username;

    const newChat: Chat = {
      id: chatId,
      type: 'private',
      name: chatName,
      avatar,
      participants: [currentUser.id, userId],
      admins: [],
      creatorId: currentUser.id,
      bannedUsers: [],
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      createdAt: new Date(),
    };

    await addChat(newChat);
    router.push(`/chat?id=${chatId}`);
  }

  const isSearchActive = searchQuery.trim().length > 0;
  const displayList = isSearchActive ? searchResults : contacts;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{(t as any).friends || 'Friends'}</Text>
        <Pressable
          onPress={() => router.push('/join-chat')}
          style={({ pressed }) => [
            styles.joinButton,
            { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <MaterialIcons name="group-add" size={18} color={colors.primary} />
          <Text style={[styles.joinButtonText, { color: colors.primary }]}>Join</Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary, marginHorizontal: 16, marginTop: 10, marginBottom: 6 }]}>
        <MaterialIcons name="search" size={20} color={colors.icon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Find users by @username…"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={18} color={colors.icon} />
          </Pressable>
        ) : null}
      </View>

      {/* Section Title */}
      {isSearchActive ? (
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {searching ? 'Searching...' : hasSearched ? `${searchResults.length} result(s)` : ''}
        </Text>
      ) : (
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {contacts.length > 0 ? `${contacts.length} friend(s)` : ''}
        </Text>
      )}

      {/* List */}
      {!isSearchActive && displayList.length === 0 ? (
        <EmptyState
          icon="people"
          title={(t as any).noFriends || 'No friends yet'}
          description={(t as any).noFriendsDesc || 'Search by username to add friends'}
          colors={colors}
        />
      ) : isSearchActive && !searching && hasSearched && searchResults.length === 0 ? (
        <EmptyState
          icon="search-off"
          title="No users found"
          description="Try a different username"
          colors={colors}
        />
      ) : (
        <FlatList
          data={displayList as any[]}
          keyExtractor={(item) => isSearchActive ? item.id : item.userId}
          renderItem={({ item }) => {
            const userId = isSearchActive ? item.id : item.userId;
            const username = item.username || '';
            const displayName = item.display_name || (item as any).displayName || username;
            const avatar = item.avatar;
            const bio = item.bio;
            const isOnline = item.is_online ?? item.isOnline ?? false;
            const isFriend = contacts.some((c) => c.userId === userId);

            return (
              <Pressable
                onPress={() => handleStartChat(userId, displayName || username, avatar)}
                style={({ pressed }) => [
                  styles.userItem,
                  { backgroundColor: pressed ? colors.surfaceSecondary : colors.surface },
                ]}
              >
                <Avatar
                  uri={avatar}
                  username={username}
                  size={50}
                  isOnline={isOnline}
                  colors={colors}
                />
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                      {displayName || username}
                    </Text>
                    {isFriend ? (
                      <View style={[styles.friendBadge, { backgroundColor: colors.primary + '22' }]}>
                        <MaterialIcons name="people" size={11} color={colors.primary} />
                        <Text style={[styles.friendBadgeText, { color: colors.primary }]}>Friend</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.username, { color: colors.textSecondary }]}>@{username}</Text>
                  {bio ? (
                    <Text style={[styles.bio, { color: colors.textTertiary }]} numberOfLines={1}>{bio}</Text>
                  ) : null}
                </View>
                <View style={styles.actions}>
                  {/* Chat icon */}
                  <Pressable
                    onPress={() => handleStartChat(userId, displayName || username, avatar)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <MaterialIcons name="chat" size={18} color="#fff" />
                  </Pressable>
                  {/* Add friend icon (only when searching and not already a friend) */}
                  {isSearchActive && !isFriend && userId !== currentUser?.id ? (
                    <Pressable
                      onPress={() => handleAddContact(userId, username, avatar)}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1, marginLeft: 8 },
                      ]}
                    >
                      <MaterialIcons name="person-add" size={18} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListHeaderComponent={
            isSearchActive && searchResults.length > 0 ? (
              <Text style={[styles.resultHeader, { color: colors.textSecondary }]}>
                Search results — tap to chat, + to add as friend
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    includeFontPadding: false,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    includeFontPadding: false,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 22,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    includeFontPadding: false,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    includeFontPadding: false,
  },
  resultHeader: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    includeFontPadding: false,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  friendBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    includeFontPadding: false,
  },
  username: {
    fontSize: 13,
    marginTop: 1,
    includeFontPadding: false,
  },
  bio: {
    fontSize: 13,
    marginTop: 2,
    includeFontPadding: false,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
