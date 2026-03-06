// Openflou Chat List Item Component
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Chat } from '@/types';
import { Avatar } from './Avatar';
import { MaterialIcons } from '@expo/vector-icons';

interface ChatListItemProps {
  chat: Chat;
  colors: any;
  t: any;
  currentUserId: string;
  onPress: () => void;
}

export function ChatListItem({ chat, colors, t, currentUserId, onPress }: ChatListItemProps) {
  const formatTime = (date?: Date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return t.yesterday;
    }
    
    return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const getLastMessagePreview = () => {
    if (!chat.lastMessage) return '';
    
    const isOutgoing = chat.lastMessage.senderId === currentUserId;
    const prefix = isOutgoing ? `${t.you}: ` : '';
    
    if (chat.lastMessage.type === 'photo') return `${prefix}${t.photo}`;
    if (chat.lastMessage.type === 'video') return `${prefix}${t.video}`;
    if (chat.lastMessage.type === 'file') return `${prefix}${t.file}`;
    
    return `${prefix}${chat.lastMessage.content}`;
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
        },
      ]}
    >
      <Avatar
        uri={chat.avatar}
        username={chat.name || chat.id}
        size={56}
        isOnline={chat.type === 'private'}
        colors={colors}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {chat.name || 'Unknown Chat'}
          </Text>
          {chat.lastMessage && (
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {formatTime(chat.lastMessage.timestamp)}
            </Text>
          )}
        </View>
        
        <View style={styles.footer}>
          <Text
            style={[
              styles.message,
              {
                color: chat.unreadCount > 0 ? colors.text : colors.textSecondary,
                fontWeight: chat.unreadCount > 0 ? '500' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {getLastMessagePreview()}
          </Text>
          
          <View style={styles.badges}>
            {chat.isMuted && (
              <MaterialIcons name="volume-off" size={16} color={colors.textTertiary} style={styles.badge} />
            )}
            {chat.isPinned && (
              <MaterialIcons name="push-pin" size={16} color={colors.textTertiary} style={styles.badge} />
            )}
            {chat.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.unreadBadge }]}>
                <Text style={[styles.unreadText, { color: colors.textInverted }]}>
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    includeFontPadding: false,
  },
  time: {
    fontSize: 13,
    marginLeft: 8,
    includeFontPadding: false,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    flex: 1,
    includeFontPadding: false,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    marginLeft: 4,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
