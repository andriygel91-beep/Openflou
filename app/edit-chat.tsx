// Openflou Edit Chat Screen (Groups & Channels)
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import * as storage from '@/services/storage';
import { Chat } from '@/types';
import { StatusBar } from 'expo-status-bar';

export default function EditChatScreen() {
  const { colors, t, updateChat, contacts, loadContacts, currentUser, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [chat, setChat] = useState<Chat | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    loadChat();
    loadContacts();
  }, [id]);

  async function loadChat() {
    if (!id) return;
    
    const chats = await storage.getChats();
    const foundChat = chats.find((c) => c.id === id);
    
    if (foundChat) {
      setChat(foundChat);
      setName(foundChat.name || '');
      setDescription(foundChat.description || '');
      setSelectedMembers(foundChat.participants.filter((p) => p !== currentUser?.id));
    }
  }

  function toggleMember(userId: string) {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      showAlert(chat?.type === 'channel' ? 'Channel name cannot be empty' : 'Group name cannot be empty');
      return;
    }

    if (!chat || !currentUser) return;

    const updatedChat: Chat = {
      ...chat,
      name: name.trim(),
      description: description.trim() || undefined,
      participants: [currentUser.id, ...selectedMembers],
    };

    await updateChat(updatedChat);
    showAlert(chat.type === 'channel' ? 'Channel updated' : 'Group updated');
    router.back();
  }

  if (!chat) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const isChannel = chat.type === 'channel';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isChannel ? t.editChannel : t.editGroup}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!name.trim()}
          style={({ pressed }) => [
            styles.saveButton,
            {
              opacity: !name.trim() ? 0.3 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <MaterialIcons name="check" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView>
        {/* Icon & Name */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={[styles.icon, { backgroundColor: colors.surfaceSecondary }]}>
            <MaterialIcons name={isChannel ? 'campaign' : 'group'} size={32} color={colors.icon} />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={isChannel ? t.channelName : t.groupName}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.text }]}
              maxLength={50}
            />
          </View>
        </View>

        {/* Description */}
        <View style={[styles.descriptionSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {isChannel ? t.channelDescription : 'Description'}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={isChannel ? 'What is your channel about?' : 'What is your group about?'}
            placeholderTextColor={colors.textTertiary}
            style={[styles.descriptionInput, { color: colors.text }]}
            maxLength={200}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Members/Subscribers */}
        {!isChannel && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {selectedMembers.length} {t.members}
            </Text>
            
            <View style={styles.membersList}>
              {contacts.map((contact) => {
                const isSelected = selectedMembers.includes(contact.userId);
                
                return (
                  <Pressable
                    key={contact.userId}
                    onPress={() => toggleMember(contact.userId)}
                    style={({ pressed }) => [
                      styles.memberItem,
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
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: colors.text }]}>{contact.username}</Text>
                      {contact.bio && (
                        <Text style={[styles.memberBio, { color: colors.textSecondary }]} numberOfLines={1}>
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
    includeFontPadding: false,
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
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  icon: {
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    includeFontPadding: false,
  },
  membersList: {
    marginTop: 4,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  memberBio: {
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
