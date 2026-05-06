// Openflou Message Bubble Component
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Dimensions } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, ZoomIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Message, Reaction } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { VoicePlayer } from './VoicePlayer';

const { width: SCREEN_W } = Dimensions.get('window');
const BUBBLE_MAX_W = Math.min(SCREEN_W * 0.72, 300);

interface MessageBubbleProps {
  message: Message;
  isOutgoing: boolean;
  colors: any;
  onLongPress?: () => void;
  onReactionPress?: (emoji: string) => void;
}

// Full-screen photo viewer
function PhotoViewer({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.photoViewerOverlay} onPress={onClose}>
        <Image
          source={{ uri }}
          style={styles.photoViewerImage}
          contentFit="contain"
          transition={200}
        />
        <Pressable style={styles.photoViewerClose} onPress={onClose}>
          <MaterialIcons name="close" size={28} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Video player inside bubble
function VideoBubble({ uri, colors }: { uri: string; colors: any }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <View style={styles.videoBubble}>
      <VideoView
        player={player}
        style={styles.videoPlayer}
        contentFit="cover"
        allowsFullscreen
        allowsPictureInPicture={false}
      />
    </View>
  );
}

export function MessageBubble({ message, isOutgoing, colors, onLongPress, onReactionPress }: MessageBubbleProps) {
  const scale = useSharedValue(1);
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const groupReactions = (reactions: Reaction[] = []) => {
    return reactions.reduce((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = [];
      acc[r.emoji].push(r.userId);
      return acc;
    }, {} as Record<string, string[]>);
  };

  const isMediaOnly =
    (message.type === 'photo' || message.type === 'video') && !message.content;

  const renderContent = () => {
    // Voice message
    if (message.type === 'voice') {
      if (!message.mediaUrl) {
        return (
          <View style={styles.loadingMedia}>
            <MaterialIcons name="mic" size={20} color={colors.textSecondary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading audio...</Text>
          </View>
        );
      }
      return (
        <VoicePlayer
          uri={message.mediaUrl}
          duration={message.duration || 1}
          colors={colors}
          isOutgoing={isOutgoing}
        />
      );
    }

    // Photo message
    if (message.type === 'photo') {
      if (!message.mediaUrl) {
        return (
          <View style={[styles.mediaPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
            <MaterialIcons name="image" size={40} color={colors.textSecondary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Uploading...</Text>
          </View>
        );
      }
      return (
        <>
          <Pressable onPress={() => setPhotoViewerVisible(true)}>
            <Image
              source={{ uri: message.mediaUrl }}
              style={styles.mediaImage}
              contentFit="cover"
              transition={300}
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            />
          </Pressable>
          {message.content ? (
            <Text style={[styles.messageText, { color: colors.text }]}>{message.content}</Text>
          ) : null}
          <PhotoViewer
            uri={message.mediaUrl}
            visible={photoViewerVisible}
            onClose={() => setPhotoViewerVisible(false)}
          />
        </>
      );
    }

    // Video message
    if (message.type === 'video') {
      if (!message.mediaUrl) {
        return (
          <View style={[styles.mediaPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
            <MaterialIcons name="videocam" size={40} color={colors.textSecondary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Uploading...</Text>
          </View>
        );
      }
      return (
        <>
          <VideoBubble uri={message.mediaUrl} colors={colors} />
          {message.content ? (
            <Text style={[styles.messageText, { color: colors.text }]}>{message.content}</Text>
          ) : null}
        </>
      );
    }

    // File message
    if (message.type === 'file') {
      return (
        <View style={styles.fileBubble}>
          <View style={[styles.fileIcon, { backgroundColor: isOutgoing ? colors.primary + '33' : colors.surfaceSecondary }]}>
            <MaterialIcons name="insert-drive-file" size={28} color={colors.primary} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>
              {message.fileName || 'File'}
            </Text>
            {message.fileSize ? (
              <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                {message.fileSize > 1048576
                  ? `${(message.fileSize / 1048576).toFixed(1)} MB`
                  : `${(message.fileSize / 1024).toFixed(1)} KB`}
              </Text>
            ) : null}
          </View>
          <MaterialIcons name="download" size={22} color={colors.primary} />
        </View>
      );
    }

    // Text message
    return (
      <Text style={[styles.messageText, { color: colors.text }]}>
        {message.content}
      </Text>
    );
  };

  const reactions = groupReactions(message.reactions);
  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <Animated.View
      entering={FadeInUp.duration(250).springify()}
      exiting={FadeOutDown.duration(200)}
      style={[{ alignSelf: isOutgoing ? 'flex-end' : 'flex-start', marginBottom: hasReactions ? 0 : 8 }, animatedStyle]}
    >
      <Pressable
        onLongPress={onLongPress}
        onPressIn={() => scale.value = withSpring(0.96, { damping: 15 })}
        onPressOut={() => scale.value = withSpring(1, { damping: 15 })}
        style={[
          styles.bubble,
          isMediaOnly && styles.mediaBubble,
          {
            alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
            backgroundColor: isOutgoing ? colors.bubbleOut : colors.bubbleIn,
            borderTopLeftRadius: isOutgoing ? 18 : 4,
            borderTopRightRadius: isOutgoing ? 4 : 18,
          },
        ]}
      >
        {renderContent()}
        <View style={[styles.timeContainer, { justifyContent: isOutgoing ? 'flex-end' : 'flex-start' }]}>
          {message.isEdited ? (
            <Text style={[styles.editedText, { color: colors.messageTime }]}>edited </Text>
          ) : null}
          <Text style={[styles.timeText, { color: colors.messageTime }]}>{formatTime(message.timestamp)}</Text>
          {isOutgoing ? (
            <MaterialIcons
              name={message.isRead ? 'done-all' : 'done'}
              size={14}
              color={message.isRead ? colors.primary : colors.messageTime}
              style={styles.readIcon}
            />
          ) : null}
        </View>
      </Pressable>

      {hasReactions ? (
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
              <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>{userIds.length}</Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: BUBBLE_MAX_W,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginBottom: 2,
  },
  mediaBubble: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    paddingBottom: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    includeFontPadding: false,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
  // Photo
  mediaImage: {
    width: BUBBLE_MAX_W - 8,
    height: BUBBLE_MAX_W - 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  mediaPlaceholder: {
    width: BUBBLE_MAX_W - 8,
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 160,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 13,
    includeFontPadding: false,
  },
  // Video
  videoBubble: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  videoPlayer: {
    width: BUBBLE_MAX_W - 8,
    height: 200,
  },
  // File
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    paddingVertical: 4,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
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
  // Reactions
  reactionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 8,
    gap: 4,
    flexWrap: 'wrap',
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: {
    fontSize: 11,
    fontWeight: '600',
    includeFontPadding: false,
  },
  // Photo viewer
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoViewerImage: {
    width: '100%',
    height: '80%',
  },
  photoViewerClose: {
    position: 'absolute',
    top: 48,
    right: 16,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
});
