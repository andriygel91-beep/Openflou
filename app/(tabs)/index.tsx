// Openflou Chats Tab
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { ChatListItem, EmptyState, Avatar } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { getSupabaseClient } from '@/template';
import * as api from '@/services/api';

const supabase = getSupabaseClient();

function AnimatedFAB({ icon, onPress, bottom, backgroundColor, iconColor, delay }: any) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(delay).springify()}
      style={[styles.fab, { bottom }, animatedStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.85, { damping: 15 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 });
        }}
        style={({ pressed }) => [{
          width: '100%',
          height: '100%',
          borderRadius: 28,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor,
          opacity: pressed ? 0.8 : 1,
        }]}
      >
        <MaterialIcons name={icon} size={24} color={iconColor} />
      </Pressable>
    </Animated.View>
  );
}

export default function ChatsTab() {
  const { colors, t, chats, loadChats, currentUser, theme } = useOpenFlou();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const incomingCallRef = useRef<any>(null);

  useEffect(() => {
    if (currentUser) {
      console.log('Chats tab: loading chats');
      loadChats();
    }
  }, [currentUser]);

  useEffect(() => {
    // Auto-refresh chats when screen is focused
    if (!currentUser) return;
    
    const interval = setInterval(() => {
      loadChats();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // Poll for incoming calls
  useEffect(() => {
    if (!currentUser) return;
    const poll = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('openflou_calls')
          .select('*')
          .eq('callee_id', currentUser.id)
          .eq('status', 'ringing')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data && data.id !== incomingCallRef.current?.id) {
          incomingCallRef.current = data;
          // Fetch caller info
          const caller = await api.getUserById(data.caller_id);
          setIncomingCall({ ...data, caller });
        } else if (!data && incomingCallRef.current) {
          incomingCallRef.current = null;
          setIncomingCall(null);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [currentUser?.id]);

  async function dismissIncomingCall(action: 'decline' | 'answer') {
    if (!incomingCall) return;
    if (action === 'decline') {
      await supabase
        .from('openflou_calls')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', incomingCall.id);
      incomingCallRef.current = null;
      setIncomingCall(null);
    } else {
      const call = incomingCall;
      incomingCallRef.current = null;
      setIncomingCall(null);
      router.push(`/call?chatId=${call.chat_id}&callerId=${call.caller_id}&type=${call.type}&role=callee&callId=${call.id}`);
    }
  }

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t.chats || 'Chats'}</Text>
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

      {/* Incoming Call Modal */}
      <Modal visible={!!incomingCall} transparent animationType="slide" onRequestClose={() => dismissIncomingCall('decline')}>
        <View style={styles.callOverlay}>
          <View style={[styles.callCard, { backgroundColor: colors.surface }]}>
            <Avatar uri={incomingCall?.caller?.avatar} username={(incomingCall?.caller as any)?.display_name || incomingCall?.caller?.username || '?'} size={72} colors={colors} />
            <Text style={[styles.callName, { color: colors.text }]}>
              {(incomingCall?.caller as any)?.display_name || incomingCall?.caller?.username || 'Unknown'}
            </Text>
            <Text style={[styles.callSubtitle, { color: colors.textSecondary }]}>
              {incomingCall?.type === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}
            </Text>
            <View style={styles.callActions}>
              <Pressable
                onPress={() => dismissIncomingCall('decline')}
                style={({ pressed }) => [styles.callActionBtn, styles.callDeclineBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <MaterialIcons name="call-end" size={28} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => dismissIncomingCall('answer')}
                style={({ pressed }) => [styles.callActionBtn, styles.callAnswerBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <MaterialIcons name="call" size={28} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Action Buttons */}
      <AnimatedFAB
        icon="edit"
        onPress={() => router.push('/contacts')}
        bottom={insets.bottom + 80}
        backgroundColor={colors.primary}
        iconColor={colors.textInverted}
        delay={0}
      />
      
      <AnimatedFAB
        icon="campaign"
        onPress={() => router.push('/create-channel')}
        bottom={insets.bottom + 148}
        backgroundColor={colors.surfaceSecondary}
        iconColor={colors.primary}
        delay={100}
      />
      
      <AnimatedFAB
        icon="group-add"
        onPress={() => router.push('/create-group')}
        bottom={insets.bottom + 216}
        backgroundColor={colors.surfaceSecondary}
        iconColor={colors.primary}
        delay={200}
      />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  callOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 48,
  },
  callCard: {
    width: '90%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  callName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
    includeFontPadding: false,
  },
  callSubtitle: {
    fontSize: 15,
    includeFontPadding: false,
  },
  callActions: {
    flexDirection: 'row',
    gap: 48,
    marginTop: 20,
  },
  callActionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callDeclineBtn: { backgroundColor: '#ef4444' },
  callAnswerBtn: { backgroundColor: '#22c55e' },
});
