// Openflou Media Picker - Telegram-like bottom sheet with gallery grid
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, FlatList,
  Dimensions, Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_W - 4) / 3;

interface MediaPickerProps {
  visible: boolean;
  colors: any;
  onImage: (uri: string) => void;
  onVideo: (uri: string) => void;
  onFile: (uri: string, name: string, size: number) => void;
  onClose: () => void;
}

interface GalleryAsset {
  id: string;
  uri: string;
  mediaType: 'photo' | 'video';
  duration?: number;
}

export function MediaPicker({ visible, colors, onImage, onVideo, onFile, onClose }: MediaPickerProps) {
  const insets = useSafeAreaInsets();
  const [galleryAssets, setGalleryAssets] = useState<GalleryAsset[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const translateY = useSharedValue(500);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      overlayOpacity.value = withTiming(1, { duration: 200 });
      loadGallery();
    } else {
      translateY.value = withTiming(500, { duration: 250 });
      overlayOpacity.value = withTiming(0, { duration: 200 });
      setSelectedId(null);
    }
  }, [visible]);

  const loadGallery = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setHasPermission(status === 'granted');

    if (status === 'granted') {
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo', 'video'],
        first: 60,
        sortBy: MediaLibrary.SortBy.creationTime,
      });

      setGalleryAssets(
        assets.map((a) => ({
          id: a.id,
          uri: a.uri,
          mediaType: a.mediaType as 'photo' | 'video',
          duration: a.duration,
        }))
      );
    }
  }, []);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  function handleSelectAsset(asset: GalleryAsset) {
    setSelectedId(asset.id);

    if (asset.mediaType === 'video') {
      onVideo(asset.uri);
    } else {
      onImage(asset.uri);
    }
    onClose();
  }

  async function handleCamera() {
    onClose();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      videoMaxDuration: 120,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.type === 'video') {
        onVideo(asset.uri);
      } else {
        onImage(asset.uri);
      }
    }
  }

  async function handleFile() {
    onClose();
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const file = result.assets[0];
      onFile(file.uri, file.name, file.size || 0);
    }
  }

  const renderAsset = ({ item }: { item: GalleryAsset }) => {
    const isSelected = selectedId === item.id;
    return (
      <Pressable
        onPress={() => handleSelectAsset(item)}
        style={[styles.thumb, { width: THUMB_SIZE, height: THUMB_SIZE }]}
      >
        <Image
          source={{ uri: item.uri }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          contentFit="cover"
          transition={100}
        />
        {item.mediaType === 'video' ? (
          <View style={styles.videoOverlay}>
            <MaterialIcons name="play-arrow" size={24} color="#fff" />
            {item.duration ? (
              <Text style={styles.videoDuration}>
                {Math.floor(item.duration / 60)}:{Math.round(item.duration % 60).toString().padStart(2, '0')}
              </Text>
            ) : null}
          </View>
        ) : null}
        {isSelected ? (
          <View style={[styles.selectedOverlay, { borderColor: colors.primary }]}>
            <View style={[styles.selectedCheck, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="check" size={16} color="#fff" />
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Overlay */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.background, paddingBottom: insets.bottom + 8 },
          sheetStyle,
        ]}
      >
        {/* Handle */}
        <View style={styles.handleBar}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Quick Actions */}
        <View style={[styles.actions, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={handleCamera}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="photo-camera" size={26} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Camera</Text>
          </Pressable>

          <Pressable
            onPress={handleFile}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="insert-drive-file" size={26} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>File</Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              onClose();
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.85,
              });
              if (!result.canceled && result.assets[0]) {
                onImage(result.assets[0].uri);
              }
            }}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="photo-library" size={26} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Gallery</Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              onClose();
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                quality: 1,
              });
              if (!result.canceled && result.assets[0]) {
                onVideo(result.assets[0].uri);
              }
            }}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="videocam" size={26} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.text }]}>Video</Text>
          </Pressable>
        </View>

        {/* Gallery Grid */}
        {!hasPermission ? (
          <View style={styles.permissionContainer}>
            <MaterialIcons name="lock" size={40} color={colors.textSecondary} />
            <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
              Allow gallery access to share photos & videos
            </Text>
            <Pressable
              onPress={loadGallery}
              style={[styles.grantBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.grantBtnText, { color: '#fff' }]}>Grant Access</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={galleryAssets}
            keyExtractor={(item) => item.id}
            renderItem={renderAsset}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            style={styles.grid}
            contentContainerStyle={{ gap: 2 }}
            columnWrapperStyle={{ gap: 2 }}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    overflow: 'hidden',
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    includeFontPadding: false,
  },
  grid: {
    flex: 1,
  },
  thumb: {
    overflow: 'hidden',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  videoDuration: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: 2,
  },
  selectedCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
    paddingHorizontal: 32,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    includeFontPadding: false,
  },
  grantBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  grantBtnText: {
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
