// Openflou Chat List Item — redesigned with real online status + last-seen
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Chat } from '@/types';
import { Avatar } from './Avatar';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

interface ChatListItemProps {
  chat: Chat;
  colors: any;
  t: any;
  currentUserId: string;
  onPress: () => void;
}

export function ChatListItem({ chat, colors, t, currentUserId, onPress }: ChatListItemProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // For private chats, load the other user's last_seen
  const [otherLastSeen, setOtherLastSeen] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (chat.type !== 'private') return;
    const otherId = chat.participants.find((p) => p !== currentUserId);
    if (!otherId) return;

    let cancelled = false;
    supabase
      .from('openflou_users')
      .select('last_seen, is_online')
      .eq('id', otherId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setOtherLastSeen(data.last_seen);
      });

    // Refresh every 30s
    const interval = setInterval(() => {
      supabase
        .from('openflou_users')
        .select('last_seen, is_online')
        .eq('id', otherId)
        .single()
        .then(({ data }) => {
          if (!cancelled && data) setOtherLastSeen(data.last_seen);
        });
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chat.id, currentUserId]);

  function formatLastSeen(iso?: string): string {
    if (!iso) return '';
    const ts = new Date(iso).getTime();
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'online';
    if (diffMin < 3) return 'online';
    if (diffMin < 60) return `last seen ${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `last seen ${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'last seen yesterday';
    if (diffD < 7) return `last seen ${diffD}d ago`;
    return `last seen ${new Date(iso).toLocaleDateString()}`;
  }

  function isOnline(iso?: string): boolean {
    if (!iso) return false;
    return Date.now() - new Date(iso).getTime() < 3 * 60 * 1000;
  }

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
    if (d.toDateString() === yesterday.toDateString()) return t.yesterday || 'Yesterday';
    return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const getLastMessagePreview = () => {
    if (!chat.lastMessage) return '';
    const isOutgoing = chat.lastMessage.senderId === currentUserId;
    const prefix = isOutgoing ? 'You: ' : '';
    if (chat.lastMessage.type === 'photo') return `${prefix}📷 Photo`;
    if (chat.lastMessage.type === 'video') return `${prefix}🎥 Video`;
    if (chat.lastMessage.type === 'voice') return `${prefix}🎤 Voice message`;
    if (chat.lastMessage.type === 'file') return `${prefix}📎 ${chat.lastMessage.fileName || 'File'}`;
    return `${prefix}${chat.lastMessage.content}`;
  };

  // Type badge
  const typeBadge =
    chat.type === 'channel'
      ? { icon: 'campaign' as const, label: 'Channel' }
      : chat.type === 'group'
      ? { icon: 'group' as const, label: 'Group' }
      : chat.type === 'saved'
      ? { icon: 'bookmark' as const, label: '' }
      : null;

  const statusLine =
    chat.type === 'private'
      ? formatLastSeen(otherLastSeen)
      : chat.type === 'group' || chat.type === 'channel'
      ? `${chat.participants.length} members`
      : '';

  return (
    <Animated.View
      entering={FadeInRight.duration(280).springify()}
      exiting={FadeOutLeft.duration(180)}
      style={animatedStyle}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={({ pressed }) => [
          styles.container,
          { backgroundColor: pressed ? colors.surfaceSecondary : colors.surface },
        ]}
      >
        {/* Avatar with real online dot */}
        <Avatar
          uri={chat.avatar}
          username={chat.name || chat.id}
          size={54}
          lastSeen={chat.type === 'private' ? otherLastSeen : undefined}
          colors={colors}
        />

        <View style={styles.content}>
          {/* Top row: name + time */}
          <View style={styles.topRow}>
            <View style={styles.nameRow}>
              {typeBadge ? (
                <MaterialIcons
                  name={typeBadge.icon}
                  size={15}
                  color={colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
              ) : null}
              <Text
                style={[styles.name, { color: colors.text }]}
                numberOfLines={1}
              >
                {chat.name || 'Unknown'}
              </Text>
            </View>
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {formatTime(chat.lastMessage?.timestamp)}
            </Text>
          </View>

          {/* Bottom row: preview + badges */}
          <View style={styles.bottomRow}>
            <View style={styles.previewCol}>
              <Text
                style={[
                  styles.preview,
                  {
                    color: chat.unreadCount > 0 ? colors.text : colors.textSecondary,
                    fontWeight: chat.unreadCount > 0 ? '500' : '400',
                  },
                ]}
                numberOfLines={1}
              >
                {getLastMessagePreview() || statusLine}
              </Text>
              {/* Status line (last seen / members) when there IS a preview */}
              {getLastMessagePreview() && statusLine && chat.type === 'private' ? (
                <Text
                  style={[
                    styles.statusLine,
                    {
                      color: isOnline(otherLastSeen) ? colors.online : colors.textTertiary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {statusLine}
                </Text>
              ) : null}
            </View>

            <View style={styles.badges}>
              {chat.isMuted ? (
                <MaterialIcons name="volume-off" size={15} color={colors.textTertiary} style={styles.badgeIcon} />
              ) : null}
              {chat.isPinned ? (
                <MaterialIcons name="push-pin" size={15} color={colors.textTertiary} style={styles.badgeIcon} />
              ) : null}
              {chat.unreadCount > 0 ? (
                <View style={[styles.unreadBadge, { backgroundColor: chat.isMuted ? colors.textTertiary : colors.unreadBadge }]}>
                  <Text style={[styles.unreadText, { color: colors.textInverted }]}>
                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                  </Text>
                </View>
              ) : null}
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
    paddingVertical: 10,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
    flex: 1,
  },
  time: {
    fontSize: 12,
    includeFontPadding: false,
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCol: {
    flex: 1,
    marginRight: 8,
  },
  preview: {
    fontSize: 14,
    includeFontPadding: false,
    lineHeight: 19,
  },
  statusLine: {
    fontSize: 12,
    includeFontPadding: false,
    marginTop: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  badgeIcon: {
    marginLeft: 4,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginLeft: 4,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
