// Openflou Chat Settings - Full Management for Channels & Groups
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { useAlert } from '@/template';
import { Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as api from '@/services/api';

export default function ChatSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, t, theme, chats, currentUser, updateChat } = useOpenFlou();
  const { showAlert } = useAlert();
  const router = useRouter();

  const chat = chats.find((c) => c.id === id);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const isCreator = currentUser?.id === chat?.creatorId;
  const isAdmin = chat?.admins?.includes(currentUser?.id || '');
  const canManage = isCreator || isAdmin;

  useEffect(() => {
    loadParticipants();
  }, [chat?.participants]);

  async function loadParticipants() {
    if (!chat) return;
    setLoading(true);
    
    const users = [];
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
  }

  async function handleMakeAdmin(userId: string) {
    if (!chat || !canManage) return;

    const updatedChat = {
      ...chat,
      admins: [...(chat.admins || []), userId],
    };

    const { error } = await updateChat(updatedChat);
    if (error) {
      showAlert('Error', error);
    } else {
      showAlert('Admin added');
      await loadParticipants();
    }
  }

  async function handleRemoveAdmin(userId: string) {
    if (!chat || !isCreator) return;

    showAlert('Remove Admin?', 'This user will lose admin privileges', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updatedChat = {
            ...chat,
            admins: (chat.admins || []).filter((id) => id !== userId),
          };
          
          const { error } = await updateChat(updatedChat);
          if (error) {
            showAlert('Error', error);
          } else {
            await loadParticipants();
          }
        },
      },
    ]);
  }

  async function handleBanUser(userId: string) {
    if (!chat || !canManage) return;

    showAlert('Ban User?', 'This user will be removed and cannot rejoin', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: async () => {
          const updatedChat = {
            ...chat,
            participants: chat.participants.filter((id) => id !== userId),
            admins: (chat.admins || []).filter((id) => id !== userId),
            bannedUsers: [...(chat.bannedUsers || []), userId],
          };
          
          const { error } = await updateChat(updatedChat);
          if (error) {
            showAlert('Error', error);
          } else {
            await loadParticipants();
          }
        },
      },
    ]);
  }

  async function handleKickUser(userId: string) {
    if (!chat || !canManage) return;

    showAlert('Kick User?', 'This user will be removed but can rejoin', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick',
        style: 'destructive',
        onPress: async () => {
          const updatedChat = {
            ...chat,
            participants: chat.participants.filter((id) => id !== userId),
            admins: (chat.admins || []).filter((id) => id !== userId),
          };
          
          const { error } = await updateChat(updatedChat);
          if (error) {
            showAlert('Error', error);
          } else {
            await loadParticipants();
          }
        },
      },
    ]);
  }

  async function handleTransferOwnership(userId: string) {
    if (!chat || !isCreator) return;

    showAlert(
      'Transfer Ownership?',
      'You will lose creator privileges. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            const updatedChat = {
              ...chat,
              creatorId: userId,
              admins: [...(chat.admins || []).filter((id) => id !== userId)],
            };
            
            // Add current creator as admin
            if (!updatedChat.admins.includes(currentUser!.id)) {
              updatedChat.admins.push(currentUser!.id);
            }
            
            const { error } = await updateChat(updatedChat);
            if (error) {
              showAlert('Error', error);
            } else {
              showAlert('Ownership transferred');
              await loadParticipants();
            }
          },
        },
      ]
    );
  }

  function renderParticipant({ item }: { item: any }) {
    const isSelf = item.id === currentUser?.id;
    
    return (
      <View style={[styles.participantItem, { backgroundColor: colors.surface }]}>
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

        {canManage && !isSelf && (
          <Pressable
            onPress={() => {
              setSelectedUserId(item.id);
              setShowAddAdminModal(true);
            }}
            style={styles.moreButton}
          >
            <MaterialIcons name="more-vert" size={24} color={colors.icon} />
          </Pressable>
        )}
      </View>
    );
  }

  if (!chat) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {chat.type === 'channel' ? 'Channel Settings' : 'Group Settings'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container}>
        {/* Chat Info */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Avatar uri={chat.avatar} username={chat.name} size={80} colors={colors} />
          <Text style={[styles.chatName, { color: colors.text }]}>{chat.name}</Text>
          {chat.username && (
            <Text style={[styles.chatUsername, { color: colors.textSecondary }]}>@{chat.username}</Text>
          )}
          {chat.description && (
            <Text style={[styles.chatDescription, { color: colors.textSecondary }]}>{chat.description}</Text>
          )}
          <Text style={[styles.participantCount, { color: colors.textTertiary }]}>
            {chat.participants.length} {chat.type === 'channel' ? 'subscribers' : 'members'}
          </Text>
        </View>

        {/* Participants */}
        <View style={styles.participantsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {chat.type === 'channel' ? 'Subscribers' : 'Members'}
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

        {/* Settings (for admins/creator) */}
        {canManage && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Management</Text>
            
            <Pressable
              onPress={() => router.push(`/edit-chat?id=${chat.id}`)}
              style={({ pressed }) => [
                styles.settingItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <MaterialIcons name="edit" size={24} color={colors.icon} />
              <Text style={[styles.settingText, { color: colors.text }]}>Edit Info</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.icon} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* User Actions Modal */}
      <Modal
        visible={showAddAdminModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddAdminModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAddAdminModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {(() => {
              const user = participants.find((p) => p.id === selectedUserId);
              if (!user) return null;

              return (
                <>
                  <View style={styles.modalHeader}>
                    <Avatar uri={user.avatar} username={user.display_name || user.username} size={56} colors={colors} />
                    <Text style={[styles.modalUserName, { color: colors.text }]}>
                      {user.display_name || user.username}
                    </Text>
                  </View>

                  <View style={styles.modalActions}>
                    {!user.isAdmin && canManage && (
                      <Pressable
                        onPress={() => {
                          handleMakeAdmin(selectedUserId);
                          setShowAddAdminModal(false);
                        }}
                        style={({ pressed }) => [
                          styles.modalAction,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <MaterialIcons name="verified" size={24} color={colors.online} />
                        <Text style={[styles.modalActionText, { color: colors.text }]}>Make Admin</Text>
                      </Pressable>
                    )}

                    {user.isAdmin && !user.isCreator && isCreator && (
                      <Pressable
                        onPress={() => {
                          handleRemoveAdmin(selectedUserId);
                          setShowAddAdminModal(false);
                        }}
                        style={({ pressed }) => [
                          styles.modalAction,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <MaterialIcons name="remove-moderator" size={24} color={colors.textSecondary} />
                        <Text style={[styles.modalActionText, { color: colors.text }]}>Remove Admin</Text>
                      </Pressable>
                    )}

                    {isCreator && user.isAdmin && !user.isCreator && (
                      <Pressable
                        onPress={() => {
                          handleTransferOwnership(selectedUserId);
                          setShowAddAdminModal(false);
                        }}
                        style={({ pressed }) => [
                          styles.modalAction,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <MaterialIcons name="swap-horiz" size={24} color={colors.primary} />
                        <Text style={[styles.modalActionText, { color: colors.text }]}>Transfer Ownership</Text>
                      </Pressable>
                    )}

                    {canManage && (
                      <Pressable
                        onPress={() => {
                          handleKickUser(selectedUserId);
                          setShowAddAdminModal(false);
                        }}
                        style={({ pressed }) => [
                          styles.modalAction,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <MaterialIcons name="exit-to-app" size={24} color={colors.textSecondary} />
                        <Text style={[styles.modalActionText, { color: colors.text }]}>Kick</Text>
                      </Pressable>
                    )}

                    {canManage && (
                      <Pressable
                        onPress={() => {
                          handleBanUser(selectedUserId);
                          setShowAddAdminModal(false);
                        }}
                        style={({ pressed }) => [
                          styles.modalAction,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <MaterialIcons name="block" size={24} color={colors.error} />
                        <Text style={[styles.modalActionText, { color: colors.error }]}>Ban</Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() => setShowAddAdminModal(false)}
                      style={({ pressed }) => [
                        styles.modalAction,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                      <Text style={[styles.modalActionText, { color: colors.textSecondary }]}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              );
            })()}
          </View>
        </Pressable>
      </Modal>
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
  container: {
    flex: 1,
  },
  section: {
    padding: 20,
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
  participantsSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 12,
    includeFontPadding: false,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
  },
  participantUsername: {
    fontSize: 14,
    marginTop: 2,
    includeFontPadding: false,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    includeFontPadding: false,
  },
  moreButton: {
    padding: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    includeFontPadding: false,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalUserName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    includeFontPadding: false,
  },
  modalActions: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
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
