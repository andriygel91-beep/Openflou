// Openflou Contacts Tab
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar, EmptyState } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import * as storage from '@/services/storage';
import { generateChatId } from '@/services/encryption';
import { Contact, Chat } from '@/types';
import { StatusBar } from 'expo-status-bar';

interface SearchResult {
  user: Contact;
  isContact: boolean;
}

export default function ContactsTab() {
  const { colors, t, contacts, loadContacts, addContact, currentUser, addChat, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    loadContacts();
  }, []);

  async function importFromPhoneContacts() {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== 'granted') {
        showAlert('Permission to access contacts was denied');
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      if (data.length === 0) {
        showAlert(t.noContacts);
        return;
      }

      showAlert(`Found ${data.length} contacts. Checking Openflou users...`);
      
      // Check which contacts have Openflou accounts
      const allUsers = await storage.getUsers();
      let foundUsers = 0;
      
      for (const contact of data) {
        if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) continue;
        
        // In real P2P, search by phone number hash
        const phoneNumber = contact.phoneNumbers[0].number?.replace(/\D/g, '');
        
        // For demo: search by name similarity
        const matchedUser = allUsers.find((u) => 
          contact.name?.toLowerCase().includes(u.username.toLowerCase())
        );
        
        if (matchedUser) {
          foundUsers++;
          const newContact: Contact = {
            userId: matchedUser.id,
            username: matchedUser.username,
            avatar: matchedUser.avatar,
            bio: matchedUser.bio,
            isOnline: matchedUser.isOnline,
            lastSeen: matchedUser.lastSeen,
            addedAt: new Date(),
          };
          
          const exists = contacts.some((c) => c.userId === matchedUser.id);
          if (!exists) {
            await addContact(newContact);
          }
        }
      }
      
      if (foundUsers > 0) {
        showAlert(`Added ${foundUsers} contacts from your phone`);
      } else {
        showAlert('No Openflou users found. Invite your friends!');
        router.push('/invite');
      }
    } catch (error) {
      showAlert('Error importing contacts');
      console.error(error);
    }
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      const allUsers = await storage.getUsers();
      const query = searchQuery.toLowerCase();
      
      const results: SearchResult[] = [];
      
      for (const user of allUsers) {
        if (user.id === currentUser?.id) continue;
        
        if (user.username.toLowerCase().includes(query)) {
          const isContact = contacts.some((c) => c.userId === user.id);
          
          results.push({
            user: {
              userId: user.id,
              username: user.username,
              avatar: user.avatar,
              bio: user.bio,
              isOnline: user.isOnline,
              lastSeen: user.lastSeen,
              addedAt: new Date(),
            },
            isContact,
          });
        }
      }
      
      results.sort((a, b) => {
        if (a.isContact && !b.isContact) return -1;
        if (!a.isContact && b.isContact) return 1;
        return a.user.username.localeCompare(b.user.username);
      });
      
      setSearchResults(results);
    };

    searchUsers();
  }, [searchQuery, contacts]);

  const displayList = searchQuery.trim() ? searchResults : contacts.map((c) => ({ user: c, isContact: true }));

  async function handleAddContact(contact: Contact) {
    try {
      const existingContact = contacts.find((c) => c.userId === contact.userId);
      if (existingContact) {
        showAlert(t.alreadyInContacts);
        return;
      }

      await addContact(contact);
      showAlert(t.contactAdded);
    } catch (error) {
      showAlert('Error adding contact');
      console.error(error);
    }
  }

  async function handleStartChat(contact: Contact) {
    if (!currentUser) return;

    const chatId = generateChatId([currentUser.id, contact.userId]);
    const existingChats = await storage.getChats();
    const existingChat = existingChats.find((c) => c.id === chatId);

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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.contacts}</Text>
        
        <View style={styles.headerButtons}>
          <Pressable
            onPress={importFromPhoneContacts}
            style={({ pressed }) => [
              styles.importButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <MaterialIcons name="contacts" size={18} color={colors.textInverted} />
            <Text style={[styles.importButtonText, { color: colors.textInverted }]}>
              {t.importFromContacts}
            </Text>
          </Pressable>
          
          <Pressable
            onPress={() => router.push('/join-chat')}
            style={({ pressed }) => [
              styles.joinButton,
              {
                backgroundColor: colors.surfaceSecondary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <MaterialIcons name="group-add" size={18} color={colors.primary} />
            <Text style={[styles.joinButtonText, { color: colors.primary }]}>Join</Text>
          </Pressable>
        </View>
        
        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary }]}>
          <MaterialIcons name="search" size={20} color={colors.icon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t.searchByUsername}
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Search Results / Contact List */}
      {displayList.length === 0 ? (
        <EmptyState
          icon={searchQuery.trim() ? "search-off" : "contacts"}
          title={searchQuery.trim() ? t.noResults : t.noContacts}
          description={searchQuery.trim() ? t.tryDifferentQuery : t.noContactsDesc}
          colors={colors}
        />
      ) : (
        <>
          {searchQuery.trim() && (
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t.searchResults} ({searchResults.length})
            </Text>
          )}
          <FlatList
            data={displayList}
            keyExtractor={(item) => item.user.userId}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleStartChat(item.user)}
                style={({ pressed }) => [
                  styles.contactItem,
                  {
                    backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
                  },
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
                      {item.user.username}
                    </Text>
                    {!item.isContact && (
                      <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                          {t.notInContacts}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.user.bio && (
                    <Text style={[styles.contactBio, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.user.bio}
                    </Text>
                  )}
                </View>
                {item.isContact ? (
                  <MaterialIcons name="chat" size={24} color={colors.icon} />
                ) : (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAddContact(item.user);
                    }}
                    style={({ pressed }) => [
                      styles.addButton,
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <MaterialIcons name="person-add" size={18} color={colors.textInverted} />
                  </Pressable>
                )}
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
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
    marginBottom: 12,
  },
  importButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
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
    height: 40,
    borderRadius: 20,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
    includeFontPadding: false,
  },
  contactBio: {
    fontSize: 14,
    marginTop: 2,
    includeFontPadding: false,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
