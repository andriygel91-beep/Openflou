// Openflou Chat List Item Component
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
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
    // For groups/channels show sender name, for DMs show 'You:' or nothing
    let prefix = '';
    if (isOutgoing) {
      prefix = `You: `;
    } else if (chat.type === 'group' || chat.type === 'channel') {
      // Don't add prefix — sender name resolved separately would need extra state
      prefix = '';
    }
    
    if (chat.lastMessage.type === 'photo') return `${prefix}📷 Photo`;
    if (chat.lastMessage.type === 'video') return `${prefix}🎥 Video`;
    if (chat.lastMessage.type === 'voice') return `${prefix}🎤 Voice`;
    if (chat.lastMessage.type === 'file') return `${prefix}📎 ${chat.lastMessage.fileName || 'File'}`;
    
    return `${prefix}${chat.lastMessage.content}`;
  };

  return (
    <Animated.View
      entering={FadeInRight.duration(300).springify()}
      exiting={FadeOutLeft.duration(200)}
      style={animatedStyle}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 });
        }}
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
    </Animated.View>
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
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    includeFontPadding: false,
    lineHeight: 22,
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
    fontSize: 15,
    flex: 1,
    includeFontPadding: false,
    lineHeight: 20,
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
