// Openflou Blocked Users Screen
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar, EmptyState } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as storage from '@/services/storage';

interface BlockedUser {
  id: string;
  username: string;
  avatar?: string;
  blockedAt: Date;
}

export default function BlockedUsersScreen() {
  const { colors, t, theme, currentUser } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();
  
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  async function loadBlockedUsers() {
    if (!currentUser) return;
    
    const blocked = await storage.getBlockedUsers(currentUser.id);
    setBlockedUsers(blocked);
  }

  async function handleUnblock(userId: string) {
    if (!currentUser) return;
    
    showAlert(
      'Unblock User?',
      'This user will be able to send you messages again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            await storage.unblockUser(currentUser.id, userId);
            await loadBlockedUsers();
            showAlert('User unblocked');
          },
        },
      ]
    );
  }

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={[styles.userItem, { backgroundColor: colors.surface }]}>
      <Avatar uri={item.avatar} username={item.username} size={48} colors={colors} />
      
      <View style={styles.userInfo}>
        <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
        <Text style={[styles.blockedDate, { color: colors.textSecondary }]}>
          Blocked {new Date(item.blockedAt).toLocaleDateString()}
        </Text>
      </View>
      
      <Pressable
        onPress={() => handleUnblock(item.id)}
        style={({ pressed }) => [
          styles.unblockButton,
          {
            backgroundColor: pressed ? colors.surfaceSecondary : colors.error,
          },
        ]}
      >
        <Text style={[styles.unblockText, { color: colors.textInverted }]}>Unblock</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Blocked Users</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <MaterialIcons name="info-outline" size={20} color={colors.textSecondary} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Blocked users cannot send you messages or see your profile.
        </Text>
      </View>

      {/* Blocked Users List */}
      {blockedUsers.length === 0 ? (
        <EmptyState
          icon="block"
          title="No Blocked Users"
          description="You haven't blocked anyone yet."
          colors={colors}
        />
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderBlockedUser}
        />
      )}
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
  infoContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
    marginBottom: 4,
  },
  blockedDate: {
    fontSize: 13,
    includeFontPadding: false,
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '600',
    includeFontPadding: false,
  },
});
