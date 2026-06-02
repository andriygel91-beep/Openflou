// Openflou Call Screen — Real WebRTC voice/video calls via DB signaling
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';

const supabase = getSupabaseClient();

// STUN servers (public Google STUN for NAT traversal)
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

type CallStatus = 'initializing' | 'ringing' | 'active' | 'ended' | 'declined' | 'failed';

export default function CallScreen() {
  const {
    chatId, calleeId, callerId, type, role, callId: incomingCallId,
  } = useLocalSearchParams<{
    chatId: string;
    calleeId?: string;
    callerId?: string;
    type?: string;
    role: string;
    callId?: string;
  }>();

  const { colors, currentUser, theme } = useOpenFlou();
  const router = useRouter();
  const isCaller = role === 'caller';
  const isVideo = type === 'video';

  const [status, setStatus] = useState<CallStatus>('initializing');
  const [callIdState, setCallIdState] = useState<string>(incomingCallId || '');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [connectionState, setConnectionState] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callEndedRef = useRef(false);
  const iceCandidatesRef = useRef<any[]>([]);
  const sentCandidatesRef = useRef<Set<string>>(new Set());

  // Load other user info
  useEffect(() => {
    const targetId = isCaller ? calleeId : callerId;
    if (targetId) {
      api.getUserById(targetId).then((u) => { if (u) setOtherUser(u); });
    }
  }, [calleeId, callerId]);

  // Initialize call
  useEffect(() => {
    initializeCall();
    return () => cleanup(false);
  }, []);

  async function initializeCall() {
    try {
      // Request microphone (+ camera if video)
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: 'user', width: 640, height: 480 } : false,
      });
      localStreamRef.current = stream;

      // Create peer connection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // ICE candidate handler
      pc.addEventListener('icecandidate', async (event: any) => {
        const candidate = event?.candidate;
        if (candidate) {
          const key = `${candidate.sdpMid}_${candidate.sdpMLineIndex}_${candidate.candidate}`;
          if (!sentCandidatesRef.current.has(key)) {
            sentCandidatesRef.current.add(key);
            iceCandidatesRef.current.push(candidate.toJSON());
            await pushLocalCandidates(callIdState || incomingCallId || '');
          }
        }
      });

      // Connection state change
      pc.addEventListener('connectionstatechange', () => {
        const state = (pc as any).connectionState || '';
        setConnectionState(state);
        if (state === 'connected') {
          setStatus('active');
          startDurationTimer();
        } else if (state === 'failed' || state === 'disconnected') {
          if (!callEndedRef.current) endCall('failed');
        }
      });

      if (isCaller) {
        await startCallerFlow(pc);
      } else {
        await startCalleeFlow(pc);
      }
    } catch (err: any) {
      console.error('Call init error:', err);
      setStatus('failed');
      setTimeout(() => router.back(), 2000);
    }
  }

  // ── CALLER FLOW ──
  async function startCallerFlow(pc: RTCPeerConnection) {
    if (!currentUser || !calleeId) return;

    // Create offer
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: isVideo });
    await pc.setLocalDescription(offer);

    // Insert call record with offer
    const { data, error } = await supabase
      .from('openflou_calls')
      .insert({
        chat_id: chatId,
        caller_id: currentUser.id,
        callee_id: calleeId,
        type: type || 'voice',
        status: 'ringing',
        offer: { type: offer.type, sdp: offer.sdp },
        caller_candidates: [],
        callee_candidates: [],
      })
      .select('id')
      .single();

    if (error || !data) {
      setStatus('failed');
      return;
    }

    setCallIdState(data.id);
    setStatus('ringing');
    startPollingAsCallee(data.id, pc);
  }

  // ── CALLEE FLOW ──
  async function startCalleeFlow(pc: RTCPeerConnection) {
    const cid = incomingCallId;
    if (!cid) { setStatus('failed'); return; }
    setCallIdState(cid);
    setStatus('ringing');

    // Fetch call record to get offer
    const { data } = await supabase
      .from('openflou_calls')
      .select('*')
      .eq('id', cid)
      .single();

    if (!data?.offer) {
      setStatus('failed');
      return;
    }

    // Set remote description (offer from caller)
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

    // Remote track handler (incoming audio/video from caller)
    pc.addEventListener('track', () => {
      // Audio plays automatically via WebRTC; video would need a ref
    });

    // Wait for user to press Answer
    // startCalleeAnswerFlow will be called from handleAnswer
  }

  // Called when callee presses Answer
  async function answerCall() {
    const pc = pcRef.current;
    const cid = callIdState || incomingCallId;
    if (!pc || !cid) return;

    try {
      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Update call record with answer
      await supabase
        .from('openflou_calls')
        .update({
          status: 'active',
          answer: { type: answer.type, sdp: answer.sdp },
        })
        .eq('id', cid);

      setStatus('active');
      startDurationTimer();
      startPollingAsCaller(cid, pc);

      // Add caller's existing ICE candidates
      await applyRemoteCandidates(cid, 'caller_candidates', pc);
    } catch (err) {
      console.error('Answer error:', err);
      setStatus('failed');
    }
  }

  // Caller polls for answer + callee candidates
  function startPollingAsCallee(cid: string, pc: RTCPeerConnection) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (callEndedRef.current) return;
      try {
        const { data } = await supabase
          .from('openflou_calls')
          .select('*')
          .eq('id', cid)
          .single();

        if (!data) { endCall('ended'); return; }

        if (data.status === 'declined') { endCall('declined'); return; }
        if (data.status === 'ended') { endCall('ended'); return; }

        // Got answer — set remote description
        if (data.answer && (pc as any).signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

          // Remote track handler
          pc.addEventListener('track', () => {
            // Audio auto-plays
          });
        }

        // Apply callee ICE candidates
        await applyRemoteCandidates(cid, 'callee_candidates', pc);

        // Push our own candidates
        await pushLocalCandidates(cid);
      } catch { /* ignore */ }
    }, 1500);
  }

  // Callee polls for caller candidates after answering
  function startPollingAsCaller(cid: string, pc: RTCPeerConnection) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (callEndedRef.current) return;
      try {
        const { data } = await supabase
          .from('openflou_calls')
          .select('status, caller_candidates')
          .eq('id', cid)
          .single();

        if (!data || data.status === 'ended') { endCall('ended'); return; }

        await applyRemoteCandidates(cid, 'caller_candidates', pc);
        await pushLocalCandidates(cid);
      } catch { /* ignore */ }
    }, 1500);
  }

  // Push local ICE candidates to DB
  async function pushLocalCandidates(cid: string) {
    if (!cid || iceCandidatesRef.current.length === 0) return;
    const field = isCaller ? 'caller_candidates' : 'callee_candidates';
    try {
      await supabase
        .from('openflou_calls')
        .update({ [field]: iceCandidatesRef.current })
        .eq('id', cid);
    } catch { /* ignore */ }
  }

  // Track which remote candidates we've already applied
  const appliedCandidatesRef = useRef<Set<string>>(new Set());

  async function applyRemoteCandidates(cid: string, field: string, pc: RTCPeerConnection) {
    try {
      const { data } = await supabase
        .from('openflou_calls')
        .select(field)
        .eq('id', cid)
        .single();

      const candidates: any[] = (data as any)?.[field] || [];
      for (const c of candidates) {
        const key = `${c.sdpMid}_${c.sdpMLineIndex}_${c.candidate}`;
        if (!appliedCandidatesRef.current.has(key)) {
          appliedCandidatesRef.current.add(key);
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch { /* ignore stale candidates */ }
        }
      }
    } catch { /* ignore */ }
  }

  function startDurationTimer() {
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = isMuted; // toggle: if currently muted, enable; if not, disable
    });
    setIsMuted((m) => !m);
  }

  async function handleAnswer() {
    await answerCall();
  }

  async function handleDecline() {
    const cid = callIdState || incomingCallId;
    if (cid) {
      await supabase
        .from('openflou_calls')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', cid);
    }
    endCall('declined');
  }

  async function handleEndCall() {
    const cid = callIdState || incomingCallId;
    if (cid) {
      await supabase
        .from('openflou_calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration_seconds: callDuration,
        })
        .eq('id', cid);
    }
    endCall('ended');
  }

  function endCall(reason: CallStatus) {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    cleanup(true);
    setStatus(reason);
    setTimeout(() => router.back(), 1800);
  }

  function cleanup(stopStream: boolean) {
    if (pollRef.current) clearInterval(pollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    if (stopStream) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    }
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const statusLabel: Record<CallStatus, string> = {
    initializing: 'Connecting...',
    ringing: isCaller ? 'Calling...' : 'Incoming call',
    active: formatDuration(callDuration),
    ended: 'Call ended',
    declined: 'Call declined',
    failed: 'Call failed',
  };

  const displayName = otherUser?.display_name || otherUser?.username || 'Unknown';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.bg} />

      {/* Caller info */}
      <View style={styles.userSection}>
        <View style={styles.avatarRing}>
          <Avatar
            uri={otherUser?.avatar}
            username={displayName}
            size={100}
            colors={colors}
          />
          {status === 'active' && <View style={styles.activeRing} />}
        </View>

        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.usernameText}>@{otherUser?.username || '...'}</Text>

        <Text style={[
          styles.statusLabel,
          status === 'active' && styles.statusActive,
          (status === 'ended' || status === 'declined' || status === 'failed') && styles.statusEnded,
        ]}>
          {statusLabel[status]}
        </Text>

        <View style={styles.callTypeBadge}>
          <MaterialIcons name={isVideo ? 'videocam' : 'call'} size={13} color="#fff" />
          <Text style={styles.callTypeBadgeText}>{isVideo ? 'Video call' : 'Voice call'}</Text>
        </View>

        {connectionState === 'connecting' && status === 'active' ? (
          <Text style={styles.connectionHint}>Establishing connection...</Text>
        ) : null}
      </View>

      {/* Controls */}
      <View style={styles.controlsArea}>
        {/* Callee ringing — Answer / Decline */}
        {!isCaller && status === 'ringing' ? (
          <View style={styles.incomingRow}>
            <View style={styles.controlCol}>
              <Pressable
                onPress={handleDecline}
                style={({ pressed }) => [styles.ctrlBtn, styles.declineBtn, { opacity: pressed ? 0.75 : 1 }]}
              >
                <MaterialIcons name="call-end" size={30} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>Decline</Text>
            </View>
            <View style={styles.controlCol}>
              <Pressable
                onPress={handleAnswer}
                style={({ pressed }) => [styles.ctrlBtn, styles.answerBtn, { opacity: pressed ? 0.75 : 1 }]}
              >
                <MaterialIcons name="call" size={30} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>Answer</Text>
            </View>
          </View>
        ) : (
          <View style={styles.activeRow}>
            {/* Mute */}
            <View style={styles.controlCol}>
              <Pressable
                onPress={toggleMute}
                style={({ pressed }) => [
                  styles.ctrlBtn,
                  styles.utilBtn,
                  isMuted && styles.utilBtnOn,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </View>

            {/* Speaker */}
            {!isVideo ? (
              <View style={styles.controlCol}>
                <Pressable
                  onPress={() => setIsSpeaker((s) => !s)}
                  style={({ pressed }) => [
                    styles.ctrlBtn,
                    styles.utilBtn,
                    isSpeaker && styles.utilBtnOn,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <MaterialIcons name={isSpeaker ? 'volume-up' : 'volume-down'} size={24} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>{isSpeaker ? 'Speaker' : 'Earpiece'}</Text>
              </View>
            ) : null}

            {/* End call */}
            <View style={styles.controlCol}>
              <Pressable
                onPress={isCaller && status === 'ringing' ? handleDecline : handleEndCall}
                style={({ pressed }) => [styles.ctrlBtn, styles.declineBtn, { opacity: pressed ? 0.75 : 1 }]}
              >
                <MaterialIcons name="call-end" size={30} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>End</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0d1117' },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d1117',
  },
  userSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  avatarRing: { position: 'relative', marginBottom: 12 },
  activeRing: {
    position: 'absolute',
    inset: -6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#22c55e',
    width: 112,
    height: 112,
    top: -6,
    left: -6,
  },
  userName: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
    textAlign: 'center',
  },
  usernameText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    includeFontPadding: false,
  },
  statusLabel: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 10,
    includeFontPadding: false,
    fontWeight: '500',
  },
  statusActive: { color: '#22c55e', fontVariant: ['tabular-nums'] },
  statusEnded: { color: '#ef4444' },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 8,
  },
  callTypeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
  },
  connectionHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 6,
    includeFontPadding: false,
  },
  controlsArea: {
    paddingBottom: 52,
    paddingHorizontal: 32,
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlCol: {
    alignItems: 'center',
    gap: 10,
  },
  ctrlBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerBtn: { backgroundColor: '#22c55e' },
  declineBtn: { backgroundColor: '#ef4444' },
  utilBtn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  utilBtnOn: { backgroundColor: 'rgba(255,255,255,0.35)' },
  ctrlLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    includeFontPadding: false,
  },
});
