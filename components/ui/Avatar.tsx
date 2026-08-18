// Openflou Avatar Component — with real online indicator
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';

interface AvatarProps {
  uri?: string;
  username?: string;
  size?: number;
  /** Pass actual last_seen ISO string for smart online detection */
  lastSeen?: string | Date;
  /** Explicit override — set to true only when you know the user is online */
  isOnline?: boolean;
  colors: any;
}

/** Returns true if last_seen was within the past 3 minutes */
function isRecentlyActive(lastSeen?: string | Date): boolean {
  if (!lastSeen) return false;
  const ts = typeof lastSeen === 'string' ? new Date(lastSeen).getTime() : lastSeen.getTime();
  return Date.now() - ts < 3 * 60 * 1000;
}

export function Avatar({ uri, username, size = 48, isOnline, lastSeen, colors }: AvatarProps) {
  const initials = username
    ? username
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const avatarColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F08080', '#90EE90', '#87CEEB', '#DDA0DD',
  ];
  const colorIndex = username ? username.charCodeAt(0) % avatarColors.length : 0;
  const bgColor = avatarColors[colorIndex];

  // Smart online: use lastSeen if available, fallback to explicit isOnline prop
  const showOnline = lastSeen ? isRecentlyActive(lastSeen) : (isOnline === true);

  const dotSize = Math.max(10, size * 0.28);
  const dotBorder = Math.max(2, size * 0.05);

  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ position: 'relative' }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
          ]}
        >
          <Text style={[styles.initials, { fontSize: Math.max(10, size * 0.38) }]}>{initials}</Text>
        </View>
      )}

      {showOnline ? (
        <Animated.View
          entering={ZoomIn.duration(200).springify()}
          style={[
            styles.onlineDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              borderWidth: dotBorder,
              borderColor: colors.background,
              backgroundColor: colors.online,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
    includeFontPadding: false,
  },
  onlineDot: {
    position: 'absolute',
  },
});
