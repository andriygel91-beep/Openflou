// Openflou Message Bubble Component
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, ZoomIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Message, Reaction } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { VoicePlayer } from './VoicePlayer';

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  colors: any;
  onLongPress?: () => void;
  onReactionPress?: (emoji: string) => void;
}

export function MessageBubble({ message, isOutgoing, colors, onLongPress, onReactionPress }: MessageBubbleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const formatTime = (date: Date) => {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const groupReactions = (reactions: Reaction[] = []) => {
    const grouped = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = [];
      }
      acc[reaction.emoji].push(reaction.userId);
      return acc;
    }, {} as Record<string, string[]>);
    return grouped;
  };

  const renderContent = () => {
    if (message.type === 'voice' && message.mediaUrl && message.duration) {
      return (
        <VoicePlayer
          uri={message.mediaUrl}
          duration={message.duration}
          colors={colors}
          isOutgoing={isOutgoing}
        />
      );
    }

    if (message.type === 'photo' && message.mediaUrl) {
      return (
        <View>
          <Image
            source={{ uri: message.mediaUrl }}
            style={styles.mediaImage}
            contentFit="cover"
            transition={200}
          />
          {message.content && <Text style={[styles.messageText, { color: isOutgoing ? colors.text : colors.text }]}>{message.content}</Text>}
        </View>
      );
    }

    if (message.type === 'video' && message.mediaUrl) {
      return (
        <View style={styles.mediaPlaceholder}>
          <MaterialIcons name="play-circle-outline" size={48} color={isOutgoing ? colors.text : colors.text} />
          {message.fileName && <Text style={[styles.fileName, { color: isOutgoing ? colors.text : colors.text }]}>{message.fileName}</Text>}
        </View>
      );
    }

    if (message.type === 'file') {
      return (
        <View style={styles.fileBubble}>
          <MaterialIcons name="insert-drive-file" size={32} color={isOutgoing ? colors.primary : colors.icon} />
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, { color: isOutgoing ? colors.text : colors.text }]} numberOfLines={1}>
              {message.fileName || 'File'}
            </Text>
            {message.fileSize && (
              <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                {(message.fileSize / 1024).toFixed(1)} KB
              </Text>
            )}
          </View>
        </View>
      );
    }

    return <Text style={[styles.messageText, { color: isOutgoing ? colors.text : colors.text }]}>{message.content}</Text>;
  };

  const reactions = groupReactions(message.reactions);
  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <Animated.View
      entering={FadeInUp.duration(300).springify()}
      exiting={FadeOutDown.duration(200)}
      style={[{ alignSelf: isOutgoing ? 'flex-end' : 'flex-start' }, animatedStyle]}
    >
      <Pressable
        onLongPress={onLongPress}
        onPressIn={() => {
          scale.value = withSpring(0.95, { damping: 15 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 });
        }}
        style={[
          styles.bubble,
          {
            alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
            backgroundColor: isOutgoing ? colors.bubbleOut : colors.bubbleIn,
            borderTopLeftRadius: isOutgoing ? 16 : 4,
            borderTopRightRadius: isOutgoing ? 4 : 16,
          },
        ]}
      >
        {renderContent()}
        <View style={styles.timeContainer}>
          {message.isEdited && <Text style={[styles.editedText, { color: colors.messageTime }]}>edited </Text>}
          <Text style={[styles.timeText, { color: colors.messageTime }]}>{formatTime(message.timestamp)}</Text>
          {isOutgoing && (
            <MaterialIcons
              name={message.isRead ? 'done-all' : 'done'}
              size={14}
              color={message.isRead ? colors.primary : colors.messageTime}
              style={styles.readIcon}
            />
          )}
        </View>
      </Pressable>
      
      {hasReactions && (
        <Animated.View
          entering={ZoomIn.duration(200).springify()}
          style={[styles.reactionsContainer, { alignSelf: isOutgoing ? 'flex-end' : 'flex-start' }]}
        >
          {Object.entries(reactions).map(([emoji, userIds]) => (
            <Pressable
              key={emoji}
              onPress={() => onReactionPress?.(emoji)}
              style={[styles.reactionBubble, { backgroundColor: colors.surfaceSecondary }]}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>{
                userIds.length
              }</Text>
            </Pressable>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeText: {
    fontSize: 11,
    includeFontPadding: false,
  },
  editedText: {
    fontSize: 11,
    fontStyle: 'italic',
    includeFontPadding: false,
  },
  readIcon: {
    marginLeft: 2,
  },
  mediaImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
    marginBottom: 4,
  },
  mediaPlaceholder: {
    width: 220,
    height: 180,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    includeFontPadding: false,
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
    includeFontPadding: false,
  },
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 4,
    gap: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
