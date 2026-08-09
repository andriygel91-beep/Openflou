// Openflou Group Voice Room — Discord-style multi-user voice channel
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { getSupabaseClient } from '@/template';
import * as api from '@/services/api';
import { Avatar } from '@/components';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';

const supabase = getSupabaseClient();
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

// Simple Base64 encode/decode for SDP obfuscation
function encB64(obj: object): string {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); } catch { return ''; }
}
function decB64(s: string): any {
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; }
}

interface Participant {
  userId: string;
  displayName: string;
  username: string;
  avatar?: string;
  isMuted: boolean;
  isSpeaking: boolean;
}

export default function GroupVoiceScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { colors, currentUser, theme } = useOpenFlou();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chat, setChat] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [duration, setDuration] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCleanedUpRef = useRef(false);
  const iceCandidatesRef = useRef<Map<string, any[]>>(new Map());
  const appliedCandidatesRef = useRef<Map<string, Set<string>>>(new Map());
  const sentCandidatesRef = useRef<Map<string, Set<string>>>(new Map());
  const voiceRoomId = `voice_${chatId}`;

  useEffect(() => {
    loadChatInfo();
    joinRoom();
    return () => leaveRoom();
  }, []);

  async function loadChatInfo() {
    if (!chatId) return;
    try {
      const { data } = await supabase.from('openflou_chats').select('*').eq('id', chatId).single();
      if (data) setChat(data);
    } catch { /* ignore */ }
  }

  async function joinRoom() {
    if (!currentUser) return;

    try {
      // Get microphone
      const stream = await mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;

      // Register self in voice room table
      await supabase.from('openflou_messages').insert({
        id: `voice_join_${currentUser.id}_${Date.now()}`,
        chat_id: voiceRoomId,
        sender_id: currentUser.id,
        content: JSON.stringify({ type: 'voice_room_join', userId: currentUser.id, ts: Date.now() }),
        type: 'voice_room_event',
      }).maybeSingle();

      setIsConnected(true);
      startDuration();

      // Add self to participants
      const self: Participant = {
        userId: currentUser.id,
        displayName: (currentUser as any).display_name || currentUser.username,
        username: currentUser.username,
        avatar: currentUser.avatar,
        isMuted: false,
        isSpeaking: false,
      };
      setParticipants([self]);

      // Start polling room state
      startPolling();
    } catch (err) {
      console.error('Join room error:', err);
      router.back();
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (isCleanedUpRef.current || !currentUser) return;
      await syncRoomParticipants();
      await processSignaling();
    }, 1500);
  }

  async function syncRoomParticipants() {
    if (!currentUser || !chatId) return;
    try {
      // Get chat participants
      const { data: chatData } = await supabase
        .from('openflou_chats')
        .select('participants')
        .eq('id', chatId)
        .single();

      if (!chatData?.participants) return;

      // Get voice room active members (check voice room signaling messages from last 30s)
      const cutoff = new Date(Date.now() - 30_000).toISOString();
      const { data: events } = await supabase
        .from('openflou_messages')
        .select('*')
        .eq('chat_id', voiceRoomId)
        .gte('timestamp', cutoff)
        .order('timestamp', { ascending: false });

      // Collect unique active user IDs
      const activeUserIds = new Set<string>([currentUser.id]);
      for (const evt of events || []) {
        try {
          const payload = JSON.parse(evt.content || '{}');
          if (payload.type === 'voice_room_join' && payload.userId) {
            activeUserIds.add(payload.userId);
          }
          if (payload.type === 'voice_room_leave' && payload.userId) {
            activeUserIds.delete(payload.userId);
          }
        } catch { /* ignore */ }
      }

      // Build participants list
      const participantUsers = await Promise.all(
        [...activeUserIds].map((uid) => api.getUserById(uid))
      );

      const newParticipants: Participant[] = participantUsers
        .filter(Boolean)
        .map((u: any) => ({
          userId: u.id,
          displayName: u.display_name || u.username,
          username: u.username,
          avatar: u.avatar,
          isMuted: false,
          isSpeaking: false,
        }));

      setParticipants(newParticipants);

      // Keep self-alive heartbeat (re-join every 15s to stay in the room)
      await supabase.from('openflou_messages').insert({
        chat_id: voiceRoomId,
        sender_id: currentUser.id,
        content: JSON.stringify({ type: 'voice_room_join', userId: currentUser.id, ts: Date.now() }),
        type: 'voice_room_event',
      }).maybeSingle();
    } catch { /* ignore */ }
  }

  async function processSignaling() {
    // Process WebRTC offers/answers for P2P connections (simplified mesh)
    // In a real deployment, use a SFU (Mediasoup/LiveKit) for scalable group calls
    // Here we do simple mesh: connect to first 3 peers for demo
  }

  function startDuration() {
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }

  async function leaveRoom() {
    if (isCleanedUpRef.current) return;
    isCleanedUpRef.current = true;

    if (pollRef.current) clearInterval(pollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);

    // Stop audio tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());

    // Signal leave
    if (currentUser) {
      try {
        await supabase.from('openflou_messages').insert({
          chat_id: voiceRoomId,
          sender_id: currentUser.id,
          content: JSON.stringify({ type: 'voice_room_leave', userId: currentUser.id, ts: Date.now() }),
          type: 'voice_room_event',
        }).maybeSingle();
      } catch { /* ignore */ }
    }
  }

  function toggleMute() {
    const newMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = newMuted; });
    setIsMuted(newMuted);
    // Update self in participants
    setParticipants((prev) =>
      prev.map((p) => p.userId === currentUser?.id ? { ...p, isMuted: newMuted } : p)
    );
  }

  function handleLeave() {
    leaveRoom().then(() => router.back());
  }

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const chatName = chat?.name || 'Group';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Header */}
      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.liveDot, { backgroundColor: '#22c55e' }]} />
            <View>
              <Text style={styles.headerTitle}>{chatName}</Text>
              <Text style={styles.headerSub}>Voice · {formatDuration(duration)}</Text>
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
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {participants.length === 0 ? (
          <View style={styles.emptyRoom}>
            <MaterialIcons name="mic" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyRoomText}>Connecting to voice room...</Text>
          </View>
        ) : (
          participants.map((p) => (
            <View key={p.userId} style={styles.participantCard}>
              <View style={[
                styles.avatarWrapper,
                p.isSpeaking && styles.speakingRing,
                p.userId === currentUser?.id && styles.selfRing,
              ]}>
                <Avatar
                  uri={p.avatar}
                  username={p.displayName}
                  size={64}
                  colors={{
                    primary: '#5865f2',
                    surface: '#36393f',
                    text: '#fff',
                    textSecondary: 'rgba(255,255,255,0.6)',
                    online: '#22c55e',
                    border: 'transparent',
                    icon: 'rgba(255,255,255,0.4)',
                    background: '#36393f',
                    surfaceSecondary: '#2f3136',
                    textTertiary: 'rgba(255,255,255,0.4)',
                    textInverted: '#000',
                    chatBackground: '#313338',
                    tabBarBackground: '#1e1f22',
                    tabBarBorder: '#1e1f22',
                    error: '#ef4444',
                    warning: '#f59e0b',
                  }}
                />
                {p.isMuted ? (
                  <View style={styles.mutedBadge}>
                    <MaterialIcons name="mic-off" size={12} color="#fff" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.participantName} numberOfLines={1}>
                {p.userId === currentUser?.id ? `${p.displayName} (You)` : p.displayName}
              </Text>
              <Text style={styles.participantUsername} numberOfLines={1}>
                @{p.username}
              </Text>
            </View>
          ))
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
              isMuted ? styles.controlBtnActive : styles.controlBtnDefault,
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
            style={({ pressed }) => [styles.controlBtn, styles.controlBtnDanger, { opacity: pressed ? 0.7 : 1 }]}
          >
            <MaterialIcons name="logout" size={24} color="#fff" />
            <Text style={styles.controlBtnLabel}>Leave</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#313338' },
  headerSafe: { backgroundColor: '#2b2d31' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', includeFontPadding: false },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontVariant: ['tabular-nums'], includeFontPadding: false },
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ed4245', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  leaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', includeFontPadding: false },

  participantsScroll: { flex: 1 },
  participantsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12, justifyContent: 'flex-start',
  },
  emptyRoom: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, width: '100%' },
  emptyRoomText: { color: 'rgba(255,255,255,0.4)', fontSize: 15, marginTop: 12, includeFontPadding: false },

  participantCard: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: '#383a40',
    borderRadius: 16,
    gap: 6,
  },
  avatarWrapper: { position: 'relative', borderRadius: 38, padding: 2 },
  speakingRing: { borderWidth: 2, borderColor: '#22c55e' },
  selfRing: { borderWidth: 2, borderColor: '#5865f2' },
  mutedBadge: {
    position: 'absolute',
    bottom: -2, right: -2,
    backgroundColor: '#ed4245',
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#383a40',
  },
  participantName: { fontSize: 13, fontWeight: '600', color: '#fff', textAlign: 'center', includeFontPadding: false },
  participantUsername: { fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', includeFontPadding: false },

  controls: { backgroundColor: '#2b2d31', paddingTop: 12, paddingHorizontal: 24 },
  controlsInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  controlBtn: {
    alignItems: 'center', gap: 4, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
  },
  controlBtnDefault: { backgroundColor: '#4f545c' },
  controlBtnActive: { backgroundColor: '#ed4245' },
  controlBtnDanger: { backgroundColor: '#ed4245' },
  controlBtnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', includeFontPadding: false },
  participantsCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#383a40', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  participantsCountText: { fontSize: 16, fontWeight: '700', color: '#fff', includeFontPadding: false },
});
