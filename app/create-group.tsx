// Openflou Create Group Screen
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { generateChatId } from '@/services/encryption';
import { Chat } from '@/types';
import { StatusBar } from 'expo-status-bar';

export default function CreateGroupScreen() {
  const { colors, t, contacts, loadContacts, currentUser, addChat, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [groupName, setGroupName] = useState('');
  const [username, setUsername] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    loadContacts();
  }, []);

  function toggleMember(userId: string) {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleCreate() {
    if (!groupName.trim()) {
      showAlert(t.fillAllFields || 'Please enter group name');
      return;
    }

    if (selectedMembers.length === 0) {
      showAlert('Please select at least one member');
      return;
    }

    if (!currentUser) return;

    const newGroup: Chat = {
      id: generateChatId([currentUser.id, ...selectedMembers, Date.now().toString()]),
      type: 'group',
      name: groupName.trim(),
      username: username.trim() || undefined,
      participants: [currentUser.id, ...selectedMembers],
      admins: [currentUser.id],
      creatorId: currentUser.id,
      bannedUsers: [],
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      createdAt: new Date(),
    };

    const { error } = await addChat(newGroup);
    if (error) {
      showAlert(error);
      return;
    }
    
    showAlert('Group created successfully');
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.createGroup}</Text>
        <Pressable
          onPress={handleCreate}
          disabled={!groupName.trim() || selectedMembers.length === 0}
          style={({ pressed }) => [
            styles.createButton,
            {
              opacity: !groupName.trim() || selectedMembers.length === 0 ? 0.3 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.createButtonText, { color: colors.primary }]}>{t.createGroup}</Text>
        </Pressable>
      </View>

      <ScrollView>
        {/* Group Name Input */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={[styles.groupIcon, { backgroundColor: colors.surfaceSecondary }]}>
            <MaterialIcons name="group" size={32} color={colors.icon} />
          </View>
          <View style={styles.nameInputs}>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder={t.groupName}
              placeholderTextColor={colors.textTertiary}
              style={[styles.groupInput, { color: colors.text }]}
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

        {/* Selected Count */}
        {selectedMembers.length > 0 && (
          <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
            {selectedMembers.length} {t.members}
          </Text>
        )}

        {/* Contacts List */}
        <View style={styles.contactsList}>
          {contacts.map((contact) => {
            const isSelected = selectedMembers.includes(contact.userId);
            
            return (
              <Pressable
                key={contact.userId}
                onPress={() => toggleMember(contact.userId)}
                style={({ pressed }) => [
                  styles.contactItem,
                  {
                    backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
                  },
                ]}
              >
                <Avatar
                  uri={contact.avatar}
                  username={contact.username}
                  size={48}
                  isOnline={contact.isOnline}
                  colors={colors}
                />
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{contact.username}</Text>
                  {contact.bio && (
                    <Text style={[styles.contactBio, { color: colors.textSecondary }]} numberOfLines={1}>
                      {contact.bio}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <MaterialIcons name="check" size={18} color={colors.textInverted} />}
                </View>
              </Pressable>
            );
          })}
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
  groupIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameInputs: {
    flex: 1,
    marginLeft: 16,
  },
  groupInput: {
    fontSize: 16,
    marginBottom: 4,
  },
  usernameInput: {
    fontSize: 14,
  },
  selectedCount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    includeFontPadding: false,
  },
  contactsList: {
    marginTop: 8,
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
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  contactBio: {
    fontSize: 14,
    marginTop: 2,
    includeFontPadding: false,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
