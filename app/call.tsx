// Openflou Call Screen — Viber-style design with gradient background
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withSpring, FadeIn, FadeOut, ZoomIn,
} from 'react-native-reanimated';
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
  RTCView,
} from 'react-native-webrtc';

// ── Signaling helpers (Base64 encode/decode) ──
function encryptSDP(sdp: object): { enc: string; iv: string } {
  try {
    return { enc: btoa(unescape(encodeURIComponent(JSON.stringify(sdp)))), iv: '' };
  } catch {
    return { enc: btoa(JSON.stringify(sdp)), iv: '' };
  }
}
function decryptSDP(enc: string): object | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(enc)))); }
  catch { try { return JSON.parse(enc); } catch { return null; } }
}
function encryptCandidates(c: object[]): { enc: string; iv: string } { return encryptSDP(c); }
function decryptCandidates(enc: string): object[] {
  const r = decryptSDP(enc);
  return Array.isArray(r) ? r : [];
}

const supabase = getSupabaseClient();
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

type CallStatus = 'initializing' | 'ringing' | 'connecting' | 'active' | 'ended' | 'declined' | 'failed';

// ── Pulse ring animation for active calls ──
function PulseRing({ size, color }: { size: number; color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.35, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 900 }), withTiming(0.5, { duration: 900 })),
      -1
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    position: 'absolute',
    width: size + 24,
    height: size + 24,
    borderRadius: (size + 24) / 2,
    backgroundColor: color,
    top: -12,
    left: -12,
  }));
  return <Animated.View style={style} />;
}

