// Openflou Chat Screen
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar, MessageBubble, VoiceRecorder, ReactionPicker } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { Message } from '@/types';
import { generateMessageId, encryptMessage } from '@/services/encryption';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { uploadMedia } from '@/services/mediaUpload';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, t, chats, currentUser, getMessagesForChat, sendMessage, updateMessage, theme, addReaction, removeReaction } = useOpenFlou();
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
  const flatListRef = useRef<FlatList>(null);

  const chat = chats.find((c) => c.id === id);
  const isAdmin = chat?.admins?.includes(currentUser?.id || '');
  const isCreator = chat?.creatorId === currentUser?.id;
  const canManage = isAdmin || isCreator;

  // Auto-refresh messages every 500ms for faster updates
  useEffect(() => {
    if (id) {
      loadMessages();
      const interval = setInterval(() => {
        loadMessages();
      }, 500); // Refresh every 500ms (2x faster)
      return () => clearInterval(interval);
    }
  }, [id]);

  // Load pinned message
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
    const loadedMessages = await getMessagesForChat(id);
    setMessages(loadedMessages);
  }

  async function handleSend() {
    if (!inputText.trim() || !currentUser || !id) return;

    // Check if banned
    if (chat?.bannedUsers?.includes(currentUser.id)) {
      showAlert('You are banned from this chat');
      return;
    }

    // Check channel permissions
    if (chat?.type === 'channel') {
      const isAdmin = chat.admins?.includes(currentUser.id);
      const isCreator = chat.creatorId === currentUser.id;
      if (!isAdmin && !isCreator) {
        showAlert('Only admins can send messages in this channel');
        return;
      }
    }

    const messageText = inputText.trim();
    setInputText(''); // Clear input immediately for better UX

    const newMessage: Message = {
      id: generateMessageId(),
      chatId: id,
      senderId: currentUser.id,
      content: messageText,
      encryptedContent: encryptMessage(messageText),
      type: 'text',
      timestamp: new Date(),
      isRead: false,
      isEdited: false,
    };

    // Optimistic update - show message immediately
    setMessages((prev) => [...prev, newMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    // Send to server in background
    const { error } = await sendMessage(newMessage);
    if (error) {
      showAlert(error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== newMessage.id));
    }
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && currentUser && id) {
      const localUri = result.assets[0].uri;

      // Optimistic preview
      const optimisticMsg: Message = {
        id: `opt_${Date.now()}`,
        chatId: id,
        senderId: currentUser.id,
        content: '',
        type: 'photo',
        mediaUrl: localUri,
        timestamp: new Date(),
        isRead: false,
        isEdited: false,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

      // Upload to storage
      const uploadedUrl = await uploadMedia(localUri, currentUser.id, 'image');
      if (!uploadedUrl) {
        showAlert('Failed to upload image');
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        return;
      }

      const newMessage: Message = {
        ...optimisticMsg,
        id: generateMessageId(),
        mediaUrl: uploadedUrl,
      };

      // Replace optimistic with real
      setMessages((prev) => prev.map((m) => m.id === optimisticMsg.id ? newMessage : m));

      const { error } = await sendMessage(newMessage);
      if (error) {
        showAlert(error);
        setMessages((prev) => prev.filter((m) => m.id !== newMessage.id));
      }
    }
  }

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && currentUser && id) {
      const file = result.assets[0];
      const newMessage: Message = {
        id: generateMessageId(),
        chatId: id,
        senderId: currentUser.id,
        content: '',
        type: 'file',
        mediaUrl: file.uri,
        fileName: file.name,
        fileSize: file.size,
        timestamp: new Date(),
        isRead: false,
        isEdited: false,
      };

      const { error } = await sendMessage(newMessage);
      if (error) {
        showAlert(error);
        return;
      }
      
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function handleVoiceSend(uri: string, duration: number) {
    if (!currentUser || !id) return;
    setIsRecordingMode(false);

    // Optimistic
    const optimisticMsg: Message = {
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
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    // Upload voice
    const uploadedUrl = await uploadMedia(uri, currentUser.id, 'voice');
    if (!uploadedUrl) {
      showAlert('Failed to upload voice message');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      return;
    }

    const newMessage: Message = {
      ...optimisticMsg,
      id: generateMessageId(),
      mediaUrl: uploadedUrl,
    };
    setMessages((prev) => prev.map((m) => m.id === optimisticMsg.id ? newMessage : m));

    const { error } = await sendMessage(newMessage);
    if (error) {
      showAlert(error);
      setMessages((prev) => prev.filter((m) => m.id !== newMessage.id));
    }
  }

  function handleMessageLongPress(message: Message) {
    if (message.type === 'text' && message.senderId === currentUser?.id) {
      // Show menu for own messages
      showAlert('Message Actions', '', [
        { 
          text: 'Edit', 
          onPress: () => {
            setEditingMessage(message);
            setEditText(message.content);
          }
        },
        canManage && {
          text: chat?.pinnedMessageId === message.id ? 'Unpin' : 'Pin Message',
          onPress: () => handlePinMessage(message),
        },
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean));
    } else {
      // Show menu for other messages
      if (canManage) {
        showAlert('Message Actions', '', [
          {
            text: chat?.pinnedMessageId === message.id ? 'Unpin' : 'Pin Message',
            onPress: () => handlePinMessage(message),
          },
          { 
            text: 'React', 
            onPress: () => {
              setSelectedMessage(message);
              setShowReactionPicker(true);
            }
          },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        setSelectedMessage(message);
        setShowReactionPicker(true);
      }
    }
  }

  async function handlePinMessage(message: Message) {
    if (!chat || !canManage) return;

    const updatedChat = {
      ...chat,
      pinnedMessageId: chat.pinnedMessageId === message.id ? undefined : message.id,
    };

    const { error } = await updateChat(updatedChat);
    if (error) {
      showAlert('Error', error);
    }
  }

  async function handleEditSubmit() {
    if (!editingMessage || !editText.trim() || !id) return;
    
    const updatedMessage: Message = {
      ...editingMessage,
      content: editText.trim(),
      isEdited: true,
    };
    
    const { error } = await updateMessage(updatedMessage);
    if (error) {
      showAlert(error);
      return;
    }
    
    await loadMessages();
    setEditingMessage(null);
    setEditText('');
  }

  async function handleEditCancel() {
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
    
    const userReacted = message.reactions?.some(
      (r) => r.emoji === emoji && r.userId === currentUser.id
    );

    if (userReacted) {
      await removeReaction(message.id, id, emoji);
    } else {
      await addReaction(message.id, id, emoji);
    }
    
    await loadMessages();
  }

  if (!chat) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Chat not found</Text>
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
        
        <Avatar uri={chat.avatar} username={chat.name} size={40} isOnline={true} colors={colors} />
        
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
            {chat.name}
          </Text>
          <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>{t.online}</Text>
        </View>

        <Pressable 
          onPress={() => {
            if (chat.type === 'group' || chat.type === 'channel') {
              router.push(`/chat-settings?id=${chat.id}`);
            }
          }}
          style={styles.headerButton}
        >
          <MaterialIcons name="info-outline" size={24} color={colors.icon} />
        </Pressable>
      </View>

      {/* Pinned Message */}
      {pinnedMessage && (
        <Pressable
          onPress={() => {
            const index = messages.findIndex((m) => m.id === pinnedMessage.id);
            if (index !== -1) {
              flatListRef.current?.scrollToIndex({ index, animated: true });
            }
          }}
          style={[styles.pinnedContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        >
          <MaterialIcons name="push-pin" size={20} color={colors.primary} />
          <View style={styles.pinnedContent}>
            <Text style={[styles.pinnedLabel, { color: colors.primary }]}>Pinned Message</Text>
            <Text style={[styles.pinnedText, { color: colors.text }]} numberOfLines={1}>
              {pinnedMessage.content || 'Media'}
            </Text>
          </View>
          {canManage && (
            <Pressable
              onPress={() => handlePinMessage(pinnedMessage)}
              style={styles.unpinButton}
            >
              <MaterialIcons name="close" size={20} color={colors.icon} />
            </Pressable>
          )}
        </Pressable>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onScrollToIndexFailed={() => {}}
        />

        {/* Input */}
        {editingMessage ? (
          <View style={[styles.inputContainer, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 8) }]}>
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
            <Pressable onPress={handleEditCancel} style={styles.attachButton}>
              <MaterialIcons name="close" size={24} color={colors.error} />
            </Pressable>
            <Pressable
              onPress={handleEditSubmit}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialIcons name="check" size={20} color={colors.textInverted} />
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
        ) : chat?.type === 'channel' && !isAdmin && !isCreator ? (
          // Channel non-admin: only show mute button
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
            <Pressable onPress={handlePickImage} style={styles.attachButton}>
              <MaterialIcons name="image" size={24} color={colors.icon} />
            </Pressable>
            
            <Pressable onPress={handlePickFile} style={styles.attachButton}>
              <MaterialIcons name="attach-file" size={24} color={colors.icon} />
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
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <MaterialIcons name="send" size={20} color={colors.textInverted} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setIsRecordingMode(true)}
                style={styles.attachButton}
              >
                <MaterialIcons name="mic" size={24} color={colors.icon} />
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
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  headerStatus: {
    fontSize: 13,
    marginTop: 2,
    includeFontPadding: false,
  },
  headerButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginHorizontal: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    borderRadius: 20,
  },
  channelInfoText: {
    fontSize: 13,
    includeFontPadding: false,
  },
  muteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  muteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    includeFontPadding: false,
  },
  pinnedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  pinnedContent: {
    flex: 1,
  },
  pinnedLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    includeFontPadding: false,
  },
  pinnedText: {
    fontSize: 14,
    includeFontPadding: false,
  },
  unpinButton: {
    padding: 4,
  },
});
