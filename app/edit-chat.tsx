// Openflou Edit Chat Screen (Groups & Channels)
import React, { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { Chat } from '@/types';
import * as api from '@/services/api';
import { getSupabaseClient } from '@/template';
import { StatusBar } from 'expo-status-bar';

export default function EditChatScreen() {
  const { colors, t, updateChat, contacts, loadContacts, currentUser, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [chat, setChat] = useState<Chat | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | undefined>();

  useEffect(() => {
    loadChat();
    loadContacts();
  }, [id]);

  async function loadChat() {
    if (!id || !currentUser) return;
    
    const { data: chatData } = await getSupabaseClient()
      .from('openflou_chats')
      .select('*')
      .eq('id', id)
      .single();
    
    const foundChat = chatData ? {
      id: chatData.id,
      type: chatData.type,
      name: chatData.name,
      username: chatData.username,
      avatar: chatData.avatar,
      description: chatData.description,
      participants: chatData.participants || [],
      admins: chatData.admins || [],
      creatorId: chatData.creator_id,
      bannedUsers: chatData.banned_users || [],
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      createdAt: new Date(chatData.created_at),
    } as Chat : null;
    
    if (foundChat) {
      setChat(foundChat);
      setName(foundChat.name || '');
      setUsername(foundChat.username || '');
      setDescription(foundChat.description || '');
      setAvatar(foundChat.avatar);
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

    let finalAvatar = avatar;
    // Upload avatar if it's a local file
    if (avatar && avatar.startsWith('file://')) {
      try {
        const supabase = getSupabaseClient();
        const ext = avatar.split('.').pop() || 'jpg';
        const path = `avatars/chat_${chat.id}_${Date.now()}.${ext}`;
        const response = await fetch(avatar);
        const blob = await response.blob();
        const ab = await new Promise<ArrayBuffer>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result as ArrayBuffer);
          fr.onerror = rej;
          fr.readAsArrayBuffer(blob);
        });
        const { error: upErr } = await supabase.storage.from('openflou-media').upload(path, ab, {
          contentType: `image/${ext}`,
          upsert: true,
        });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('openflou-media').getPublicUrl(path);
          finalAvatar = urlData.publicUrl;
        }
      } catch (e) {
        console.error('Avatar upload failed:', e);
      }
    }

    const updatedChat: Chat = {
      ...chat,
      name: name.trim(),
      username: username.trim() || undefined,
      description: description.trim() || undefined,
      avatar: finalAvatar,
      participants: [currentUser.id, ...selectedMembers],
    };

    const { error } = await updateChat(updatedChat);
    if (error) {
      showAlert('Error', error);
      return;
    }
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
          <Pressable
            onPress={async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                showAlert('Permission denied');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                // Store local URI temporarily; it will be uploaded on save
                setAvatar(result.assets[0].uri);
              }
            }}
            style={({ pressed }) => [
              styles.icon,
              {
                backgroundColor: colors.surfaceSecondary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.iconImage} />
            ) : (
              <MaterialIcons name={isChannel ? 'campaign' : 'group'} size={32} color={colors.icon} />
            )}
          </Pressable>
          <View style={styles.inputContainer}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={isChannel ? t.channelName : t.groupName}
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
    overflow: 'hidden',
  },
  iconImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
