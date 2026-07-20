// Openflou Contacts Tab
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar, EmptyState } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { generateChatId } from '@/services/encryption';
import { Contact, Chat } from '@/types';
import { StatusBar } from 'expo-status-bar';

export default function ContactsTab() {
  const { colors, t, contacts, loadContacts, addContact, currentUser, addChat, chats, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadContacts();
  }, []);

  async function handleAddContact(contact: Contact) {
    try {
      const exists = contacts.some((c) => c.userId === contact.userId);
      if (exists) {
        showAlert(t.alreadyInContacts);
        return;
      }
      await addContact(contact);
      showAlert(t.contactAdded);
    } catch {
      showAlert('Error adding contact');
    }
  }

  async function handleStartChat(contact: Contact) {
    if (!currentUser) return;
    const chatId = generateChatId([currentUser.id, contact.userId]);
    const existingChat = chats.find((c) => c.id === chatId);

    if (existingChat) {
      router.push(`/chat?id=${chatId}`);
      return;
    }

    const newChat: Chat = {
      id: chatId,
      type: 'private',
      name: contact.username,
      avatar: contact.avatar,
      participants: [currentUser.id, contact.userId],
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      createdAt: new Date(),
    };

    await addChat(newChat);
    router.push(`/chat?id=${chatId}`);
  }

  const displayList = contacts.map((c) => ({ user: c, isContact: true }));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.contacts}</Text>

        <View style={styles.headerButtons}>
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
      </View>

      {/* Contact List */}
      {displayList.length === 0 ? (
        <EmptyState
          icon="contacts"
          title={t.noContacts}
          description={t.noContactsDesc}
          colors={colors}
        />
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item) => item.user.userId}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleStartChat(item.user)}
              style={({ pressed }) => [
                styles.contactItem,
                { backgroundColor: pressed ? colors.surfaceSecondary : colors.surface },
              ]}
            >
              <Avatar
                uri={item.user.avatar}
                username={item.user.username}
                size={48}
                isOnline={item.user.isOnline}
                colors={colors}
              />
              <View style={styles.contactInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.contactName, { color: colors.text }]}>
                    {(item.user as any).displayName || item.user.username}
                  </Text>
                  {(item.user as any).displayName ? (
                    <Text style={[styles.usernameSmall, { color: colors.textTertiary }]}>
                      @{item.user.username}
                    </Text>
                  ) : null}
                </View>
                {item.user.bio ? (
                  <Text style={[styles.contactBio, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.user.bio}
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name="chat" size={24} color={colors.icon} />
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    includeFontPadding: false,
  },
  headerButtons: {
    flexDirection: 'row',
    marginTop: 8,
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
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  usernameSmall: {
    fontSize: 13,
    includeFontPadding: false,
  },
  contactBio: {
    fontSize: 14,
    marginTop: 2,
    includeFontPadding: false,
  },
});
