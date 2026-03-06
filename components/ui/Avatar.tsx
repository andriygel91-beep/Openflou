// Openflou Avatar Component
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';

interface AvatarProps {
  uri?: string;
  username?: string;
  size?: number;
  isOnline?: boolean;
  colors: any;
}

export function Avatar({ uri, username, size = 48, isOnline, colors }: AvatarProps) {
  const initials = username
    ? username
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const avatarColors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E2',
  ];
  const colorIndex = username ? username.charCodeAt(0) % avatarColors.length : 0;
  const bgColor = avatarColors[colorIndex];

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ position: 'relative' }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.avatarPlaceholder,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
          ]}
        >
          <Text style={[styles.initialsText, { fontSize: size * 0.4 }]}>{initials}</Text>
        </View>
      )}
      {isOnline && (
        <Animated.View
          entering={ZoomIn.duration(200).springify()}
          style={[
            styles.onlineIndicator,
            {
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
              bottom: 0,
              right: 0,
              borderColor: colors.background,
              backgroundColor: colors.online,
            },
          ]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  avatar: {},
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '600',
    includeFontPadding: false,
  },
  onlineIndicator: {
    position: 'absolute',
    borderWidth: 2,
  },
});
