// Openflou Group Voice Room — Discord-style multi-user voice channel
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { getSupabaseClient } from '@/template';
import * as api from '@/services/api';
import { Avatar } from '@/components';
import { mediaDevices, MediaStream } from 'react-native-webrtc';

const supabase = getSupabaseClient();

interface VoiceParticipant {
  userId: string;
  displayName: string;
  username: string;
  avatar: string | undefined;
  isMuted: boolean;
}

export default function GroupVoiceScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { colors, currentUser } = useOpenFlou();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [chatName, setChatName] = useState('Group');
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLeavingRef = useRef(false);
  const isMutedRef = useRef(false);
  const voiceRoomKey = `voice_${chatId}`;

  useEffect(() => {
    start();
    return () => { stop(); };
  }, []);

  // Keep isMutedRef in sync with state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  async function start() {
    if (!currentUser || !chatId) return;

    // Load chat name
    try {
      const { data } = await supabase
        .from('openflou_chats')
        .select('name')
        .eq('id', chatId)
        .single();
      if (data?.name) setChatName(data.name);
    } catch { /* ignore */ }

    // Request microphone
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch { /* continue without mic */ }

    // Register presence in voice room
    await markPresence(true);

    // Add self immediately
    setParticipants([{
      userId: currentUser.id,
      displayName: (currentUser as any).display_name || currentUser.username,
      username: currentUser.username,
      avatar: currentUser.avatar,
      isMuted: false,
    }]);

    // Start timers
    durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    // Poll for participants every 4s, refresh own presence every 4s
    pollRef.current = setInterval(async () => {
      await markPresence(true);
      await syncParticipants();
    }, 4000);

    // Initial sync
    await syncParticipants();
  }

  async function markPresence(active: boolean) {
    if (!currentUser || !chatId) return;
    try {
      if (active) {
        // Use INSERT ... ON CONFLICT UPDATE
        await supabase.from('openflou_sessions').upsert(
          {
            user_id: currentUser.id,
            device_name: voiceRoomKey,
            device_type: 'voice_room',
            platform: 'voice',
            last_active: new Date().toISOString(),
          },
          { onConflict: 'user_id,device_name' }
        );
      } else {
        await supabase
          .from('openflou_sessions')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('device_name', voiceRoomKey);
      }
    } catch { /* ignore */ }
  }

  async function syncParticipants() {
    if (!currentUser || !chatId) return;
    try {
      // Active = last heartbeat within 12s
      const cutoff = new Date(Date.now() - 12000).toISOString();
      const { data: sessions } = await supabase
        .from('openflou_sessions')
        .select('user_id')
        .eq('device_name', voiceRoomKey)
        .eq('device_type', 'voice_room')
        .gte('last_active', cutoff);

      if (!sessions || sessions.length === 0) {
        setParticipants([{
          userId: currentUser.id,
          displayName: (currentUser as any).display_name || currentUser.username,
          username: currentUser.username,
          avatar: currentUser.avatar,
          isMuted: isMutedRef.current,
        }]);
        return;
      }

      const userIds = sessions.map((s: any) => s.user_id);
      const users = await Promise.all(userIds.map((uid: string) => api.getUserById(uid)));

      const list: VoiceParticipant[] = users
        .filter(Boolean)
        .map((u: any) => ({
          userId: u.id,
          displayName: u.display_name || u.username,
          username: u.username,
          avatar: u.avatar,
          isMuted: u.id === currentUser.id ? isMutedRef.current : false,
        }));

      // Ensure self is always present
      if (!list.some((p) => p.userId === currentUser.id)) {
        list.unshift({
          userId: currentUser.id,
          displayName: (currentUser as any).display_name || currentUser.username,
          username: currentUser.username,
          avatar: currentUser.avatar,
          isMuted: isMutedRef.current,
        });
      }

      setParticipants(list);
    } catch { /* ignore */ }
  }

  function stop() {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    markPresence(false);
  }

  function toggleMute() {
    const newMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
    setParticipants((prev) =>
      prev.map((p) =>
        p.userId === currentUser?.id ? { ...p, isMuted: newMuted } : p
      )
    );
  }

  function handleLeave() {
    stop();
    router.back();
  }

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.liveDot} />
            <View>
              <Text style={styles.headerTitle}>{chatName}</Text>
              <Text style={styles.headerSub}>
                {'Voice \u00b7 '}{formatDuration(duration)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleLeave}
            style={({ pressed }) => [styles.leaveBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="call-end" size={20} color="#fff" />
            <Text style={styles.leaveBtnText}>Leave</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Participants Grid */}
      <ScrollView
        style={styles.participantsScroll}
        contentContainerStyle={[
          styles.participantsGrid,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        {participants.length === 0 ? (
          <View style={styles.emptyRoom}>
            <MaterialIcons name="mic" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyRoomText}>Joining voice room...</Text>
          </View>
        ) : (
          participants.map((p) => {
            const isSelf = p.userId === currentUser?.id;
            return (
              <View key={p.userId} style={styles.participantCard}>
                <View style={[styles.avatarWrapper, isSelf ? styles.selfRing : null]}>
                  <Avatar
                    uri={p.avatar}
                    username={p.displayName}
                    size={64}
                    colors={colors}
                  />
                  {p.isMuted ? (
                    <View style={styles.mutedBadge}>
                      <MaterialIcons name="mic-off" size={12} color="#fff" />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.participantName} numberOfLines={1}>
                  {isSelf ? `${p.displayName} (You)` : p.displayName}
                </Text>
                <Text style={styles.participantUsername} numberOfLines={1}>
                  {'@'}{p.username}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Controls bar */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.controlsInner}>
          {/* Mute */}
          <Pressable
            onPress={toggleMute}
            style={({ pressed }) => [
              styles.controlBtn,
              isMuted ? styles.controlBtnDanger : styles.controlBtnDefault,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
            <Text style={styles.controlBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </Pressable>

          {/* Participants count */}
          <View style={styles.participantsCountBadge}>
            <MaterialIcons name="people" size={18} color="rgba(255,255,255,0.8)" />
            <Text style={styles.participantsCountText}>{participants.length}</Text>
          </View>

          {/* Leave */}
          <Pressable
            onPress={handleLeave}
            style={({ pressed }) => [
              styles.controlBtn,
              styles.controlBtnDanger,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialIcons name="logout" size={24} color="#fff" />
            <Text style={styles.controlBtnLabel}>Leave</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const DISCORD_DARK = '#313338';
const DISCORD_SIDEBAR = '#2b2d31';
const DISCORD_CARD = '#383a40';
const DISCORD_MUTED = '#4f545c';
const DISCORD_RED = '#ed4245';
const DISCORD_GREEN = '#22c55e';
const DISCORD_BLUE = '#5865f2';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DISCORD_DARK },
  headerSafe: { backgroundColor: DISCORD_SIDEBAR },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DISCORD_GREEN },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', includeFontPadding: false },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DISCORD_RED,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  leaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', includeFontPadding: false },
  participantsScroll: { flex: 1 },
  participantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
    justifyContent: 'flex-start',
  },
  emptyRoom: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    width: '100%',
  },
  emptyRoomText: { color: 'rgba(255,255,255,0.4)', fontSize: 15, marginTop: 12, includeFontPadding: false },
  participantCard: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: DISCORD_CARD,
    borderRadius: 16,
    gap: 6,
  },
  avatarWrapper: { position: 'relative', borderRadius: 38, padding: 2 },
  selfRing: { borderWidth: 2, borderColor: DISCORD_BLUE },
  mutedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: DISCORD_RED,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: DISCORD_CARD,
  },
  participantName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    includeFontPadding: false,
  },
  participantUsername: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    includeFontPadding: false,
  },
  controls: { backgroundColor: DISCORD_SIDEBAR, paddingTop: 12, paddingHorizontal: 24 },
  controlsInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlBtn: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  controlBtnDefault: { backgroundColor: DISCORD_MUTED },
  controlBtnDanger: { backgroundColor: DISCORD_RED },
  controlBtnLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    includeFontPadding: false,
  },
  participantsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DISCORD_CARD,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  participantsCountText: { fontSize: 16, fontWeight: '700', color: '#fff', includeFontPadding: false },
});
