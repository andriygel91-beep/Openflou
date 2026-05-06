// Openflou Chat Screen
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar, MessageBubble, VoiceRecorder, ReactionPicker, MediaPicker } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { Message } from '@/types';
import { generateMessageId, encryptMessage } from '@/services/encryption';
import { StatusBar } from 'expo-status-bar';
import { uploadMedia } from '@/services/mediaUpload';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    colors, t, chats, currentUser,
    getMessagesForChat, sendMessage, updateMessage, updateChat,
    theme, addReaction, removeReaction,
  } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const chat = chats.find((c) => c.id === id);
  const isAdmin = chat?.admins?.includes(currentUser?.id || '');
  const isCreator = chat?.creatorId === currentUser?.id;
  const canManage = isAdmin || isCreator;
  const canPost =
    chat?.type !== 'channel' ||
    isAdmin ||
    isCreator;

  // Auto-refresh messages
  useEffect(() => {
    if (!id) return;
    loadMessages();
    const interval = setInterval(loadMessages, 800);
    return () => clearInterval(interval);
  }, [id]);

  // Pinned message
  useEffect(() => {
    if (chat?.pinnedMessageId) {
      const pinned = messages.find((m) => m.id === chat.pinnedMessageId);
      setPinnedMessage(pinned || null);
    } else {
      setPinnedMessage(null);
    }
  }, [chat?.pinnedMessageId, messages]);

  async function loadMessages() {
    if (!id) return;
    const loaded = await getMessagesForChat(id);
    setMessages((prev) => {
      // Keep optimistic messages whose ID hasn't appeared in server results yet
      const serverIds = new Set(loaded.map((m) => m.id));
      const pendingOptimistic = prev.filter(
        (m) => m.id.startsWith('opt_') && !serverIds.has(m.id)
      );
      // Merge: server messages + still-pending optimistic ones, sorted by timestamp
      const merged = [...loaded, ...pendingOptimistic].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      return merged;
    });
  }

  // ── Text send ──
  async function handleSend() {
    if (!inputText.trim() || !currentUser || !id) return;
    if (!canPost) {
      showAlert('Only admins can send messages in this channel');
      return;
    }
    if (chat?.bannedUsers?.includes(currentUser.id)) {
      showAlert('You are banned from this chat');
      return;
    }

    const text = inputText.trim();
    setInputText('');

    const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const msg: Message = {
      id: optimisticId,
      chatId: id,
      senderId: currentUser.id,
      content: text,
      encryptedContent: encryptMessage(text),
      type: 'text',
      timestamp: new Date(),
      isRead: false,
      isEdited: false,
    };

    setMessages((prev) => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    const { error } = await sendMessage(msg);
    if (error) {
      showAlert(error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }
  }

  // ── Media helpers ──
  async function sendMedia(
    uri: string,
    type: 'photo' | 'video',
    uploadType: 'image' | 'video'
  ) {
    if (!currentUser || !id) return;
    setUploadingMedia(true);

    const optimistic: Message = {
      id: `opt_${Date.now()}`,
      chatId: id,
      senderId: currentUser.id,
      content: '',
      type,
      mediaUrl: uri, // show local preview immediately
      timestamp: new Date(),
      isRead: false,
      isEdited: false,
    };

    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    const uploadedUrl = await uploadMedia(uri, currentUser.id, uploadType);
    setUploadingMedia(false);

    if (!uploadedUrl) {
      showAlert(`Failed to upload ${type}`);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      return;
    }

    const real: Message = { ...optimistic, id: generateMessageId(), mediaUrl: uploadedUrl };
    setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));

    const { error } = await sendMessage(real);
    if (error) {
      showAlert(error);
      setMessages((prev) => prev.filter((m) => m.id !== real.id));
    }
  }

  async function handleFileSelected(uri: string, name: string, size: number) {
    if (!currentUser || !id) return;
    setUploadingMedia(true);

    const uploadedUrl = await uploadMedia(uri, currentUser.id, 'file');
    setUploadingMedia(false);

    if (!uploadedUrl) {
      showAlert('Failed to upload file');
      return;
    }

    const msg: Message = {
      id: generateMessageId(),
      chatId: id,
      senderId: currentUser.id,
      content: '',
      type: 'file',
      mediaUrl: uploadedUrl,
      fileName: name,
      fileSize: size,
      timestamp: new Date(),
      isRead: false,
      isEdited: false,
    };

    const { error } = await sendMessage(msg);
    if (error) {
      showAlert(error);
      return;
    }
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  // ── Voice ──
  async function handleVoiceSend(uri: string, duration: number) {
    if (!currentUser || !id) return;
    setIsRecordingMode(false);

    const optimistic: Message = {
      id: `opt_voice_${Date.now()}`,
      chatId: id,
      senderId: currentUser.id,
      content: '',
      type: 'voice',
      mediaUrl: uri,
      duration,
      timestamp: new Date(),
      isRead: false,
      isEdited: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    const uploadedUrl = await uploadMedia(uri, currentUser.id, 'voice');
    if (!uploadedUrl) {
      showAlert('Failed to upload voice message');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      return;
    }

    const real: Message = { ...optimistic, id: generateMessageId(), mediaUrl: uploadedUrl };
    setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));

    const { error } = await sendMessage(real);
    if (error) {
      showAlert(error);
      setMessages((prev) => prev.filter((m) => m.id !== real.id));
    }
  }

  // ── Message actions ──
  function handleMessageLongPress(message: Message) {
    const isOwn = message.senderId === currentUser?.id;

    const buttons: any[] = [];

    if (message.type === 'text' && isOwn) {
      buttons.push({
        text: 'Edit',
        onPress: () => {
          setEditingMessage(message);
          setEditText(message.content);
        },
      });
    }

    if (canManage) {
      buttons.push({
        text: chat?.pinnedMessageId === message.id ? 'Unpin' : 'Pin Message',
        onPress: () => handlePinMessage(message),
      });
    }

    buttons.push({
      text: 'React',
      onPress: () => {
        setSelectedMessage(message);
        setShowReactionPicker(true);
      },
    });

    if (isOwn) {
      buttons.push({
        text: 'Delete',
        style: 'destructive' as const,
        onPress: async () => {
          // handled via server — just remove from local for now
          setMessages((prev) => prev.filter((m) => m.id !== message.id));
        },
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' as const });
    showAlert('Message', undefined, buttons);
  }

  async function handlePinMessage(message: Message) {
    if (!chat || !canManage) return;
    const updatedChat = {
      ...chat,
      pinnedMessageId: chat.pinnedMessageId === message.id ? undefined : message.id,
    };
    const { error } = await updateChat(updatedChat);
    if (error) showAlert('Error', error);
  }

  async function handleEditSubmit() {
    if (!editingMessage || !editText.trim()) return;
    const updated: Message = { ...editingMessage, content: editText.trim(), isEdited: true };
    const { error } = await updateMessage(updated);
    if (error) { showAlert(error); return; }
    await loadMessages();
    setEditingMessage(null);
    setEditText('');
  }

  async function handleReactionSelect(emoji: string) {
    if (!selectedMessage || !id) return;
    await addReaction(selectedMessage.id, id, emoji);
    await loadMessages();
  }

  async function handleReactionPress(message: Message, emoji: string) {
    if (!currentUser || !id) return;
    const reacted = message.reactions?.some((r) => r.emoji === emoji && r.userId === currentUser.id);
    if (reacted) {
      await removeReaction(message.id, id, emoji);
    } else {
      await addReaction(message.id, id, emoji);
    }
    await loadMessages();
  }

  if (!chat) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, padding: 24 }}>Chat not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.chatBackground }]} edges={['top']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Avatar uri={chat.avatar} username={chat.name} size={40} isOnline colors={colors} />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{chat.name}</Text>
          <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>
            {uploadingMedia ? 'Uploading...' : t.online}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/chat-settings?id=${chat.id}`)}
          style={styles.headerButton}
        >
          <MaterialIcons name="info-outline" size={24} color={colors.icon} />
        </Pressable>
      </View>

      {/* Pinned Message */}
      {pinnedMessage ? (
        <Pressable
          onPress={() => {
            const idx = messages.findIndex((m) => m.id === pinnedMessage.id);
            if (idx !== -1) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
          }}
          style={[styles.pinnedContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        >
          <MaterialIcons name="push-pin" size={18} color={colors.primary} />
          <View style={styles.pinnedContent}>
            <Text style={[styles.pinnedLabel, { color: colors.primary }]}>Pinned</Text>
            <Text style={[styles.pinnedText, { color: colors.text }]} numberOfLines={1}>
              {pinnedMessage.content || '📎 Media'}
            </Text>
          </View>
          {canManage ? (
            <Pressable onPress={() => handlePinMessage(pinnedMessage)} style={styles.unpinButton}>
              <MaterialIcons name="close" size={18} color={colors.icon} />
            </Pressable>
          ) : null}
        </Pressable>
      ) : null}

      {/* Messages + Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatContainer}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOutgoing={item.senderId === currentUser?.id}
              colors={colors}
              onLongPress={() => handleMessageLongPress(item)}
              onReactionPress={(emoji) => handleReactionPress(item, emoji)}
            />
          )}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScrollToIndexFailed={() => {}}
        />

        {/* Input area */}
        {editingMessage ? (
          <View style={[styles.inputContainer, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 8) }]}>
            <Pressable onPress={() => { setEditingMessage(null); setEditText(''); }} style={styles.attachButton}>
              <MaterialIcons name="close" size={24} color={colors.error} />
            </Pressable>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              placeholder="Edit message"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSecondary }]}
              multiline
              maxLength={4000}
              autoFocus
            />
            <Pressable
              onPress={handleEditSubmit}
              style={[styles.sendButton, { backgroundColor: colors.primary }]}
            >
              <MaterialIcons name="check" size={20} color="#fff" />
            </Pressable>
          </View>
        ) : isRecordingMode ? (
          <View style={[styles.inputContainer, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 8) }]}>
            <VoiceRecorder
              colors={colors}
              t={t}
              onSend={handleVoiceSend}
              onCancel={() => setIsRecordingMode(false)}
            />
          </View>
        ) : !canPost ? (
          // Channel read-only footer
          <View style={[styles.channelFooter, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={[styles.channelInfoBanner, { backgroundColor: colors.surfaceSecondary }]}>
              <MaterialIcons name="campaign" size={18} color={colors.textSecondary} />
              <Text style={[styles.channelInfoText, { color: colors.textSecondary }]}>Channel · Read only</Text>
            </View>
            <Pressable
              onPress={() => showAlert(chat.isMuted ? 'Unmuted' : 'Muted', `Notifications ${chat.isMuted ? 'enabled' : 'disabled'}`)}
              style={({ pressed }) => [styles.muteButton, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
            >
              <MaterialIcons name={chat.isMuted ? 'notifications-off' : 'notifications'} size={20} color={colors.primary} />
              <Text style={[styles.muteButtonText, { color: colors.primary }]}>
                {chat.isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </Pressable>
          </View>
        ) : (
          // Normal input
          <View style={[styles.inputContainer, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 8) }]}>
            {/* Attach button → opens media picker */}
            <Pressable onPress={() => setShowMediaPicker(true)} style={styles.attachButton}>
              <MaterialIcons name="add-circle-outline" size={26} color={colors.primary} />
            </Pressable>

            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={t.typeMessage}
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSecondary }]}
              multiline
              maxLength={4000}
            />

            {inputText.trim() ? (
              <Pressable
                onPress={handleSend}
                style={({ pressed }) => [styles.sendButton, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
              >
                <MaterialIcons name="send" size={20} color="#fff" />
              </Pressable>
            ) : (
              <Pressable onPress={() => setIsRecordingMode(true)} style={styles.attachButton}>
                <MaterialIcons name="mic" size={26} color={colors.icon} />
              </Pressable>
            )}
          </View>
        )}

        <ReactionPicker
          visible={showReactionPicker}
          colors={colors}
          theme={theme}
          onSelect={handleReactionSelect}
          onClose={() => setShowReactionPicker(false)}
        />
      </KeyboardAvoidingView>

      {/* Telegram-like Media Picker */}
      <MediaPicker
        visible={showMediaPicker}
        colors={colors}
        onImage={(uri) => sendMedia(uri, 'photo', 'image')}
        onVideo={(uri) => sendMedia(uri, 'video', 'video')}
        onFile={handleFileSelected}
        onClose={() => setShowMediaPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerName: { fontSize: 16, fontWeight: '600', includeFontPadding: false },
  headerStatus: { fontSize: 13, marginTop: 2, includeFontPadding: false },
  headerButton: { padding: 8 },
  chatContainer: { flex: 1 },
  messagesList: { paddingHorizontal: 12, paddingVertical: 12 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  attachButton: { padding: 6, justifyContent: 'center', alignItems: 'center' },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 10,
  },
  channelInfoBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
  },
  channelInfoText: { fontSize: 13, includeFontPadding: false },
  muteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  muteButtonText: { fontSize: 14, fontWeight: '600', includeFontPadding: false },
  pinnedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  pinnedContent: { flex: 1 },
  pinnedLabel: { fontSize: 11, fontWeight: '700', marginBottom: 1, includeFontPadding: false },
  pinnedText: { fontSize: 13, includeFontPadding: false },
  unpinButton: { padding: 4 },
});
