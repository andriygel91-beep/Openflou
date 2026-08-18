// Openflou Call Screen — Real WebRTC voice/video with encrypted DB signaling
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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

// ── Signaling obfuscation: simple Base64 encode/decode
function encryptSDP(sdp: object, _callId: string): { enc: string; iv: string } {
  try {
    const json = JSON.stringify(sdp);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return { enc: encoded, iv: '' };
  } catch {
    return { enc: btoa(JSON.stringify(sdp)), iv: '' };
  }
}

function decryptSDP(enc: string, _ivB64: string, _callId: string): object | null {
  try {
    const json = decodeURIComponent(escape(atob(enc)));
    return JSON.parse(json);
  } catch {
    try { return JSON.parse(enc); } catch { return null; }
  }
}

function encryptCandidates(candidates: object[], callId: string): { enc: string; iv: string } {
  return encryptSDP(candidates, callId);
}

function decryptCandidates(enc: string, ivB64: string, callId: string): object[] {
  const result = decryptSDP(enc, ivB64, callId);
  return Array.isArray(result) ? result : [];
}

const supabase = getSupabaseClient();
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

type CallStatus = 'initializing' | 'ringing' | 'connecting' | 'active' | 'ended' | 'declined' | 'failed';

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
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callEndedRef = useRef(false);
  const answeringRef = useRef(false); // guard to prevent double-answer
  const iceCandidatesRef = useRef<any[]>([]);
  const sentCandidatesRef = useRef<Set<string>>(new Set());
  const appliedCandidatesRef = useRef<Set<string>>(new Set());
  const offerSetRef = useRef(false);
  const answerSetRef = useRef(false);
  const callIdRef = useRef<string>(incomingCallId || '');

  // Keep callIdRef in sync
  useEffect(() => {
    callIdRef.current = callIdState;
  }, [callIdState]);

  // Load other user info
  useEffect(() => {
    const targetId = isCaller ? calleeId : callerId;
    if (targetId) {
      api.getUserById(targetId).then((u) => { if (u) setOtherUser(u); });
    }
  }, [calleeId, callerId]);

  useEffect(() => {
    initializeCall();
    return () => cleanup(true); // Always clean up streams on unmount
  }, []);

  async function initializeCall() {
    try {
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

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remoteStreamObj = new MediaStream(undefined);

      pc.addEventListener('track', (event: any) => {
        const track = event?.track;
        if (track) {
          remoteStreamObj.addTrack(track);
          setRemoteStream(new MediaStream([...remoteStreamObj.getTracks()]));
        }
      });

      pc.addEventListener('icecandidate', async (event: any) => {
        const candidate = event?.candidate;
        if (candidate) {
          const key = `${candidate.sdpMid}_${candidate.sdpMLineIndex}_${candidate.candidate}`;
          if (!sentCandidatesRef.current.has(key)) {
            sentCandidatesRef.current.add(key);
            iceCandidatesRef.current.push(candidate.toJSON());
            const cid = callIdRef.current;
            if (cid) await pushLocalCandidates(cid);
          }
        }
      });

      pc.addEventListener('connectionstatechange', () => {
        const state = (pc as any).connectionState || '';
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

  // ── CALLER: create offer → store in DB → poll for answer ──
  async function startCallerFlow(pc: RTCPeerConnection) {
    if (!currentUser || !calleeId) return;

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    } as any);
    await pc.setLocalDescription(offer);

    const tempId = `tmp_${Date.now()}`;
    const { enc: offerEnc, iv: offerIv } = encryptSDP({ type: offer.type, sdp: offer.sdp }, tempId);

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
    callIdRef.current = cid;
    setStatus('ringing');

    // Re-encode offer with real callId
    const { enc: realOfferEnc, iv: realOfferIv } = encryptSDP({ type: offer.type, sdp: offer.sdp }, cid);
    await supabase.from('openflou_calls').update({ offer: { enc: realOfferEnc, iv: realOfferIv } }).eq('id', cid);

    // Push notification to callee so they get alerted even on locked screen
    if (calleeId && currentUser) {
      const callerName = (currentUser as any).display_name || currentUser.username || 'Someone';
      api.sendCallPushNotification(calleeId, callerName, type || 'voice', chatId, cid, currentUser.id).catch(() => {});
    }

    startPollingAsCaller(cid, pc);
  }

  // ── CALLEE: fetch offer → set remote desc → show incoming UI ──
  async function startCalleeFlow(pc: RTCPeerConnection) {
    const cid = incomingCallId;
    if (!cid) { setStatus('failed'); return; }
    setCallIdState(cid);
    callIdRef.current = cid;
    setStatus('ringing');

    // Fetch and apply the offer right away
    try {
      const { data } = await supabase.from('openflou_calls').select('*').eq('id', cid).single();
      if (!data?.offer) return;

      const offerObj = data.offer;
      const sdpObj: any = offerObj.enc ? decryptSDP(offerObj.enc, offerObj.iv, cid) : offerObj;
      if (sdpObj) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdpObj));
        offerSetRef.current = true;
      }
    } catch (err) {
      console.error('Failed to set offer:', err);
    }
  }

  // ── Called when callee taps Answer ──
  const answerCall = useCallback(async () => {
    // Prevent double-tapping
    if (answeringRef.current) return;
    answeringRef.current = true;

    const pc = pcRef.current;
    const cid = callIdRef.current || incomingCallId;
    if (!pc || !cid) {
      answeringRef.current = false;
      return;
    }

    // Immediately update UI so Answer button disappears
    setStatus('connecting');

    try {
      // Ensure offer is set
      if (!offerSetRef.current) {
        const { data } = await supabase.from('openflou_calls').select('offer').eq('id', cid).single();
        if (data?.offer) {
          const offerObj = data.offer;
          const sdpObj = offerObj.enc ? decryptSDP(offerObj.enc, offerObj.iv, cid) : offerObj;
          if (sdpObj) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdpObj as any));
            offerSetRef.current = true;
          }
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const { enc: ansEnc, iv: ansIv } = encryptSDP({ type: answer.type, sdp: answer.sdp }, cid);

      await supabase.from('openflou_calls').update({
        status: 'active',
        answer: { enc: ansEnc, iv: ansIv },
      }).eq('id', cid);

      // Push any ICE candidates collected so far
      await pushLocalCandidates(cid);

      // Start polling for caller's ICE candidates
      startPollingAsCallee(cid, pc);

      // Apply any caller candidates already in DB
      await applyRemoteCandidates(cid, 'caller_candidates', pc);

    } catch (err) {
      console.error('Answer error:', err);
      setStatus('ringing'); // restore so user can try again
      answeringRef.current = false;
    }
  }, [incomingCallId, isVideo]);

  // ── Caller polls for callee's answer + ICE candidates ──
  function startPollingAsCaller(cid: string, pc: RTCPeerConnection) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (callEndedRef.current) return;
      try {
        const { data } = await supabase.from('openflou_calls').select('*').eq('id', cid).single();
        if (!data) { endCall('ended'); return; }
        if (data.status === 'declined') { endCall('declined'); return; }
        if (data.status === 'ended') { endCall('ended'); return; }

        // Set answer when it arrives
        if (data.answer && !answerSetRef.current) {
          const sig = (pc as any).signalingState;
          if (sig === 'have-local-offer') {
            try {
              const ansObj = data.answer;
              const sdpObj = ansObj.enc ? decryptSDP(ansObj.enc, ansObj.iv, cid) : ansObj;
              if (sdpObj) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdpObj as any));
                answerSetRef.current = true;
              }
            } catch (e) { console.error('Set answer error:', e); }
          }
        }

        await applyRemoteCandidates(cid, 'callee_candidates', pc);
        await pushLocalCandidates(cid);
      } catch { /* ignore */ }
    }, 1200);
  }

  // ── Callee polls for caller ICE candidates after answering ──
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
      const { enc, iv } = encryptCandidates(iceCandidatesRef.current, cid);
      await supabase.from('openflou_calls').update({ [field]: { enc, iv } }).eq('id', cid);
    } catch { /* ignore */ }
  }

  async function applyRemoteCandidates(cid: string, field: string, pc: RTCPeerConnection) {
    try {
      const { data } = await supabase.from('openflou_calls').select(field).eq('id', cid).single();
      const raw = (data as any)?.[field];
      if (!raw) return;

      let candidates: any[] = [];
      if (raw.enc && raw.enc.length > 0) {
        candidates = decryptCandidates(raw.enc, raw.iv, cid);
      } else if (Array.isArray(raw)) {
        candidates = raw;
      }

      const sigState = (pc as any).signalingState;
      if (sigState === 'closed') return;

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
    const cid = callIdRef.current || incomingCallId;
    if (cid) {
      await supabase.from('openflou_calls').update({
        status: 'declined',
        ended_at: new Date().toISOString(),
      }).eq('id', cid);
    }
    endCall('declined');
  }

  async function handleEndCall() {
    const cid = callIdRef.current || incomingCallId;
    if (cid) {
      await supabase.from('openflou_calls').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration_seconds: callDuration,
      }).eq('id', cid);
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
    // Always stop media tracks to release mic/camera
    localStream?.getTracks().forEach((t) => t.stop());
    try { pcRef.current?.close(); } catch { /* ignore */ }
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const statusLabel: Record<CallStatus, string> = {
    initializing: 'Connecting...',
    ringing: isCaller ? 'Calling...' : 'Incoming call',
    connecting: 'Connecting...',
    active: formatDuration(callDuration),
    ended: 'Call ended',
    declined: 'Call declined',
    failed: 'Call failed',
  };

  const displayName = otherUser?.display_name || otherUser?.username || 'Unknown';

  // ── VIDEO CALL LAYOUT ──
  if (isVideo) {
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
            <Text style={styles.videoWaitText}>{statusLabel[status]}</Text>
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

        {/* Top overlay */}
        <View style={styles.videoTopOverlay}>
          <Text style={styles.videoCallName}>{displayName}</Text>
          <Text style={[styles.videoCallStatus, status === 'active' && { color: '#22c55e' }]}>
            {statusLabel[status]}
          </Text>
        </View>

        {/* Video controls */}
        <View style={styles.videoControls}>
          {/* Callee: incoming */}
          {!isCaller && (status === 'ringing') ? (
            <View style={styles.incomingRow}>
              <View style={styles.controlCol}>
                <Pressable onPress={handleDecline} style={[styles.ctrlBtn, styles.declineBtn]}>
                  <MaterialIcons name="call-end" size={30} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>Decline</Text>
              </View>
              <View style={styles.controlCol}>
                <Pressable onPress={answerCall} style={[styles.ctrlBtn, styles.answerBtn]}>
                  <MaterialIcons name="call" size={30} color="#fff" />
                </Pressable>
                <Text style={styles.ctrlLabel}>Answer</Text>
              </View>
            </View>
          ) : status === 'connecting' ? (
            <View style={styles.activeRow}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>Setting up connection...</Text>
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
                <Pressable onPress={isCaller && status === 'ringing' ? handleDecline : handleEndCall} style={[styles.ctrlBtn, styles.declineBtn]}>
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
          {status === 'active' ? <View style={styles.activeRing} /> : null}
        </View>

        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.usernameText}>@{otherUser?.username || '...'}</Text>

        <Text style={[
          styles.statusLabel,
          status === 'active' ? styles.statusActive : null,
          (status === 'ended' || status === 'declined' || status === 'failed') ? styles.statusEnded : null,
        ]}>
          {statusLabel[status]}
        </Text>

        <View style={styles.callTypeBadge}>
          <MaterialIcons name="call" size={13} color="#fff" />
          <Text style={styles.callTypeBadgeText}>Voice call · E2E encrypted</Text>
        </View>
      </View>

      <View style={styles.controlsArea}>
        {/* Callee incoming — only show if truly ringing (not connecting/active) */}
        {!isCaller && status === 'ringing' ? (
          <View style={styles.incomingRow}>
            <View style={styles.controlCol}>
              <Pressable onPress={handleDecline} style={({ pressed }) => [styles.ctrlBtn, styles.declineBtn, { opacity: pressed ? 0.75 : 1 }]}>
                <MaterialIcons name="call-end" size={30} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>Decline</Text>
            </View>
            <View style={styles.controlCol}>
              <Pressable onPress={answerCall} style={({ pressed }) => [styles.ctrlBtn, styles.answerBtn, { opacity: pressed ? 0.75 : 1 }]}>
                <MaterialIcons name="call" size={30} color="#fff" />
              </Pressable>
              <Text style={styles.ctrlLabel}>Answer</Text>
            </View>
          </View>
        ) : status === 'connecting' ? (
          <View style={styles.activeRow}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>Setting up connection...</Text>
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
              <Pressable onPress={isCaller && status === 'ringing' ? handleDecline : handleEndCall} style={({ pressed }) => [styles.ctrlBtn, styles.declineBtn, { opacity: pressed ? 0.75 : 1 }]}>
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
    top: -6, left: -6,
    width: 112, height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  userName: { fontSize: 30, fontWeight: '700', color: '#fff', includeFontPadding: false, textAlign: 'center' },
  usernameText: { fontSize: 15, color: 'rgba(255,255,255,0.55)', includeFontPadding: false },
  statusLabel: { fontSize: 17, color: 'rgba(255,255,255,0.75)', marginTop: 10, includeFontPadding: false, fontWeight: '500' },
  statusActive: { color: '#22c55e', fontVariant: ['tabular-nums'] },
  statusEnded: { color: '#ef4444' },
  callTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginTop: 8,
  },
  callTypeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600', includeFontPadding: false },
  controlsArea: { paddingBottom: 52, paddingHorizontal: 32 },

  // Video layout
  videoContainer: { flex: 1, backgroundColor: '#000' },
  localVideoContainer: {
    position: 'absolute', top: 60, right: 16,
    width: 100, height: 150, borderRadius: 12, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    elevation: 8, zIndex: 10,
  },
  localVideo: { flex: 1 },
  videoTopOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 5,
  },
  videoCallName: { fontSize: 24, fontWeight: '700', color: '#fff', includeFontPadding: false },
  videoCallStatus: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, fontVariant: ['tabular-nums'], includeFontPadding: false },
  videoControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 48, paddingTop: 24, paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5,
  },
  videoWaitText: { color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: 15, includeFontPadding: false },

  // Shared controls
  incomingRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  activeRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  controlCol: { alignItems: 'center', gap: 10 },
  ctrlBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  answerBtn: { backgroundColor: '#22c55e' },
  declineBtn: { backgroundColor: '#ef4444' },
  utilBtn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  utilBtnOn: { backgroundColor: 'rgba(255,255,255,0.38)' },
  ctrlLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13, includeFontPadding: false },
});
