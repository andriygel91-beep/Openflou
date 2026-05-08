// Openflou Chat Settings - Full Management for Channels & Groups
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as api from '@/services/api';
import * as storage from '@/services/storage';

export default function ChatSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, t, theme, chats, currentUser, updateChat, deleteChat, logout } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const chat = chats.find((c) => c.id === id);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  // Track if loaded at least once to avoid re-fetch loop
  const loadedRef = useRef(false);

  const isCreator = currentUser?.id === chat?.creatorId;
  const isAdmin = chat?.admins?.includes(currentUser?.id || '');
  const canManage = isCreator || isAdmin;

  // Load participants (including for DMs, to find the other user for block action)
  useEffect(() => {
    if (chat && !loadedRef.current) {
      loadedRef.current = true;
      loadParticipants();
    }
  }, [chat?.id]);

  const loadParticipants = useCallback(async () => {
    if (!chat) return;
    setLoading(true);

    const users: any[] = [];
    for (const userId of chat.participants) {
      const user = await api.getUserById(userId);
      if (user) {
        users.push({
          ...user,
          isAdmin: chat.admins?.includes(userId) || false,
          isCreator: chat.creatorId === userId,
          isBanned: chat.bannedUsers?.includes(userId) || false,
        });
      }
    }

    setParticipants(users);
    setLoading(false);
  }, [chat?.id, chat?.participants?.length, chat?.admins?.length]);

  // ── Admin actions ──
  async function handleMakeAdmin(userId: string) {
    if (!chat || !canManage) return;
    const { error } = await updateChat({ ...chat, admins: [...(chat.admins || []), userId] });
    if (error) showAlert('Error', error);
    else { showAlert('Admin added'); loadedRef.current = false; await loadParticipants(); }
  }

  async function handleRemoveAdmin(userId: string) {
    if (!chat || !isCreator) return;
    showAlert('Remove Admin?', 'This user will lose admin privileges', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const { error } = await updateChat({
            ...chat,
            admins: (chat.admins || []).filter((id) => id !== userId),
          });
          if (error) showAlert('Error', error);
          else { loadedRef.current = false; await loadParticipants(); }
        },
      },
    ]);
  }

  async function handleBanUser(userId: string) {
    if (!chat || !canManage) return;
    showAlert('Ban User?', 'This user will be removed and cannot rejoin', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban', style: 'destructive',
        onPress: async () => {
          const { error } = await updateChat({
            ...chat,
            participants: chat.participants.filter((id) => id !== userId),
            admins: (chat.admins || []).filter((id) => id !== userId),
            bannedUsers: [...(chat.bannedUsers || []), userId],
          });
          if (error) showAlert('Error', error);
          else { loadedRef.current = false; await loadParticipants(); }
        },
      },
    ]);
  }

  async function handleKickUser(userId: string) {
    if (!chat || !canManage) return;
    showAlert('Kick User?', 'This user will be removed but can rejoin', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick', style: 'destructive',
        onPress: async () => {
          const { error } = await updateChat({
            ...chat,
            participants: chat.participants.filter((id) => id !== userId),
            admins: (chat.admins || []).filter((id) => id !== userId),
          });
          if (error) showAlert('Error', error);
          else { loadedRef.current = false; await loadParticipants(); }
        },
      },
    ]);
  }

  async function handleBlockUser(userId: string, username: string, avatar?: string) {
    if (!currentUser) return;
    showAlert('Block User?', `You will no longer receive messages from ${username}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block', style: 'destructive',
        onPress: async () => {
          await storage.blockUser(currentUser.id, userId, username, avatar);
          showAlert('User blocked');
          setShowUserModal(false);
        },
      },
    ]);
  }

  async function handleTransferOwnership(userId: string) {
    if (!chat || !isCreator) return;
    showAlert('Transfer Ownership?', 'You will lose creator privileges. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Transfer', style: 'destructive',
        onPress: async () => {
          const updatedAdmins = [...(chat.admins || []).filter((id) => id !== userId)];
          if (!updatedAdmins.includes(currentUser!.id)) updatedAdmins.push(currentUser!.id);
          const { error } = await updateChat({ ...chat, creatorId: userId, admins: updatedAdmins });
          if (error) showAlert('Error', error);
          else { showAlert('Ownership transferred'); loadedRef.current = false; await loadParticipants(); }
        },
      },
    ]);
  }

  // ── Block user (DM only) ──
  async function handleBlockUserDM(userId: string, username: string, avatar?: string) {
    if (!currentUser) return;
    showAlert('Block User?', `You will no longer see messages from ${username}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block', style: 'destructive',
        onPress: async () => {
          await storage.blockUser(currentUser.id, userId, username, avatar);
          showAlert('Blocked', `${username} has been blocked`);
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  // ── Leave chat ──
  async function handleLeaveChat() {
    if (!chat || !currentUser) return;
    const label = chat.type === 'channel' ? 'channel' : 'group';
    showAlert(`Leave ${label}?`, `You will no longer receive messages from this ${label}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          const newParticipants = chat.participants.filter((pid) => pid !== currentUser.id);
          const newAdmins = (chat.admins || []).filter((aid) => aid !== currentUser.id);
          // If creator leaves, transfer to first admin or first participant
          let newCreatorId = chat.creatorId;
          if (chat.creatorId === currentUser.id) {
            newCreatorId = newAdmins[0] || newParticipants[0] || '';
          }
          const { error } = await updateChat({
            ...chat,
            participants: newParticipants,
            admins: newAdmins,
            creatorId: newCreatorId,
          });
          if (error) { showAlert('Error', error); return; }
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  // ── Delete chat for all ──
  async function handleDeleteForAll() {
    if (!chat || !canManage) return;
    const label = chat.type === 'channel' ? 'channel' : 'group';
    showAlert(`Delete ${label}?`, `This will permanently delete the ${label} and all messages for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete for all', style: 'destructive',
        onPress: async () => {
          await deleteChat(chat.id);
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  // ── Delete direct chat for both ──
  async function handleDeleteDirect() {
    if (!chat) return;
    showAlert('Delete conversation?', 'All messages will be deleted for both users.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteChat(chat.id);
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  function renderParticipant({ item }: { item: any }) {
    const isSelf = item.id === currentUser?.id;
    return (
      <Pressable
        onPress={() => {
          if (!isSelf) {
            setSelectedUserId(item.id);
            setShowUserModal(true);
          }
        }}
        style={({ pressed }) => [
          styles.participantItem,
          { backgroundColor: pressed && !isSelf ? colors.surfaceSecondary : colors.surface },
        ]}
      >
        <Avatar uri={item.avatar} username={item.display_name || item.username} size={48} isOnline={item.isOnline} colors={colors} />
        <View style={styles.participantInfo}>
          <View style={styles.participantNameRow}>
            <Text style={[styles.participantName, { color: colors.text }]} numberOfLines={1}>
              {item.display_name || item.username}
            </Text>
            {item.isCreator && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="star" size={12} color={colors.textInverted} />
                <Text style={[styles.badgeText, { color: colors.textInverted }]}>Creator</Text>
              </View>
            )}
            {item.isAdmin && !item.isCreator && (
              <View style={[styles.badge, { backgroundColor: colors.online }]}>
                <MaterialIcons name="verified" size={12} color={colors.textInverted} />
                <Text style={[styles.badgeText, { color: colors.textInverted }]}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={[styles.participantUsername, { color: colors.textSecondary }]}>@{item.username}</Text>
        </View>
        {!isSelf && (
          <MaterialIcons name="more-vert" size={24} color={colors.icon} />
        )}
      </Pressable>
    );
  }

  if (!chat) return null;

  const isDirectChat = chat.type === 'direct';
  const selectedUser = participants.find((p) => p.id === selectedUserId);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {chat.type === 'channel' ? 'Channel Info' : chat.type === 'group' ? 'Group Info' : 'Chat Info'}
        </Text>
        {canManage && (
          <Pressable onPress={() => router.push(`/edit-chat?id=${chat.id}`)} style={styles.backButton}>
            <MaterialIcons name="edit" size={24} color={colors.primary} />
          </Pressable>
        )}
        {!canManage && <View style={{ width: 40 }} />}
      </View>

      <ScrollView style={styles.container}>
        {/* Chat Info */}
        <View style={[styles.infoSection, { backgroundColor: colors.surface }]}>
          <Avatar uri={chat.avatar} username={chat.name} size={80} colors={colors} />
          <Text style={[styles.chatName, { color: colors.text }]}>{chat.name}</Text>
          {chat.username ? (
            <Text style={[styles.chatUsername, { color: colors.textSecondary }]}>@{chat.username}</Text>
          ) : null}
          {chat.description ? (
            <Text style={[styles.chatDescription, { color: colors.textSecondary }]}>{chat.description}</Text>
          ) : null}
          <Text style={[styles.participantCount, { color: colors.textTertiary }]}>
            {chat.participants.length} {chat.type === 'channel' ? 'subscribers' : 'members'}
          </Text>
        </View>

        {/* Management (admin only) */}
        {canManage && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>MANAGEMENT</Text>

            <Pressable
              onPress={() => router.push(`/edit-chat?id=${chat.id}`)}
              style={({ pressed }) => [styles.settingItem, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.primary + '22' }]}>
                <MaterialIcons name="edit" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.settingText, { color: colors.text }]}>Edit Info</Text>
              <MaterialIcons name="chevron-right" size={22} color={colors.icon} />
            </Pressable>

            <Pressable
              onPress={() => router.push(`/chat-privacy?id=${chat.id}`)}
              style={({ pressed }) => [styles.settingItem, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.online + '22' }]}>
                <MaterialIcons name="timer" size={22} color={colors.online} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingText, { color: colors.text }]}>Disappearing Messages</Text>
                {chat.disappearingMessagesEnabled ? (
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Enabled · {chat.disappearingMessagesTimer}s
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.icon} />
            </Pressable>
          </View>
        )}

        {/* Participants */}
        {!isDirectChat && (
          <View style={styles.participantsSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, paddingHorizontal: 20 }]}>
              {chat.type === 'channel' ? 'SUBSCRIBERS' : 'MEMBERS'}
            </Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={participants}
                keyExtractor={(item) => item.id}
                renderItem={renderParticipant}
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {/* Danger zone */}
        <View style={[styles.section, { backgroundColor: colors.surface, marginTop: 12, marginBottom: 32 }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACTIONS</Text>

          {/* Leave (non-creators or groups) */}
          {!isDirectChat && !isCreator && (
            <Pressable
              onPress={handleLeaveChat}
              style={({ pressed }) => [styles.settingItem, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.error + '22' }]}>
                <MaterialIcons name="exit-to-app" size={22} color={colors.error} />
              </View>
              <Text style={[styles.settingText, { color: colors.error }]}>
                Leave {chat.type === 'channel' ? 'Channel' : 'Group'}
              </Text>
            </Pressable>
          )}

          {/* Delete for all (admin/creator) */}
          {!isDirectChat && canManage && (
            <Pressable
              onPress={handleDeleteForAll}
              style={({ pressed }) => [styles.settingItem, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.error + '22' }]}>
                <MaterialIcons name="delete-forever" size={22} color={colors.error} />
              </View>
              <Text style={[styles.settingText, { color: colors.error }]}>
                Delete {chat.type === 'channel' ? 'Channel' : 'Group'} for All
              </Text>
            </Pressable>
          )}

          {/* Direct chat: block + delete */}
          {isDirectChat && (() => {
            const otherUserId = chat.participants.find((pid) => pid !== currentUser?.id);
            const otherUser = participants.find((p) => p.id === otherUserId);
            return (
              <>
                {otherUser ? (
                  <Pressable
                    onPress={() => handleBlockUserDM(otherUser.id, otherUser.display_name || otherUser.username, otherUser.avatar)}
                    style={({ pressed }) => [styles.settingItem, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={[styles.settingIcon, { backgroundColor: colors.error + '22' }]}>
                      <MaterialIcons name="block" size={22} color={colors.error} />
                    </View>
                    <Text style={[styles.settingText, { color: colors.error }]}>Block User</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={handleDeleteDirect}
                  style={({ pressed }) => [styles.settingItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[styles.settingIcon, { backgroundColor: colors.error + '22' }]}>
                    <MaterialIcons name="delete-forever" size={22} color={colors.error} />
                  </View>
                  <Text style={[styles.settingText, { color: colors.error }]}>Delete Conversation</Text>
                </Pressable>
              </>
            );
          })()}
        </View>
      </ScrollView>

      {/* User action modal */}
      <Modal
        visible={showUserModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUserModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowUserModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {selectedUser ? (
              <>
                <View style={styles.modalHeader}>
                  <Avatar uri={selectedUser.avatar} username={selectedUser.display_name || selectedUser.username} size={60} colors={colors} />
                  <Text style={[styles.modalUserName, { color: colors.text }]}>
                    {selectedUser.display_name || selectedUser.username}
                  </Text>
                  <Text style={[styles.modalUsername, { color: colors.textSecondary }]}>
                    @{selectedUser.username}
                  </Text>
                </View>

                <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

                <View style={styles.modalActions}>
                  {/* Block */}
                  <Pressable
                    onPress={() => {
                      setShowUserModal(false);
                      handleBlockUser(selectedUser.id, selectedUser.username, selectedUser.avatar);
                    }}
                    style={({ pressed }) => [styles.modalAction, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <MaterialIcons name="block" size={24} color={colors.error} />
                    <Text style={[styles.modalActionText, { color: colors.error }]}>Block</Text>
                  </Pressable>

                  {/* Admin actions */}
                  {canManage && !selectedUser.isAdmin && (
                    <Pressable
                      onPress={() => { setShowUserModal(false); handleMakeAdmin(selectedUserId); }}
                      style={({ pressed }) => [styles.modalAction, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <MaterialIcons name="verified" size={24} color={colors.online} />
                      <Text style={[styles.modalActionText, { color: colors.text }]}>Make Admin</Text>
                    </Pressable>
                  )}

                  {selectedUser.isAdmin && !selectedUser.isCreator && isCreator && (
                    <Pressable
                      onPress={() => { setShowUserModal(false); handleRemoveAdmin(selectedUserId); }}
                      style={({ pressed }) => [styles.modalAction, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <MaterialIcons name="remove-moderator" size={24} color={colors.textSecondary} />
                      <Text style={[styles.modalActionText, { color: colors.text }]}>Remove Admin</Text>
                    </Pressable>
                  )}

                  {isCreator && selectedUser.isAdmin && !selectedUser.isCreator && (
                    <Pressable
                      onPress={() => { setShowUserModal(false); handleTransferOwnership(selectedUserId); }}
                      style={({ pressed }) => [styles.modalAction, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <MaterialIcons name="swap-horiz" size={24} color={colors.primary} />
                      <Text style={[styles.modalActionText, { color: colors.text }]}>Transfer Ownership</Text>
                    </Pressable>
                  )}

                  {canManage && (
                    <Pressable
                      onPress={() => { setShowUserModal(false); handleKickUser(selectedUserId); }}
                      style={({ pressed }) => [styles.modalAction, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <MaterialIcons name="exit-to-app" size={24} color={colors.textSecondary} />
                      <Text style={[styles.modalActionText, { color: colors.text }]}>Kick</Text>
                    </Pressable>
                  )}

                  {canManage && (
                    <Pressable
                      onPress={() => { setShowUserModal(false); handleBanUser(selectedUserId); }}
                      style={({ pressed }) => [styles.modalAction, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <MaterialIcons name="gavel" size={24} color={colors.error} />
                      <Text style={[styles.modalActionText, { color: colors.error }]}>Ban</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => setShowUserModal(false)}
                    style={({ pressed }) => [styles.modalAction, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                    <Text style={[styles.modalActionText, { color: colors.textSecondary }]}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
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
  container: { flex: 1 },
  infoSection: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  chatName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    includeFontPadding: false,
  },
  chatUsername: {
    fontSize: 15,
    marginTop: 4,
    includeFontPadding: false,
  },
  chatDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    includeFontPadding: false,
  },
  participantCount: {
    fontSize: 13,
    marginTop: 8,
    includeFontPadding: false,
  },
  section: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingVertical: 10,
    includeFontPadding: false,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    includeFontPadding: false,
  },
  settingSubtext: {
    fontSize: 13,
    marginTop: 2,
    includeFontPadding: false,
  },
  participantsSection: { marginBottom: 12 },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  participantInfo: { flex: 1, marginLeft: 12 },
  participantNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantName: { fontSize: 16, fontWeight: '600', includeFontPadding: false },
  participantUsername: { fontSize: 14, marginTop: 2, includeFontPadding: false },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '600', includeFontPadding: false },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  modalUserName: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    includeFontPadding: false,
  },
  modalUsername: {
    fontSize: 14,
    marginTop: 4,
    includeFontPadding: false,
  },
  modalDivider: { height: 1, marginHorizontal: 20 },
  modalActions: { paddingHorizontal: 20, paddingTop: 4 },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
