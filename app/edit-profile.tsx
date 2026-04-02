// Openflou Edit Profile Screen - with server-side update
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import * as api from '@/services/api';
import * as storage from '@/services/storage';
import { getSupabaseClient } from '@/template';
import { StatusBar } from 'expo-status-bar';

async function uploadAvatar(uri: string, userId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const ext = uri.split('.').pop() || 'jpg';
    const path = `avatars/${userId}_${Date.now()}.${ext}`;

    // Read as base64
    const response = await fetch(uri);
    const blob = await response.blob();
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const { error } = await supabase.storage
      .from('openflou-media')
      .upload(path, bytes, {
        contentType: `image/${ext}`,
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from('openflou-media').getPublicUrl(path);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Avatar upload error:', error);
    return null;
  }
}

export default function EditProfileScreen() {
  const { colors, t, currentUser, setCurrentUser, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [username, setUsername] = useState(currentUser?.username || '');
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUri, setAvatarUri] = useState(currentUser?.avatar);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!username.trim()) {
      showAlert('Username cannot be empty');
      return;
    }

    if (!currentUser) return;
    setSaving(true);

    try {
      let finalAvatar = avatarUri;

      // If avatar is a local file URI, upload it first
      if (avatarUri && avatarUri.startsWith('file://')) {
        const uploaded = await uploadAvatar(avatarUri, currentUser.id);
        if (uploaded) {
          finalAvatar = uploaded;
        } else {
          showAlert('Failed to upload photo, keeping existing avatar');
          finalAvatar = currentUser.avatar;
        }
      }

      const updatedUser = {
        ...currentUser,
        username: username.trim().toLowerCase(),
        display_name: displayName.trim() || username.trim(),
        bio: bio.trim() || undefined,
        avatar: finalAvatar,
      };

      const { error } = await api.updateUser(updatedUser);
      if (error) {
        showAlert('Error', error);
        return;
      }

      setCurrentUser(updatedUser);
      await storage.saveCurrentUser(updatedUser);
      showAlert('Profile updated');
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.editProfile}</Text>
        <Pressable
          onPress={handleSave}
          disabled={!username.trim() || saving}
          style={({ pressed }) => [
            styles.saveButton,
            { opacity: (!username.trim() || saving) ? 0.3 : pressed ? 0.7 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="check" size={24} color={colors.primary} />
          )}
        </Pressable>
      </View>

      <ScrollView>
        {/* Avatar Section */}
        <View style={[styles.avatarSection, { backgroundColor: colors.surface }]}>
          <Avatar uri={avatarUri} username={username || currentUser?.username} size={80} colors={colors} />
          <Pressable
            onPress={async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                showAlert('Permission denied');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                setAvatarUri(result.assets[0].uri);
              }
            }}
            style={({ pressed }) => [styles.changePhotoButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
          </Pressable>
        </View>

        {/* Display Name */}
        <View style={[styles.inputSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            maxLength={50}
          />
        </View>

        {/* Username */}
        <View style={[styles.inputSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t.username}</Text>
          <TextInput
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
            placeholder={t.username}
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            maxLength={30}
            autoCapitalize="none"
          />
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Unique identifier, lowercase only
          </Text>
        </View>

        {/* Bio */}
        <View style={[styles.inputSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.bioInput, { color: colors.text, borderColor: colors.border }]}
            maxLength={150}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: colors.textTertiary }]}>
            {bio.length}/150
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    includeFontPadding: false,
  },
  saveButton: { padding: 8 },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    marginTop: 8,
  },
  changePhotoButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePhotoText: {
    fontSize: 15,
    fontWeight: '600',
    includeFontPadding: false,
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    includeFontPadding: false,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
    includeFontPadding: false,
  },
  bioInput: {
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
    includeFontPadding: false,
  },
});
