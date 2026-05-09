// Openflou Chat Screen
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import * as api from '@/services/api';

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
  const [userCache, setUserCache] = useState<Record<string, { name: string; avatar?: string }>>({});

  const flatListRef = useRef<FlatList>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  // Track if user has scrolled up (to avoid auto-scroll fighting the user)
  const isAtBottomRef = useRef(true);
  const messageCountRef = useRef(0);

  const chat = chats.find((c) => c.id === id);
  const isAdmin = chat?.admins?.includes(currentUser?.id || '');
  const isCreator = chat?.creatorId === currentUser?.id;
  const canManage = isAdmin || isCreator;
  const canPost =
    chat?.type !== 'channel' ||
    isAdmin ||
    isCreator;

  // Resolve user display info
  const resolveUser = useCallback(async (userId: string) => {
    if (!userId || userCache[userId]) return;
    if (userId === currentUser?.id) {
      setUserCache((prev) => ({
        ...prev,
        [userId]: { name: currentUser?.display_name || currentUser?.username || 'You', avatar: currentUser?.avatar },
      }));
      return;
    }
    const user = await api.getUserById(userId);
    if (user) {
      setUserCache((prev) => ({
        ...prev,
        [userId]: { name: (user as any).display_name || user.username, avatar: user.avatar },
      }));
    }
  }, [currentUser?.id, userCache]);

  // Auto-refresh messages with 1s polling
  useEffect(() => {
    if (!id) return;
    loadMessages(true); // initial — force scroll to bottom
    const interval = setInterval(() => loadMessages(false), 1000);
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

  // Resolve unknown senders
  useEffect(() => {
    const unresolved = messages
      .map((m) => m.senderId)
      .filter((sid) => sid && !userCache[sid]);
    const unique = [...new Set(unresolved)];
    unique.forEach(resolveUser);
  }, [messages.length]);

  async function loadMessages(forceScrollToBottom = false) {
    if (!id) return;
    try {
      const loaded = await getMessagesForChat(id);
      setMessages((prev) => {
        const serverIds = new Set(loaded.map((m) => m.id));
        for (const sid of serverIds) {
          pendingIdsRef.current.delete(sid);
        }
        const pendingOptimistic = prev.filter(
          (m) => m.id.startsWith('opt_') && !serverIds.has(m.id)
        );
        const merged = [...loaded, ...pendingOptimistic].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Auto-scroll only if user is at the bottom OR new messages arrived
        const newCount = merged.length;
        const hadNewMessages = newCount > messageCountRef.current;
        messageCountRef.current = newCount;

        if ((isAtBottomRef.current && hadNewMessages) || forceScrollToBottom) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: !forceScrollToBottom }), 50);
        }

        return merged;
      });
    } catch (e) {
      // ignore polling errors silently
    }
  }

  function handleScroll(event: any) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    // Consider "at bottom" if within 80px of the end
    isAtBottomRef.current = distanceFromBottom < 80;
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
    isAtBottomRef.current = true;

    const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    pendingIdsRef.current.add(optimisticId);

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

    setMessages((prev) => {
      const updated = [...prev, msg];
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return updated;
    });

    const { error } = await sendMessage(msg);
    if (error) {
      showAlert(error);
      pendingIdsRef.current.delete(optimisticId);
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
    isAtBottomRef.current = true;

    const optimisticId = `opt_${Date.now()}`;
    pendingIdsRef.current.add(optimisticId);

    const optimistic: Message = {
      id: optimisticId,
      chatId: id,
      senderId: currentUser.id,
      content: '',
      type,
      mediaUrl: uri,
      timestamp: new Date(),
      isRead: false,
      isEdited: false,
    };

    setMessages((prev) => {
      const updated = [...prev, optimistic];
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return updated;
    });

    const uploadedUrl = await uploadMedia(uri, currentUser.id, uploadType);
    setUploadingMedia(false);

    if (!uploadedUrl) {
      showAlert(`Failed to upload ${type}`);
      pendingIdsRef.current.delete(optimisticId);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      return;
    }

    const real: Message = { ...optimistic, id: generateMessageId(), mediaUrl: uploadedUrl };
    pendingIdsRef.current.delete(optimisticId);
    pendingIdsRef.current.add(real.id);
    setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));

    const { error } = await sendMessage(real);
    if (error) {
      showAlert(error);
      pendingIdsRef.current.delete(real.id);
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
    isAtBottomRef.current = true;
    setMessages((prev) => {
      const updated = [...prev, msg];
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      return updated;
    });
  }

  // ── Voice ──
  async function handleVoiceSend(uri: string, duration: number) {
    if (!currentUser || !id) return;
    setIsRecordingMode(false);
    isAtBottomRef.current = true;

    const optimisticId = `opt_voice_${Date.now()}`;
    pendingIdsRef.current.add(optimisticId);

    const optimistic: Message = {
      id: optimisticId,
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
    setMessages((prev) => {
      const updated = [...prev, optimistic];
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
      return updated;
    });

    const uploadedUrl = await uploadMedia(uri, currentUser.id, 'voice');
    if (!uploadedUrl) {
      showAlert('Failed to upload voice message');
      pendingIdsRef.current.delete(optimisticId);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      return;
    }

    const real: Message = { ...optimistic, id: generateMessageId(), mediaUrl: uploadedUrl };
    pendingIdsRef.current.delete(optimisticId);
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
    await loadMessages(false);
    setEditingMessage(null);
    setEditText('');
  }

  async function handleReactionSelect(emoji: string) {
    if (!selectedMessage || !id) return;
    await addReaction(selectedMessage.id, id, emoji);
    await loadMessages(false);
  }

  async function handleReactionPress(message: Message, emoji: string) {
    if (!currentUser || !id) return;
    const reacted = message.reactions?.some((r) => r.emoji === emoji && r.userId === currentUser.id);
    if (reacted) {
      await removeReaction(message.id, id, emoji);
    } else {
      await addReaction(message.id, id, emoji);
    }
    await loadMessages(false);
  }

  function getSenderName(senderId: string): string {
    if (senderId === currentUser?.id) return '';
    const cached = userCache[senderId];
    return cached?.name || '';
  }

  // Start a voice call with the other user (DMs only)
  function handleStartCall(callType: 'voice' | 'video') {
    if (!chat || !currentUser) return;
    if (chat.type !== 'direct' && chat.type !== 'private') {
      showAlert('Calls are only available in direct messages');
      return;
    }
    const otherUserId = chat.participants.find((p) => p !== currentUser.id);
    if (!otherUserId) return;
    router.push(`/call?chatId=${chat.id}&calleeId=${otherUserId}&type=${callType}&role=caller`);
  }

  if (!chat) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, padding: 24 }}>Chat not found</Text>
      </SafeAreaView>
    );
  }

  const isGroup = chat.type === 'group' || chat.type === 'channel';
  const isDirect = chat.type === 'direct' || chat.type === 'private';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.chatBackground }]} edges={['top']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Avatar uri={chat.avatar} username={chat.name} size={40} colors={colors} />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{chat.name}</Text>
          <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>
            {uploadingMedia ? 'Uploading...' : isGroup ? `${chat.participants.length} members` : t.online}
          </Text>
        </View>
        {/* Call buttons — only for DMs */}
        {isDirect ? (
          <>
            <Pressable onPress={() => handleStartCall('voice')} style={styles.headerBtn}>
              <MaterialIcons name="call" size={22} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => handleStartCall('video')} style={styles.headerBtn}>
              <MaterialIcons name="videocam" size={22} color={colors.primary} />
            </Pressable>
          </>
        ) : null}
        <Pressable
          onPress={() => router.push(`/chat-settings?id=${chat.id}`)}
          style={styles.headerBtn}
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
            <Pressable onPress={() => handlePinMessage(pinnedMessage)} style={styles.unpinBtn}>
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
              senderName={isGroup ? getSenderName(item.senderId) : undefined}
              colors={colors}
              onLongPress={() => handleMessageLongPress(item)}
              onReactionPress={(emoji) => handleReactionPress(item, emoji)}
            />
          )}
          contentContainerStyle={styles.messagesList}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onScrollToIndexFailed={() => {}}
          removeClippedSubviews
          maxToRenderPerBatch={20}
          windowSize={10}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
          <View style={[styles.inputContainer, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 8) }]}>
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
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 8 },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerName: { fontSize: 16, fontWeight: '600', includeFontPadding: false },
  headerStatus: { fontSize: 13, marginTop: 2, includeFontPadding: false },
  chatContainer: { flex: 1 },
  messagesList: { paddingHorizontal: 8, paddingVertical: 12 },
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
  unpinBtn: { padding: 4 },
});
