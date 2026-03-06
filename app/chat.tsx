// Openflou Chat Screen
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { Avatar, MessageBubble, VoiceRecorder, ReactionPicker } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { Message } from '@/types';
import { generateMessageId, encryptMessage } from '@/services/encryption';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, t, chats, currentUser, getMessagesForChat, sendMessage, theme, addReaction, removeReaction } = useOpenFlou();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const chat = chats.find((c) => c.id === id);

  useEffect(() => {
    if (id) {
      loadMessages();
    }
  }, [id]);

  async function loadMessages() {
    if (!id) return;
    const loadedMessages = await getMessagesForChat(id);
    setMessages(loadedMessages);
  }

  async function handleSend() {
    if (!inputText.trim() || !currentUser || !id) return;

    const newMessage: Message = {
      id: generateMessageId(),
      chatId: id,
      senderId: currentUser.id,
      content: inputText.trim(),
      encryptedContent: encryptMessage(inputText.trim()),
      type: 'text',
      timestamp: new Date(),
      isRead: false,
      isEdited: false,
    };

    await sendMessage(newMessage);
    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && currentUser && id) {
      const newMessage: Message = {
        id: generateMessageId(),
        chatId: id,
        senderId: currentUser.id,
        content: '',
        type: 'photo',
        mediaUrl: result.assets[0].uri,
        timestamp: new Date(),
        isRead: false,
        isEdited: false,
      };

      await sendMessage(newMessage);
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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

      await sendMessage(newMessage);
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function handleVoiceSend(uri: string, duration: number) {
    if (!currentUser || !id) return;

    const newMessage: Message = {
      id: generateMessageId(),
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

    await sendMessage(newMessage);
    setMessages((prev) => [...prev, newMessage]);
    setIsRecordingMode(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function handleMessageLongPress(message: Message) {
    setSelectedMessage(message);
    setShowReactionPicker(true);
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

        <Pressable style={styles.headerButton}>
          <MaterialIcons name="more-vert" size={24} color={colors.icon} />
        </Pressable>
      </View>

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
        />

        {/* Input */}
        {isRecordingMode ? (
          <View style={[styles.inputContainer, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 8) }]}>
            <VoiceRecorder
              colors={colors}
              t={t}
              onSend={handleVoiceSend}
              onCancel={() => setIsRecordingMode(false)}
            />
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
});
