// Openflou Edit Chat Screen (Groups & Channels)
import React, { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { Chat } from '@/types';
import { getSupabaseClient } from '@/template';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';

export default function EditChatScreen() {
  const { colors, t, theme, updateChat, contacts, loadContacts, currentUser, chats } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const chat = chats.find((c) => c.id === id) || null;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [disappearingEnabled, setDisappearingEnabled] = useState(false);
  const [disappearingTimer, setDisappearingTimer] = useState(86400); // 1 day default
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (chat) {
      setName(chat.name || '');
      setUsername(chat.username || '');
      setDescription(chat.description || '');
      setAvatar(chat.avatar);
      setSelectedMembers(chat.participants.filter((p) => p !== currentUser?.id));
      setDisappearingEnabled(chat.disappearingMessagesEnabled || false);
      setDisappearingTimer(chat.disappearingMessagesTimer || 86400);
      setIsPublic(!!chat.username);
    }
    loadContacts();
  }, [chat?.id]);

  function toggleMember(userId: string) {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((mid) => mid !== userId) : [...prev, userId]
    );
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showAlert('Permission denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
    }
  }

  async function uploadAvatarIfNeeded(uri: string | undefined): Promise<string | undefined> {
    if (!uri || !uri.startsWith('file://')) return uri;
    try {
      const supabase = getSupabaseClient();
      const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
      const path = `avatars/chat_${id}_${Date.now()}.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error } = await supabase.storage.from('openflou-media').upload(path, bytes.buffer, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        upsert: true,
      });
      if (error) { console.error('Avatar upload error:', error); return uri; }
      const { data } = supabase.storage.from('openflou-media').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      console.error('Avatar upload failed:', e);
      return uri;
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      showAlert(isChannel ? 'Channel name cannot be empty' : 'Group name cannot be empty');
      return;
    }
    if (!chat || !currentUser) return;
    setSaving(true);

    const finalAvatar = await uploadAvatarIfNeeded(avatar);

    const updatedChat: Chat = {
      ...chat,
      name: name.trim(),
      username: isPublic && username.trim() ? username.trim() : undefined,
      description: description.trim() || undefined,
      avatar: finalAvatar,
      participants: isChannel
        ? chat.participants
        : [currentUser.id, ...selectedMembers],
      disappearingMessagesEnabled: disappearingEnabled,
      disappearingMessagesTimer: disappearingEnabled ? disappearingTimer : undefined,
    };

    const { error } = await updateChat(updatedChat);
    setSaving(false);
    if (error) { showAlert('Error', error); return; }
    showAlert(isChannel ? 'Channel updated' : 'Group updated');
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

  const TIMER_OPTIONS = [
    { label: '30 sec', value: 30 },
    { label: '1 min', value: 60 },
    { label: '5 min', value: 300 },
    { label: '1 hour', value: 3600 },
    { label: '1 day', value: 86400 },
    { label: '1 week', value: 604800 },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isChannel ? 'Edit Channel' : 'Edit Group'}
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={!name.trim() || saving}
          style={({ pressed }) => [styles.saveButton, { opacity: !name.trim() || saving ? 0.4 : pressed ? 0.7 : 1 }]}
        >
          <MaterialIcons name="check" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + Name */}
        <View style={[styles.avatarSection, { backgroundColor: colors.surface }]}>
          <Pressable onPress={pickAvatar} style={({ pressed }) => [styles.avatarWrap, { opacity: pressed ? 0.75 : 1 }]}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                <MaterialIcons name={isChannel ? 'campaign' : 'group'} size={36} color={colors.icon} />
              </View>
            )}
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="photo-camera" size={14} color="#fff" />
            </View>
          </Pressable>

          <View style={styles.nameBlock}>
            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={isChannel ? 'Channel name' : 'Group name'}
                placeholderTextColor={colors.textTertiary}
                style={[styles.nameInput, { color: colors.text }]}
                maxLength={50}
              />
            </View>
            {isPublic && (
              <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.atSign, { color: colors.textSecondary }]}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="username (optional)"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.usernameInput, { color: colors.textSecondary }]}
                  maxLength={32}
                  autoCapitalize="none"
                />
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DESCRIPTION</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={isChannel ? 'What is your channel about?' : 'What is your group about?'}
            placeholderTextColor={colors.textTertiary}
            style={[styles.descInput, { color: colors.text }]}
            maxLength={500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: colors.textTertiary }]}>{description.length}/500</Text>
        </View>

        {/* Channel-specific: Public/Private toggle */}
        {isChannel && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CHANNEL TYPE</Text>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  {isPublic ? 'Public Channel' : 'Private Channel'}
                </Text>
                <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>
                  {isPublic
                    ? 'Anyone can find and join via @username'
                    : 'Only invited users can join'}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: colors.border, true: colors.primary + '88' }}
                thumbColor={isPublic ? colors.primary : colors.icon}
              />
            </View>
          </View>
        )}

        {/* Disappearing messages */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DISAPPEARING MESSAGES</Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Auto-delete messages</Text>
              <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>
                Messages will be deleted after a set time
              </Text>
            </View>
            <Switch
              value={disappearingEnabled}
              onValueChange={setDisappearingEnabled}
              trackColor={{ false: colors.border, true: colors.primary + '88' }}
              thumbColor={disappearingEnabled ? colors.primary : colors.icon}
            />
          </View>

          {disappearingEnabled && (
            <View style={styles.timerGrid}>
              {TIMER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setDisappearingTimer(opt.value)}
                  style={[
                    styles.timerChip,
                    {
                      backgroundColor: disappearingTimer === opt.value ? colors.primary : colors.surfaceSecondary,
                      borderColor: disappearingTimer === opt.value ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.timerChipText,
                      { color: disappearingTimer === opt.value ? '#fff' : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Members (groups only) */}
        {!isChannel && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              MEMBERS · {selectedMembers.length + 1}
            </Text>
            {contacts.map((contact) => {
              const isSelected = selectedMembers.includes(contact.userId);
              return (
                <Pressable
                  key={contact.userId}
                  onPress={() => toggleMember(contact.userId)}
                  style={({ pressed }) => [
                    styles.memberRow,
                    { backgroundColor: pressed ? colors.surfaceSecondary : 'transparent' },
                  ]}
                >
                  <Avatar uri={contact.avatar} username={contact.username} size={46} colors={colors} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.memberName, { color: colors.text }]}>{contact.username}</Text>
                    {contact.bio ? (
                      <Text style={[styles.memberBio, { color: colors.textSecondary }]} numberOfLines={1}>
                        {contact.bio}
                      </Text>
                    ) : null}
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
                    {isSelected ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingText: { textAlign: 'center', marginTop: 32, fontSize: 16, includeFontPadding: false },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', marginLeft: 8, includeFontPadding: false },
  saveButton: { padding: 8 },
  // Avatar section
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 12,
    gap: 16,
  },
  avatarWrap: { position: 'relative' },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameBlock: { flex: 1, gap: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 6 },
  atSign: { fontSize: 16, marginRight: 4, includeFontPadding: false },
  nameInput: { flex: 1, fontSize: 18, fontWeight: '600', includeFontPadding: false },
  usernameInput: { flex: 1, fontSize: 15, includeFontPadding: false },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
    includeFontPadding: false,
  },
  descInput: { fontSize: 15, minHeight: 90, includeFontPadding: false, lineHeight: 22 },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 6, includeFontPadding: false },
  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '500', includeFontPadding: false },
  toggleSub: { fontSize: 13, marginTop: 2, includeFontPadding: false },
  // Timer
  timerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  timerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  timerChipText: { fontSize: 13, fontWeight: '500', includeFontPadding: false },
  // Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  memberName: { fontSize: 15, fontWeight: '600', includeFontPadding: false },
  memberBio: { fontSize: 13, marginTop: 2, includeFontPadding: false },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