// ── Control button ──
function CallButton({
  icon, label, onPress, color = 'rgba(255,255,255,0.18)', iconColor = '#fff', size = 64,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  iconColor?: string;
  size?: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={styles.btnCol}>
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.88, { damping: 15 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
          onPress={onPress}
          style={[styles.ctrlBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
        >
          <MaterialIcons name={icon} size={size * 0.38} color={iconColor} />
        </Pressable>
      </Animated.View>
      <Text style={styles.btnLabel}>{label}</Text>
    </View>
  );
}

export default function CallScreen() {
  const {
    chatId, calleeId, callerId, type, role, callId: incomingCallId,
  } = useLocalSearchParams<{
    chatId: string; calleeId?: string; callerId?: string;
    type?: string; role: string; callId?: string;
  }>();

  const { colors, currentUser } = useOpenFlou();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isCaller = role === 'caller';
  const isVideo = type === 'video';

  const [status, setStatus] = useState<CallStatus>('initializing');
  const [callIdState, setCallIdState] = useState<string>(incomingCallId || '');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callEndedRef = useRef(false);
  const answeringRef = useRef(false);
  const iceCandidatesRef = useRef<any[]>([]);
  const sentCandidatesRef = useRef<Set<string>>(new Set());
  const appliedCandidatesRef = useRef<Set<string>>(new Set());
  const offerSetRef = useRef(false);
  const answerSetRef = useRef(false);
  const callIdRef = useRef<string>(incomingCallId || '');
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => { callIdRef.current = callIdState; }, [callIdState]);

  useEffect(() => {
    const targetId = isCaller ? calleeId : callerId;
    if (targetId) api.getUserById(targetId).then((u) => { if (u) setOtherUser(u); });
  }, [calleeId, callerId]);

  useEffect(() => {
    initializeCall();
    return () => cleanup();
  }, []);

  async function initializeCall() {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: isVideo ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const remoteObj = new MediaStream(undefined);
      pc.addEventListener('track', (e: any) => {
        if (e?.track) {
          remoteObj.addTrack(e.track);
          setRemoteStream(new MediaStream([...remoteObj.getTracks()]));
        }
      });

      pc.addEventListener('icecandidate', async (e: any) => {
        const c = e?.candidate;
        if (c) {
          const key = `${c.sdpMid}_${c.sdpMLineIndex}_${c.candidate}`;
          if (!sentCandidatesRef.current.has(key)) {
            sentCandidatesRef.current.add(key);
            iceCandidatesRef.current.push(c.toJSON());
            const cid = callIdRef.current;
            if (cid) await pushLocalCandidates(cid);
          }
        }
      });

      pc.addEventListener('connectionstatechange', () => {
        const s = (pc as any).connectionState || '';
        if (s === 'connected') { setStatus('active'); startDurationTimer(); }
        else if (['failed', 'disconnected', 'closed'].includes(s)) {
          if (!callEndedRef.current) endCall('failed');
        }
      });

      if (isCaller) await startCallerFlow(pc);
      else await startCalleeFlow(pc);
    } catch (err) {
      console.error('Call init error:', err);
      setStatus('failed');
      setTimeout(() => router.back(), 2500);
    }
  }

  async function startCallerFlow(pc: RTCPeerConnection) {
    if (!currentUser || !calleeId) return;
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: isVideo } as any);
    await pc.setLocalDescription(offer);

    const { enc: offerEnc, iv: offerIv } = encryptSDP({ type: offer.type, sdp: offer.sdp });
    const { data, error } = await supabase.from('openflou_calls').insert({
      chat_id: chatId, caller_id: currentUser.id, callee_id: calleeId,
      type: type || 'voice', status: 'ringing',
      offer: { enc: offerEnc, iv: offerIv },
      caller_candidates: { enc: '', iv: '' }, callee_candidates: { enc: '', iv: '' },
    }).select('id').single();

    if (error || !data) { setStatus('failed'); return; }
    const cid = data.id;
    setCallIdState(cid); callIdRef.current = cid;
    setStatus('ringing');

    if (calleeId && currentUser) {
      const name = (currentUser as any).display_name || currentUser.username || 'Someone';
      api.sendCallPushNotification(calleeId, name, type || 'voice', chatId, cid, currentUser.id).catch(() => {});
    }
    startPollingAsCaller(cid, pc);
  }

  async function startCalleeFlow(pc: RTCPeerConnection) {
    const cid = incomingCallId;
    if (!cid) { setStatus('failed'); return; }
    setCallIdState(cid); callIdRef.current = cid;
    setStatus('ringing');
    try {
      const { data } = await supabase.from('openflou_calls').select('*').eq('id', cid).single();
      if (data?.offer) {
        const obj: any = data.offer.enc ? decryptSDP(data.offer.enc) : data.offer;
        if (obj) { await pc.setRemoteDescription(new RTCSessionDescription(obj)); offerSetRef.current = true; }
      }
    } catch (e) { console.error('Set offer error:', e); }
  }

  const answerCall = useCallback(async () => {
    if (answeringRef.current) return;
    answeringRef.current = true;
    const pc = pcRef.current;
    const cid = callIdRef.current || incomingCallId;
    if (!pc || !cid) { answeringRef.current = false; return; }
    setStatus('connecting');
    try {
      if (!offerSetRef.current) {
        const { data } = await supabase.from('openflou_calls').select('offer').eq('id', cid).single();
        if (data?.offer) {
          const obj = data.offer.enc ? decryptSDP(data.offer.enc) : data.offer;
          if (obj) { await pc.setRemoteDescription(new RTCSessionDescription(obj as any)); offerSetRef.current = true; }
        }
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const { enc, iv } = encryptSDP({ type: answer.type, sdp: answer.sdp });
      await supabase.from('openflou_calls').update({ status: 'active', answer: { enc, iv } }).eq('id', cid);
      await pushLocalCandidates(cid);
      startPollingAsCallee(cid, pc);
      await applyRemoteCandidates(cid, 'caller_candidates', pc);
    } catch (err) {
      console.error('Answer error:', err);
      setStatus('ringing');
      answeringRef.current = false;
    }
  }, [incomingCallId]);

  function startPollingAsCaller(cid: string, pc: RTCPeerConnection) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (callEndedRef.current) return;
      try {
        const { data } = await supabase.from('openflou_calls').select('*').eq('id', cid).single();
        if (!data) { endCall('ended'); return; }
        if (data.status === 'declined') { endCall('declined'); return; }
        if (data.status === 'ended') { endCall('ended'); return; }
        if (data.answer && !answerSetRef.current) {
          const sig = (pc as any).signalingState;
          if (sig === 'have-local-offer') {
            const obj = data.answer.enc ? decryptSDP(data.answer.enc) : data.answer;
            if (obj) { await pc.setRemoteDescription(new RTCSessionDescription(obj as any)); answerSetRef.current = true; }
          }
        }
        await applyRemoteCandidates(cid, 'callee_candidates', pc);
        await pushLocalCandidates(cid);
      } catch { /* ignore */ }
    }, 1200);
  }

  function startPollingAsCallee(cid: string, pc: RTCPeerConnection) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (callEndedRef.current) return;
      try {
        const { data } = await supabase.from('openflou_calls').select('status, caller_candidates').eq('id', cid).single();
        if (!data) { endCall('ended'); return; }
        if (data.status === 'ended' || data.status === 'declined') { endCall('ended'); return; }
        await applyRemoteCandidates(cid, 'caller_candidates', pc);
        await pushLocalCandidates(cid);
      } catch { /* ignore */ }
    }, 1200);
  }

  async function pushLocalCandidates(cid: string) {
    if (!cid || iceCandidatesRef.current.length === 0) return;
    const field = isCaller ? 'caller_candidates' : 'callee_candidates';
    try {
      const { enc, iv } = encryptCandidates(iceCandidatesRef.current);
      await supabase.from('openflou_calls').update({ [field]: { enc, iv } }).eq('id', cid);
    } catch { /* ignore */ }
  }

  async function applyRemoteCandidates(cid: string, field: string, pc: RTCPeerConnection) {
    try {
      const { data } = await supabase.from('openflou_calls').select(field).eq('id', cid).single();
      const raw = (data as any)?.[field];
      if (!raw) return;
      const candidates = raw.enc && raw.enc.length > 0 ? decryptCandidates(raw.enc) : (Array.isArray(raw) ? raw : []);
      if ((pc as any).signalingState === 'closed') return;
      for (const c of candidates) {
        const key = `${c.sdpMid}_${c.sdpMLineIndex}_${c.candidate}`;
        if (!appliedCandidatesRef.current.has(key)) {
          appliedCandidatesRef.current.add(key);
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* stale */ }
        }
      }
    } catch { /* ignore */ }
  }

  function startDurationTimer() {
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((m) => !m);
  }

  function toggleSpeaker() { setIsSpeaker((s) => !s); }

  function toggleCamera() {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = isCameraOff; });
    setIsCameraOff((c) => !c);
  }

  async function flipCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0] as any;
    if (track?._switchCamera) { track._switchCamera(); setIsFrontCamera((f) => !f); }
  }

  async function handleDecline() {
    const cid = callIdRef.current || incomingCallId;
    if (cid) await supabase.from('openflou_calls').update({ status: 'declined', ended_at: new Date().toISOString() }).eq('id', cid);
    endCall('declined');
  }

  async function handleEndCall() {
    const cid = callIdRef.current || incomingCallId;
    if (cid) await supabase.from('openflou_calls').update({ status: 'ended', ended_at: new Date().toISOString(), duration_seconds: callDuration }).eq('id', cid);
    endCall('ended');
  }

  function endCall(reason: CallStatus) {
    if (callEndedRef.current) return;
    callEndedRef.current = true;
    cleanup();
    setStatus(reason);
    setTimeout(() => router.back(), 1800);
  }

  function cleanup() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    try { pcRef.current?.close(); } catch { /* ignore */ }
  }

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const displayName = (otherUser as any)?.display_name || otherUser?.username || 'Unknown';
  const isActive = status === 'active';
  const isIncoming = !isCaller && status === 'ringing';
  const isConnecting = status === 'connecting';

  const statusText =
    status === 'ringing' ? (isCaller ? 'Calling...' : 'Incoming call')
    : status === 'connecting' ? 'Connecting...'
    : status === 'active' ? fmt(callDuration)
    : status === 'ended' ? 'Call ended'
    : status === 'declined' ? 'Declined'
    : 'Failed';

  // ── VIDEO CALL ──
  if (isVideo) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar style="light" hidden />
        {remoteStream ? (
          <RTCView streamURL={remoteStream.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" zOrder={0} />
        ) : (
          <LinearGradient colors={['#1a3a5c', '#2a6496', '#1a3a5c']} style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ position: 'relative' }}>
                {isActive ? <PulseRing size={100} color="rgba(52,199,89,0.4)" /> : null}
                <Avatar uri={otherUser?.avatar} username={displayName} size={100} colors={colors} />
              </View>
            </View>
          </LinearGradient>
        )}
        {localStream && !isCameraOff ? (
          <View style={styles.localVideo}>
            <RTCView streamURL={localStream.toURL()} style={{ flex: 1 }} objectFit="cover" mirror={isFrontCamera} zOrder={1} />
          </View>
        ) : null}
        <View style={[styles.videoTop, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.videoName}>{displayName}</Text>
          <Text style={[styles.videoStatus, isActive && { color: '#34C759' }]}>{statusText}</Text>
        </View>
        <View style={[styles.videoBottom, { paddingBottom: insets.bottom + 24 }]}>
          {isIncoming ? (
            <View style={styles.answerRow}>
              <CallButton icon="call-end" label="Decline" onPress={handleDecline} color="#ef4444" size={72} />
              <CallButton icon="call" label="Answer" onPress={answerCall} color="#22c55e" size={72} />
            </View>
          ) : (
            <View style={styles.controlRow}>
              <CallButton icon={isSpeaker ? 'volume-up' : 'volume-down'} label="Speaker" onPress={toggleSpeaker} color={isSpeaker ? '#34C759' : 'rgba(255,255,255,0.18)'} />
              <CallButton icon={isCameraOff ? 'videocam-off' : 'videocam'} label={isCameraOff ? 'Enable' : 'Video'} onPress={toggleCamera} color={isCameraOff ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.18)'} />
              <CallButton icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'} onPress={toggleMute} color={isMuted ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.18)'} />
              <CallButton icon="call-end" label="End" onPress={isCaller && status === 'ringing' ? handleDecline : handleEndCall} color="#ef4444" />
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── VOICE CALL — Viber-style ──
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      {/* Gradient background — matches image */}
      <LinearGradient
        colors={['#3A7BD5', '#5B9BD5', '#3A5FBD', '#2A3FA8']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top bar — minimize icon */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.minimizeBtn}>
          <MaterialIcons name="close-fullscreen" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      {/* Center — avatar + name + status */}
      <View style={styles.centerSection}>
        {/* Avatar with pulse ring */}
        <View style={styles.avatarWrapper}>
          {/* Outer glow ring */}
          <View style={styles.outerRing} />
          {/* Inner ring */}
          <View style={styles.innerRing} />
          {isActive ? <PulseRing size={120} color="rgba(255,255,255,0.25)" /> : null}
          <Avatar uri={otherUser?.avatar} username={displayName} size={120} colors={colors} />
        </View>

        <Text style={styles.callerName}>{displayName}</Text>
        <Text style={[styles.callStatus, isActive && { fontVariant: ['tabular-nums'] }]}>
          {statusText}
          {!isActive && status === 'ringing' && isCaller ? ' •••' : ''}
        </Text>

        {/* Encryption badge */}
        <View style={styles.encryptBadge}>
          <MaterialIcons name="lock" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={styles.encryptText}>E2E encrypted</Text>
        </View>
      </View>

      {/* Mute status pill */}
      {isMuted ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.mutePill}>
          <MaterialIcons name="mic-off" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.muteText}>Your microphone is off</Text>
        </Animated.View>
      ) : null}

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 24 }]}>
        {isIncoming ? (
          /* Incoming call — two large buttons */
          <View style={styles.answerRow}>
            <View style={styles.btnCol}>
              <Pressable onPress={handleDecline} style={[styles.answerBtn, { backgroundColor: '#ef4444' }]}>
                <MaterialIcons name="call-end" size={34} color="#fff" />
              </Pressable>
              <Text style={styles.btnLabel}>Decline</Text>
            </View>
            <View style={styles.btnCol}>
              <Pressable onPress={answerCall} style={[styles.answerBtn, { backgroundColor: '#22c55e' }]}>
                <MaterialIcons name="call" size={34} color="#fff" />
              </Pressable>
              <Text style={styles.btnLabel}>Answer</Text>
            </View>
          </View>
        ) : isConnecting ? (
          <View style={styles.connectingRow}>
            <Text style={styles.connectingText}>Setting up connection...</Text>
          </View>
        ) : (
          /* Active / Calling — 4-button row like Viber */
          <View style={styles.controlRow}>
            <CallButton
              icon={isSpeaker ? 'volume-up' : 'volume-down'}
              label="Speaker"
              onPress={toggleSpeaker}
              color={isSpeaker ? '#34C759' : 'rgba(255,255,255,0.18)'}
            />
            <CallButton
              icon={isCameraOff ? 'videocam-off' : 'videocam'}
              label="Enable video"
              onPress={toggleCamera}
              color="rgba(255,255,255,0.18)"
            />
            <CallButton
              icon={isMuted ? 'mic-off' : 'mic'}
              label={isMuted ? 'Enable mic' : 'Disable mic'}
              onPress={toggleMute}
              color={isMuted ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.18)'}
            />
            <CallButton
              icon="call-end"
              label="End"
              onPress={isCaller && status === 'ringing' ? handleDecline : handleEndCall}
              color="#ef4444"
              size={68}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  minimizeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  avatarWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  outerRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -20,
    left: -20,
  },
  innerRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -10,
    left: -10,
  },
  callerName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.75)',
    includeFontPadding: false,
    fontWeight: '400',
    marginBottom: 12,
  },
  encryptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  encryptText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    includeFontPadding: false,
  },
  mutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 20,
  },
  muteText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    includeFontPadding: false,
  },
  bottomControls: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  answerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 40,
  },
  connectingRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  connectingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    includeFontPadding: false,
  },
  btnCol: {
    alignItems: 'center',
    gap: 8,
  },
  ctrlBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    includeFontPadding: false,
    textAlign: 'center',
  },
  answerBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Video
  localVideo: {
    position: 'absolute',
    top: 72,
    right: 16,
    width: 96,
    height: 144,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 8,
    zIndex: 10,
  },
  videoTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 5,
  },
  videoName: { fontSize: 24, fontWeight: '700', color: '#fff', includeFontPadding: false },
  videoStatus: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 3, includeFontPadding: false },
  videoBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 5,
  },
});
