// Openflou Edit Profile Screen
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import * as storage from '@/services/storage';
import { StatusBar } from 'expo-status-bar';

export default function EditProfileScreen() {
  const { colors, t, currentUser, setCurrentUser, theme } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar);

  async function handleSave() {
    if (!username.trim()) {
      showAlert('Username cannot be empty');
      return;
    }

    if (!currentUser) return;

    // Check if username is already taken
    if (username !== currentUser.username) {
      const allUsers = await storage.getUsers();
      const usernameTaken = allUsers.some(
        (u) => u.username === username && u.id !== currentUser.id
      );
      
      if (usernameTaken) {
        showAlert('Username is already taken');
        return;
      }
    }

    const updatedUser = {
      ...currentUser,
      username: username.trim(),
      bio: bio.trim() || undefined,
      avatar,
    };

    await storage.saveUser(updatedUser);
    setCurrentUser(updatedUser);
    showAlert('Profile updated');
    router.back();
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
          disabled={!username.trim()}
          style={({ pressed }) => [
            styles.saveButton,
            {
              opacity: !username.trim() ? 0.3 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <MaterialIcons name="check" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView>
        {/* Avatar Section */}
        <View style={[styles.avatarSection, { backgroundColor: colors.surface }]}>
          <Avatar uri={avatar} username={username || currentUser?.username} size={80} colors={colors} />
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
                setAvatar(result.assets[0].uri);
              }
            }}
            style={({ pressed }) => [
              styles.changePhotoButton,
              {
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
          </Pressable>
        </View>

        {/* Username */}
        <View style={[styles.inputSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t.username}</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder={t.username}
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            maxLength={30}
            autoCapitalize="none"
          />
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    includeFontPadding: false,
  },
  saveButton: {
    padding: 8,
  },
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
