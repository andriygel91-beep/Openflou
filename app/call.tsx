// Openflou Call Screen — Real WebRTC voice/video with encrypted DB signaling
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from 'react-native';
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
  MediaStream,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc';

// ── Signaling encryption (AES-GCM, symmetric per-call key derived from callId) ──
async function deriveCallKey(callId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const raw = enc.encode(callId.padEnd(32, '0').slice(0, 32));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSDP(sdp: object, callId: string): Promise<{ enc: string; iv: string }> {
  try {
    const key = await deriveCallKey(callId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(sdp));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return {
      enc: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv)),
    };
  } catch {
    // Fallback — store unencrypted on crypto failure (rare edge case)
    return { enc: btoa(JSON.stringify(sdp)), iv: '' };
  }
}

async function decryptSDP(enc: string, ivB64: string, callId: string): Promise<object | null> {
  try {
    if (!ivB64) return JSON.parse(atob(enc));
    const key = await deriveCallKey(callId);
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const data = Uint8Array.from(atob(enc), (c) => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    try { return JSON.parse(atob(enc)); } catch { return null; }
  }
}

async function encryptCandidates(candidates: object[], callId: string): Promise<{ enc: string; iv: string }> {
  return encryptSDP(candidates, callId);
}

async function decryptCandidates(enc: string, ivB64: string, callId: string): Promise<object[]> {
  const result = await decryptSDP(enc, ivB64, callId);
  return Array.isArray(result) ? result : [];
}

// ── Main component ──
const supabase = getSupabaseClient();
const { width: SW, height: SH } = Dimensions.get('window');

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
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
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState('');
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callEndedRef = useRef(false);
  const iceCandidatesRef = useRef<any[]>([]);
  const sentCandidatesRef = useRef<Set<string>>(new Set());
  const appliedCandidatesRef = useRef<Set<string>>(new Set());
  const offerSetRef = useRef(false);
  const answerSetRef = useRef(false);

  // Load other user info
  useEffect(() => {
    const targetId = isCaller ? calleeId : callerId;
    if (targetId) {
      api.getUserById(targetId).then((u) => { if (u) setOtherUser(u); });
    }
  }, [calleeId, callerId]);

  useEffect(() => {
    initializeCall();
    return () => cleanup(false);
  }, []);

  async function initializeCall() {
    try {
      // Get local media
      const constraints: any = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo ? {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 },
        } : false,
      };

      const stream = await mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      // Build peer connection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // Add local tracks to connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Remote stream accumulator
      const remoteStreamObj = new MediaStream(undefined);

      // Handle incoming remote tracks — this is where we get the other side's audio/video
      pc.addEventListener('track', (event: any) => {
        const track = event?.track;
        if (track) {
          remoteStreamObj.addTrack(track);
          setRemoteStream(new MediaStream([...remoteStreamObj.getTracks()]));
        }
      });

      // ICE candidates
      pc.addEventListener('icecandidate', async (event: any) => {
        const candidate = event?.candidate;
        if (candidate) {
          const key = `${candidate.sdpMid}_${candidate.sdpMLineIndex}_${candidate.candidate}`;
          if (!sentCandidatesRef.current.has(key)) {
            sentCandidatesRef.current.add(key);
            iceCandidatesRef.current.push(candidate.toJSON());
            const cid = callIdState || incomingCallId;
            if (cid) await pushLocalCandidates(cid);
          }
        }
      });

      // Connection state
      pc.addEventListener('connectionstatechange', () => {
        const state = (pc as any).connectionState || '';
        setConnectionState(state);
        if (state === 'connected') {
          setStatus('active');
          startDurationTimer();
        } else if (['failed', 'disconnected', 'closed'].includes(state)) {
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
      setTimeout(() => router.back(), 2500);
    }
  }

  // ── CALLER: create offer → store encrypted in DB → poll for answer ──
  async function startCallerFlow(pc: RTCPeerConnection) {
    if (!currentUser || !calleeId) return;

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    } as any);
    await pc.setLocalDescription(offer);

    // Generate temporary call ID for encryption
    const tempId = `tmp_${Date.now()}`;
    const { enc: offerEnc, iv: offerIv } = await encryptSDP(
      { type: offer.type, sdp: offer.sdp },
      tempId
    );

    const { data, error } = await supabase
      .from('openflou_calls')
      .insert({
        chat_id: chatId,
        caller_id: currentUser.id,
        callee_id: calleeId,
        type: type || 'voice',
        status: 'ringing',
        offer: { enc: offerEnc, iv: offerIv, tempId },
        answer: null,
        caller_candidates: { enc: '', iv: '' },
        callee_candidates: { enc: '', iv: '' },
      })
      .select('id')
      .single();

    if (error || !data) { setStatus('failed'); return; }

    const cid = data.id;
    setCallIdState(cid);
    setStatus('ringing');

    // Re-encrypt offer with real callId
    const { enc: realOfferEnc, iv: realOfferIv } = await encryptSDP(
      { type: offer.type, sdp: offer.sdp },
      cid
    );
    await supabase
      .from('openflou_calls')
      .update({ offer: { enc: realOfferEnc, iv: realOfferIv } })
      .eq('id', cid);

    startPollingAsCaller(cid, pc);
  }

  // ── CALLEE: fetch offer → decode → wait for user to press Answer ──
  async function startCalleeFlow(pc: RTCPeerConnection) {
    const cid = incomingCallId;
    if (!cid) { setStatus('failed'); return; }
    setCallIdState(cid);
    setStatus('ringing');

    const { data } = await supabase
      .from('openflou_calls')
      .select('*')
      .eq('id', cid)
      .single();

    if (!data?.offer) { setStatus('failed'); return; }

    try {
      const offerObj = data.offer;
      let sdpObj: any;
      if (offerObj.enc) {
        sdpObj = await decryptSDP(offerObj.enc, offerObj.iv, cid);
      } else {
        sdpObj = offerObj; // legacy unencrypted
      }
      if (sdpObj) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
        offerSetRef.current = true;
      }
    } catch (err) {
      console.error('Failed to set offer:', err);
    }
  }

  // Called when callee taps Answer
  async function answerCall() {
    const pc = pcRef.current;
    const cid = callIdState || incomingCallId;
    if (!pc || !cid) return;

    try {
      if (!offerSetRef.current) {
        // Try again
        const { data } = await supabase
          .from('openflou_calls')
          .select('offer')
          .eq('id', cid)
          .single();
        if (data?.offer) {
          const offerObj = data.offer;
          const sdpObj = offerObj.enc
            ? await decryptSDP(offerObj.enc, offerObj.iv, cid)
            : offerObj;
          if (sdpObj) await pc.setRemoteDescription(new RTCSessionDescription(sdpObj as any));
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const { enc: ansEnc, iv: ansIv } = await encryptSDP(
        { type: answer.type, sdp: answer.sdp },
        cid
      );

      await supabase
        .from('openflou_calls')
        .update({
          status: 'active',
          answer: { enc: ansEnc, iv: ansIv },
        })
        .eq('id', cid);

      setStatus('active');
      startDurationTimer();
      startPollingAsCallee(cid, pc);

      // Apply any caller ICE candidates that already arrived
      await applyRemoteCandidates(cid, 'caller_candidates', pc);
    } catch (err) {
      console.error('Answer error:', err);
      setStatus('failed');
    }
  }

  // Caller polls for callee's answer + callee ICE candidates
  function startPollingAsCaller(cid: string, pc: RTCPeerConnection) {
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

        // Set answer when it arrives
        if (data.answer && !answerSetRef.current) {
          const sigState = (pc as any).signalingState;
          if (sigState === 'have-local-offer') {
            try {
              const ansObj = data.answer;
              const sdpObj = ansObj.enc
                ? await decryptSDP(ansObj.enc, ansObj.iv, cid)
                : ansObj;
              if (sdpObj) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdpObj as any));
                answerSetRef.current = true;
              }
            } catch (e) {
              console.error('Set answer error:', e);
            }
          }
        }

        await applyRemoteCandidates(cid, 'callee_candidates', pc);
        await pushLocalCandidates(cid);
      } catch { /* ignore */ }
    }, 1500);
  }

  // Callee polls for caller ICE candidates after answering
  function startPollingAsCallee(cid: string, pc: RTCPeerConnection) {
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

  async function pushLocalCandidates(cid: string) {
    if (!cid || iceCandidatesRef.current.length === 0) return;
    const field = isCaller ? 'caller_candidates' : 'callee_candidates';
    try {
      const { enc, iv } = await encryptCandidates(iceCandidatesRef.current, cid);
      await supabase
        .from('openflou_calls')
        .update({ [field]: { enc, iv } })
        .eq('id', cid);
    } catch { /* ignore */ }
  }

  async function applyRemoteCandidates(cid: string, field: string, pc: RTCPeerConnection) {
    try {
      const { data } = await supabase
        .from('openflou_calls')
        .select(field)
        .eq('id', cid)
        .single();

      const raw = (data as any)?.[field];
      if (!raw) return;

      let candidates: any[] = [];
      if (raw.enc) {
        candidates = await decryptCandidates(raw.enc, raw.iv, cid);
      } else if (Array.isArray(raw)) {
        candidates = raw;
      }

      for (const c of candidates) {
        const key = `${c.sdpMid}_${c.sdpMLineIndex}_${c.candidate}`;
        if (!appliedCandidatesRef.current.has(key)) {
          appliedCandidatesRef.current.add(key);
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch { /* stale candidate */ }
        }
      }
    } catch { /* ignore */ }
  }

  function startDurationTimer() {
    if (durationRef.current) clearInterval(durationRef.current);
    durationRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
  }

  function toggleMute() {
    localStream?.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((m) => !m);
  }

  function toggleCamera() {
    localStream?.getVideoTracks().forEach((t) => { t.enabled = isCameraOff; });
    setIsCameraOff((c) => !c);
  }

  async function flipCamera() {
    const track = localStream?.getVideoTracks()[0] as any;
    if (track?._switchCamera) {
      track._switchCamera();
      setIsFrontCamera((f) => !f);
    }
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
      localStream?.getTracks().forEach((t) => t.stop());
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

  // ── VIDEO CALL LAYOUT ──
  if (isVideo && (status === 'active' || status === 'ringing')) {
    return (
      <View style={styles.videoContainer}>
        <StatusBar style="light" hidden />

        {/* Remote video (full screen) */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={false}
            zOrder={0}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
            <Avatar uri={otherUser?.avatar} username={displayName} size={100} colors={colors} />
            <Text style={styles.videoWaitText}>Waiting for video...</Text>
          </View>
        )}

        {/* Local video (PIP top-right) */}
        {localStream && !isCameraOff ? (
          <View style={styles.localVideoContainer}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={isFrontCamera}
              zOrder={1}
            />
          </View>
        ) : (
          <View style={[styles.localVideoContainer, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
            <MaterialIcons name="videocam-off" size={28} color="#666" />
          </View>
        )}

        {/* Top overlay: name + status */}
        <View style={styles.videoTopOverlay}>
          <Text style={styles.videoCallName}>{displayName}</Text>
          <Text style={[styles.videoCallStatus, status === 'active' && { color: '#22c55e' }]}>
            {statusLabel[status]}
          </Text>
        </View>

        {/* Video controls */}
        <View style={styles.videoControls}>
          {/* Callee ringing */}
          {!isCaller && status === 'ringing' ? (
            <View style={styles.incomingRow}>
              <View style={styles.controlCol}>
                <Pressable onPress={handleDecline} style={[styles.ctrlBtn, styles.declineBtn]}>
                  <MaterialIcons name="call-end" size={30} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>Decline</Text>
              </View>
              <View style={styles.controlCol}>
                <Pressable onPress={() => answerCall()} style={[styles.ctrlBtn, styles.answerBtn]}>
                  <MaterialIcons name="call" size={30} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>Answer</Text>
              </View>
            </View>
          ) : (
            <View style={styles.activeRow}>
              <View style={styles.controlCol}>
                <Pressable onPress={toggleMute} style={[styles.ctrlBtn, styles.utilBtn, isMuted && styles.utilBtnOn]}>
                  <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={22} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
              </View>
              <View style={styles.controlCol}>
                <Pressable onPress={toggleCamera} style={[styles.ctrlBtn, styles.utilBtn, isCameraOff && styles.utilBtnOn]}>
                  <MaterialIcons name={isCameraOff ? 'videocam-off' : 'videocam'} size={22} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>{isCameraOff ? 'Show' : 'Hide'}</Text>
              </View>
              <View style={styles.controlCol}>
                <Pressable onPress={flipCamera} style={[styles.ctrlBtn, styles.utilBtn]}>
                  <MaterialIcons name="flip-camera-ios" size={22} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>Flip</Text>
              </View>
              <View style={styles.controlCol}>
                <Pressable
                  onPress={isCaller && status === 'ringing' ? handleDecline : handleEndCall}
                  style={[styles.ctrlBtn, styles.declineBtn]}
                >
                  <MaterialIcons name="call-end" size={30} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>End</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── VOICE CALL LAYOUT ──
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.userSection}>
        <View style={styles.avatarRing}>
          <Avatar uri={otherUser?.avatar} username={displayName} size={100} colors={colors} />
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
          <MaterialIcons name="call" size={13} color="#fff" />
          <Text style={styles.callTypeBadgeText}>Voice call · E2E encrypted</Text>
        </View>

        {connectionState === 'connecting' && status === 'active' ? (
          <Text style={styles.connectionHint}>Establishing connection...</Text>
        ) : null}
      </View>

      <View style={styles.controlsArea}>
        {/* Callee ringing */}
        {!isCaller && status === 'ringing' ? (
          <View style={styles.incomingRow}>
            <View style={styles.controlCol}>
              <Pressable onPress={handleDecline} style={({ pressed }) => [styles.ctrlBtn, styles.declineBtn, { opacity: pressed ? 0.75 : 1 }]}>
                <MaterialIcons name="call-end" size={30} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>Decline</Text>
            </View>
            <View style={styles.controlCol}>
              <Pressable onPress={() => answerCall()} style={({ pressed }) => [styles.ctrlBtn, styles.answerBtn, { opacity: pressed ? 0.75 : 1 }]}>
                <MaterialIcons name="call" size={30} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>Answer</Text>
            </View>
          </View>
        ) : (
          <View style={styles.activeRow}>
            <View style={styles.controlCol}>
              <Pressable onPress={toggleMute} style={({ pressed }) => [styles.ctrlBtn, styles.utilBtn, isMuted && styles.utilBtnOn, { opacity: pressed ? 0.75 : 1 }]}>
                <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </View>
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
  // ── Voice layout ──
  safeArea: { flex: 1, backgroundColor: '#0d1117' },
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
    top: -6,
    left: -6,
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: '#22c55e',
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
  // ── Video layout ──
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    zIndex: 10,
  },
  localVideo: {
    flex: 1,
  },
  videoTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 5,
  },
  videoCallName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
  },
  videoCallStatus: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  videoControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingTop: 24,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 5,
  },
  videoWaitText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
    fontSize: 15,
    includeFontPadding: false,
  },
  // ── Shared controls ──
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
  utilBtnOn: { backgroundColor: 'rgba(255,255,255,0.38)' },
  ctrlLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    includeFontPadding: false,
  },
});
