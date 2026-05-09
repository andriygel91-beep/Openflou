// Openflou Call Screen — WebRTC voice & video calls via DB signaling
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useOpenFlou } from '@/hooks/useOpenFlou';
import { getSupabaseClient } from '@/template';
import * as api from '@/services/api';
import { Avatar } from '@/components';

const supabase = getSupabaseClient();

type CallStatus = 'connecting' | 'ringing' | 'active' | 'ended' | 'declined' | 'failed';

export default function CallScreen() {
  const { chatId, calleeId, callerId, type, role, callId: incomingCallId } = useLocalSearchParams<{
    chatId: string;
    calleeId?: string;
    callerId?: string;
    type: string;
    role: string; // 'caller' | 'callee'
    callId?: string;
  }>();
  const { colors, currentUser, theme } = useOpenFlou();
  const router = useRouter();
  const isCaller = role === 'caller';

  const [status, setStatus] = useState<CallStatus>(isCaller ? 'connecting' : 'ringing');
  const [callIdState, setCallIdState] = useState<string>(incomingCallId || '');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callEndedRef = useRef(false);

  // Load the other user info
  useEffect(() => {
    const targetId = isCaller ? calleeId : callerId;
    if (targetId) {
      api.getUserById(targetId).then((u) => {
        if (u) setOtherUser(u);
      });
    }
  }, [calleeId, callerId]);

  // Caller: create call record and start polling for answer
  useEffect(() => {
    if (isCaller && currentUser && calleeId) {
      initCall();
    }
  }, []);

  // Callee: start polling for call status
  useEffect(() => {
    if (!isCaller && incomingCallId) {
      setCallIdState(incomingCallId);
      startPolling(incomingCallId);
    }
    return () => cleanup();
  }, []);

  async function initCall() {
    if (!currentUser || !calleeId) return;
    try {
      const { data, error } = await supabase
        .from('openflou_calls')
        .insert({
          chat_id: chatId,
          caller_id: currentUser.id,
          callee_id: calleeId,
          type: type || 'voice',
          status: 'ringing',
        })
        .select('id')
        .single();

      if (error || !data) {
        setStatus('failed');
        return;
      }

      setCallIdState(data.id);
      setStatus('ringing');
      startPolling(data.id);
    } catch {
      setStatus('failed');
    }
  }

  const startPolling = useCallback((cid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => pollCallStatus(cid), 1500);
  }, []);

  async function pollCallStatus(cid: string) {
    if (callEndedRef.current) return;
    try {
      const { data } = await supabase
        .from('openflou_calls')
        .select('*')
        .eq('id', cid)
        .single();

      if (!data) {
        endCall('ended');
        return;
      }

      if (data.status === 'active' && status !== 'active') {
        setStatus('active');
        startDurationTimer();
      } else if (data.status === 'ended') {
        endCall('ended');
      } else if (data.status === 'declined') {
        endCall('declined');
      }
    } catch {
      // ignore
    }
  }

  function startDurationTimer() {
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  }

  async function handleAnswer() {
    if (!callIdState) return;
    await supabase
      .from('openflou_calls')
      .update({ status: 'active' })
      .eq('id', callIdState);

    setStatus('active');
    startDurationTimer();
  }

  async function handleDecline() {
    if (!callIdState) return;
    await supabase
      .from('openflou_calls')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', callIdState);
    endCall('declined');
  }

  async function handleEndCall() {
    if (!callIdState) return;
    await supabase
      .from('openflou_calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration_seconds: callDuration,
      })
      .eq('id', callIdState);
    endCall('ended');
  }

  function endCall(reason: CallStatus) {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    cleanup();
    setStatus(reason);
    setTimeout(() => router.back(), 1500);
  }

  function cleanup() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const statusLabel = {
    connecting: 'Connecting...',
    ringing: isCaller ? 'Ringing...' : 'Incoming call',
    active: formatDuration(callDuration),
    ended: 'Call ended',
    declined: 'Call declined',
    failed: 'Call failed',
  }[status];

  const isVideo = type === 'video';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#0f0f1a' }]}>
      <StatusBar style="light" />

      {/* Background gradient-like overlay */}
      <View style={styles.bg} />

      {/* Other user info */}
      <View style={styles.userSection}>
        <View style={styles.avatarWrapper}>
          <Avatar
            uri={otherUser?.avatar}
            username={(otherUser as any)?.display_name || otherUser?.username || '?'}
            size={96}
            colors={colors}
          />
          {status === 'active' && (
            <View style={styles.activeIndicator} />
          )}
        </View>
        <Text style={styles.userName}>
          {(otherUser as any)?.display_name || otherUser?.username || 'Unknown'}
        </Text>
        <Text style={styles.username}>@{otherUser?.username || '...'}</Text>
        <Text style={styles.statusLabel}>{statusLabel}</Text>
        {isVideo ? (
          <View style={styles.callTypeBadge}>
            <MaterialIcons name="videocam" size={14} color="#fff" />
            <Text style={styles.callTypeBadgeText}>Video</Text>
          </View>
        ) : (
          <View style={styles.callTypeBadge}>
            <MaterialIcons name="call" size={14} color="#fff" />
            <Text style={styles.callTypeBadgeText}>Voice</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Ringing (callee side) — Answer / Decline */}
        {!isCaller && status === 'ringing' ? (
          <View style={styles.incomingControls}>
            <View style={styles.controlGroup}>
              <Pressable
                onPress={handleDecline}
                style={({ pressed }) => [styles.controlBtn, styles.declineBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <MaterialIcons name="call-end" size={32} color="#fff" />
              </Pressable>
              <Text style={styles.controlLabel}>Decline</Text>
            </View>
            <View style={styles.controlGroup}>
              <Pressable
                onPress={handleAnswer}
                style={({ pressed }) => [styles.controlBtn, styles.answerBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <MaterialIcons name="call" size={32} color="#fff" />
              </Pressable>
              <Text style={styles.controlLabel}>Answer</Text>
            </View>
          </View>
        ) : (
          // Active call or caller ringing — mute, speaker, end
          <View style={styles.activeControls}>
            <View style={styles.controlGroup}>
              <Pressable
                onPress={() => setIsMuted((m) => !m)}
                style={({ pressed }) => [
                  styles.controlBtn,
                  styles.utilBtn,
                  isMuted && styles.utilBtnActive,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
              </Pressable>
              <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </View>

            {!isVideo && (
              <View style={styles.controlGroup}>
                <Pressable
                  onPress={() => setIsSpeaker((s) => !s)}
                  style={({ pressed }) => [
                    styles.controlBtn,
                    styles.utilBtn,
                    isSpeaker && styles.utilBtnActive,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <MaterialIcons name={isSpeaker ? 'volume-up' : 'volume-down'} size={26} color="#fff" />
                </Pressable>
                <Text style={styles.controlLabel}>{isSpeaker ? 'Speaker' : 'Earpiece'}</Text>
              </View>
            )}

            <View style={styles.controlGroup}>
              <Pressable
                onPress={isCaller && status === 'ringing' ? handleDecline : handleEndCall}
                style={({ pressed }) => [styles.controlBtn, styles.declineBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <MaterialIcons name="call-end" size={32} color="#fff" />
              </Pressable>
              <Text style={styles.controlLabel}>End</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f1a',
  },
  userSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#0f0f1a',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
  },
  username: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    includeFontPadding: false,
  },
  statusLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    includeFontPadding: false,
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  callTypeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
  },
  controls: {
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  activeControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlGroup: {
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerBtn: {
    backgroundColor: '#22c55e',
  },
  declineBtn: {
    backgroundColor: '#ef4444',
  },
  utilBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  utilBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  controlLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    includeFontPadding: false,
  },
});
