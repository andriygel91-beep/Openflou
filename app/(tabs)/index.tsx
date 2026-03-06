// Openflou Chats Tab
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { ChatListItem, EmptyState } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function ChatsTab() {
  const { colors, t, chats, loadChats, currentUser, theme } = useOpenFlou();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  const filteredChats = chats.filter((chat) =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    
    const aTime = a.lastMessage?.timestamp || a.createdAt;
    const bTime = b.lastMessage?.timestamp || b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t.authTitle}</Text>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/search-messages')}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: colors.surfaceSecondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialIcons name="search" size={24} color={colors.icon} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/ai-assistant')}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: colors.surfaceSecondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <MaterialIcons name="smart-toy" size={24} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        
        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary }]}>
          <MaterialIcons name="search" size={20} color={colors.icon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t.searchChats}
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
      </View>

      {/* Chat List */}
      {sortedChats.length === 0 ? (
        <EmptyState
          icon="forum"
          title={t.noChats}
          description={t.noChatsDesc}
          colors={colors}
        />
      ) : (
        <FlatList
          data={sortedChats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatListItem
              chat={item}
              colors={colors}
              t={t}
              currentUserId={currentUser?.id || ''}
              onPress={() => router.push(`/chat?id=${item.id}`)}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        />
      )}

      {/* Floating Action Buttons */}
      <Pressable
        onPress={() => router.push('/contacts')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: insets.bottom + 80,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <MaterialIcons name="edit" size={24} color={colors.textInverted} />
      </Pressable>
      
      <Pressable
        onPress={() => router.push('/create-group')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.surfaceSecondary,
            bottom: insets.bottom + 148,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <MaterialIcons name="group-add" size={24} color={colors.primary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    includeFontPadding: false,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
