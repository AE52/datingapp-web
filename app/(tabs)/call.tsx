import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { getStoredUser } from '@/api';
import { buildCallWebSocketUrl, createCallSession, fetchIceServers, type IceServerView } from '@/lib/calls';
import { formatCallDuration, normalizeIceServers, resolveCallDisplayName } from '@/lib/call-utils';

type SignalMessage =
  | { type: 'participant-joined'; userId: number }
  | { type: 'participant-left'; userId: number }
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit };

type NativeWebRtcModule = typeof import('react-native-webrtc');
type NativeRtcViewProps = {
  streamURL: string;
  objectFit?: 'cover' | 'contain';
  style?: unknown;
  mirror?: boolean;
};
type PeerConnectionLike = any;
type MediaStreamLike = any;

const WebVideo = 'video' as never;

let nativeWebRtcModulePromise: Promise<NativeWebRtcModule> | null = null;

async function loadNativeWebRtcModule() {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!nativeWebRtcModulePromise) {
    const importer = new Function('return import("react-native-webrtc")') as () => Promise<NativeWebRtcModule>;
    nativeWebRtcModulePromise = importer();
  }
  return nativeWebRtcModulePromise;
}

export default function CallScreen() {
  const params = useLocalSearchParams<{
    callId?: string;
    type?: string;
    circleName?: string;
    peerUserId?: string;
    incoming?: string;
  }>();

  const isVideo = params.type === 'video';
  const { width } = useWindowDimensions();
  const isWide = width >= 960;

  const [callId, setCallId] = useState(params.callId ?? '');
  const [displayName, setDisplayName] = useState(resolveCallDisplayName(params.circleName, params.peerUserId));
  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState('Baglanti kuruluyor...');
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nativeRtcView, setNativeRtcView] = useState<React.ComponentType<NativeRtcViewProps> | null>(null);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);

  const websocketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localUserIdRef = useRef<number | null>(null);
  const remotePeerIdRef = useRef<number | null>(params.peerUserId ? Number(params.peerUserId) : null);
  const offerSentRef = useRef(false);

  const callLabel = useMemo(
    () => (isVideo ? 'Goruntulu gorusme' : 'Sesli gorusme'),
    [isVideo],
  );

  const connectCall = useEffectEvent(async (nextCallId: string, userId: number) => {
    const iceServers = normalizeIceServers(await fetchIceServers());
    const peerConnection: PeerConnectionLike = await createPeerConnection(iceServers);
    peerConnectionRef.current = peerConnection;

    peerConnection.onicecandidate = (event: { candidate?: { toJSON?: () => RTCIceCandidateInit } | RTCIceCandidateInit | null }) => {
      if (!event.candidate) return;
      sendSignal({
        type: 'ice-candidate',
        candidate:
          typeof (event.candidate as { toJSON?: () => RTCIceCandidateInit }).toJSON === 'function'
            ? (event.candidate as { toJSON: () => RTCIceCandidateInit }).toJSON()
            : (event.candidate as RTCIceCandidateInit),
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        setConnected(true);
        setStatus('Baglandi');
      } else if (state === 'failed' || state === 'disconnected') {
        setStatus('Baglanti koptu');
      }
    };

    peerConnection.ontrack = (event: { streams?: unknown[] }) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      remoteStreamRef.current = stream;
      attachRemotePreview(stream as MediaStreamLike);
      setConnected(true);
      setStatus('Baglandi');
    };

    const localStream = await createLocalMediaStream();
    if (localStream) {
      localStreamRef.current = localStream;
      localStream.getTracks().forEach((track: any) => peerConnection.addTrack(track, localStream));
      attachLocalPreview(localStream);
    }

    const websocketUrl = await buildCallWebSocketUrl(nextCallId, userId);
    const websocket = new WebSocket(websocketUrl);
    websocketRef.current = websocket;

    websocket.onopen = () => {
      setStatus(params.incoming === '1' ? 'Karsi taraf bekleniyor...' : 'Cagri gonderildi...');
    };
    websocket.onerror = () => {
      setError('Call signaling kanali acilamadi.');
      setStatus('Call signaling kanali acilamadi.');
    };
    websocket.onmessage = async (event) => {
      const message = JSON.parse(event.data) as SignalMessage;
      await handleSignal(message, userId);
    };
    websocket.onclose = () => {
      if (!connected) {
        setStatus('Cagri kapandi');
      }
    };
  });

  useEffect(() => {
    if (!connected) return;
    const intervalId = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(intervalId);
  }, [connected]);

  useEffect(() => {
    let disposed = false;

    const initializeCall = async () => {
      try {
        const user = await getStoredUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        localUserIdRef.current = user.id;
        setDisplayName(resolveCallDisplayName(params.circleName, params.peerUserId));

        let nextCallId = params.callId ?? '';
        if (!nextCallId && params.peerUserId) {
          const session = await createCallSession(user.id, Number(params.peerUserId), isVideo ? 'video' : 'voice');
          nextCallId = session.callId;
          if (!disposed) {
            setCallId(session.callId);
          }
        }

        if (!nextCallId) {
          throw new Error('Cagri oturumu bulunamadi.');
        }

        setStatus(params.incoming === '1' ? 'Cagriya baglaniliyor...' : 'Karsi taraf baglaniyor...');
        await connectCall(nextCallId, user.id);
      } catch (callError) {
        const message = callError instanceof Error ? callError.message : 'Cagri baslatilamadi.';
        if (!disposed) {
          setError(message);
          setStatus(message);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void initializeCall();
    return () => {
      disposed = true;
      teardownCall();
    };
  }, [connectCall, isVideo, params.callId, params.circleName, params.incoming, params.peerUserId]);

  useEffect(() => {
    localStreamRef.current?.getAudioTracks?.().forEach((track: { enabled: boolean }) => {
      track.enabled = !muted;
    });
  }, [muted]);

  useEffect(() => {
    localStreamRef.current?.getVideoTracks?.().forEach((track: { enabled: boolean }) => {
      track.enabled = !cameraOff;
    });
  }, [cameraOff]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !speakerOn;
    }
  }, [speakerOn]);

  const createPeerConnection = async (iceServers: IceServerView[]): Promise<PeerConnectionLike> => {
    const rtcConfig = {
      iceServers: iceServers.map((server) => ({ urls: server.urls })),
    };

    if (Platform.OS === 'web') {
      return new RTCPeerConnection(rtcConfig);
    }

    const nativeModule = await loadNativeWebRtcModule();
    if (!nativeModule) {
      throw new Error('Native WebRTC modulu yuklenemedi.');
    }

    setNativeRtcView(() => nativeModule.RTCView as unknown as React.ComponentType<NativeRtcViewProps>);
    return new nativeModule.RTCPeerConnection(rtcConfig);
  };

  const createLocalMediaStream = async (): Promise<MediaStreamLike> => {
    if (Platform.OS === 'web') {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Tarayici medya erisimini desteklemiyor.');
      }
      return navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
    }

    const nativeModule = await loadNativeWebRtcModule();
    if (!nativeModule) {
      throw new Error('Native WebRTC modulu yuklenemedi.');
    }

    return nativeModule.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo
        ? {
            frameRate: 24,
            facingMode: 'user',
          }
        : false,
    });
  };

  const attachLocalPreview = (stream: MediaStreamLike) => {
    if (Platform.OS === 'web') {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream as MediaStream;
      }
      return;
    }

    if (typeof stream.toURL === 'function') {
      setLocalStreamUrl(stream.toURL());
    }
  };

  const attachRemotePreview = (stream: MediaStreamLike) => {
    if (Platform.OS === 'web') {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream as MediaStream;
      }
      return;
    }

    if (typeof stream.toURL === 'function') {
      setRemoteStreamUrl(stream.toURL());
    }
  };

  const handleSignal = async (message: SignalMessage, userId: number) => {
    const peerConnection = peerConnectionRef.current as PeerConnectionLike | null;
    if (!peerConnection) return;

    if (message.type === 'participant-joined') {
      remotePeerIdRef.current = message.userId;
      setStatus('Katilimci baglandi, offer olusturuluyor...');
      if (!offerSentRef.current) {
        offerSentRef.current = true;
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendSignal({ type: 'offer', sdp: offer });
      }
      return;
    }

    if (message.type === 'participant-left') {
      if (message.userId !== userId) {
        setStatus('Karsi taraf cagridan ayrildi.');
      }
      return;
    }

    if (message.type === 'offer') {
      await peerConnection.setRemoteDescription(await createSessionDescription(message.sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendSignal({ type: 'answer', sdp: answer });
      setStatus('Offer alindi, cevap gonderiliyor...');
      return;
    }

    if (message.type === 'answer') {
      await peerConnection.setRemoteDescription(await createSessionDescription(message.sdp));
      setStatus('Cevap alindi, medya baglantisi kuruluyor...');
      return;
    }

    if (message.type === 'ice-candidate') {
      await peerConnection.addIceCandidate(await createIceCandidate(message.candidate));
    }
  };

  const createSessionDescription = async (description: RTCSessionDescriptionInit) => {
    const normalizedDescription: RTCSessionDescriptionInit = {
      type: description.type,
      sdp: description.sdp ?? '',
    };

    if (Platform.OS === 'web') {
      return new RTCSessionDescription(normalizedDescription);
    }

    const nativeModule = await loadNativeWebRtcModule();
    if (!nativeModule) {
      throw new Error('Native session description olusturulamadi.');
    }
    return new nativeModule.RTCSessionDescription(normalizedDescription as any);
  };

  const createIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (Platform.OS === 'web') {
      return new RTCIceCandidate(candidate);
    }

    const nativeModule = await loadNativeWebRtcModule();
    if (!nativeModule) {
      throw new Error('Native ICE candidate olusturulamadi.');
    }
    return new nativeModule.RTCIceCandidate(candidate);
  };

  const sendSignal = (payload: SignalMessage) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(payload));
    }
  };

  const teardownCall = () => {
    websocketRef.current?.close();
    websocketRef.current = null;

    peerConnectionRef.current?.close?.();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks?.().forEach((track: { stop: () => void }) => track.stop());
    remoteStreamRef.current?.getTracks?.().forEach((track: { stop: () => void }) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setLocalStreamUrl(null);
    setRemoteStreamUrl(null);
  };

  const endCall = () => {
    teardownCall();
    router.back();
  };

  const NativeRtcView = nativeRtcView;

  return (
    <View style={styles.container}>
      <View style={[styles.backgroundLayer, isVideo ? styles.videoBackground : styles.voiceBackground]} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={[styles.shell, isWide && styles.shellWide]}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={endCall} style={styles.topButton}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.callTypeLabel}>{callLabel}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.center}>
            {Platform.OS === 'web' && isVideo ? (
              <View style={styles.videoGrid}>
                {React.createElement(WebVideo, {
                  ref: (node: HTMLVideoElement | null) => {
                    localVideoRef.current = node;
                    if (node && localStreamRef.current) {
                      node.srcObject = localStreamRef.current;
                    }
                  },
                  autoPlay: true,
                  muted: true,
                  playsInline: true,
                  style: styles.webVideo,
                })}
                {React.createElement(WebVideo, {
                  ref: (node: HTMLVideoElement | null) => {
                    remoteVideoRef.current = node;
                    if (node && remoteStreamRef.current) {
                      node.srcObject = remoteStreamRef.current;
                    }
                  },
                  autoPlay: true,
                  playsInline: true,
                  style: styles.webVideo,
                })}
              </View>
            ) : isVideo && NativeRtcView ? (
              <View style={styles.videoGrid}>
                {localStreamUrl ? <NativeRtcView streamURL={localStreamUrl} objectFit="cover" style={styles.nativeVideo} mirror /> : null}
                {remoteStreamUrl ? <NativeRtcView streamURL={remoteStreamUrl} objectFit="cover" style={styles.nativeVideo} /> : <View style={styles.videoPlaceholder}><Text style={styles.placeholderText}>Karsi taraf bekleniyor</Text></View>}
              </View>
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}

            <Text style={styles.displayName}>{displayName}</Text>
            {callId ? <Text style={styles.callMeta}>Call ID: {callId.slice(0, 8)}</Text> : null}
            <Text style={styles.status}>{connected ? formatCallDuration(seconds) : status}</Text>

            {loading && <ActivityIndicator size="large" color="#fff" />}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {Platform.OS !== 'web' ? (
              <Text style={styles.helperText}>
                Native development build uzerinde `react-native-webrtc` aktif. App Store release oncesi fiziksel cihazda ses, kamera,
                speaker route ve reconnect senaryolari ayri smoke edilmelidir.
              </Text>
            ) : null}
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={[styles.control, muted && styles.controlActive]} onPress={() => setMuted((value) => !value)}>
              <Ionicons name={muted ? 'mic-off' : 'mic'} size={26} color="#fff" />
              <Text style={styles.controlLabel}>{muted ? 'Sesi ac' : 'Sessiz'}</Text>
            </TouchableOpacity>

            {isVideo ? (
              <TouchableOpacity style={[styles.control, cameraOff && styles.controlActive]} onPress={() => setCameraOff((value) => !value)}>
                <Ionicons name={cameraOff ? 'videocam-off' : 'videocam'} size={26} color="#fff" />
                <Text style={styles.controlLabel}>{cameraOff ? 'Kamera ac' : 'Kamera kapa'}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={[styles.control, speakerOn && styles.controlActive]} onPress={() => setSpeakerOn((value) => !value)}>
              <Ionicons name={speakerOn ? 'volume-high' : 'volume-mute'} size={26} color="#fff" />
              <Text style={styles.controlLabel}>{speakerOn ? 'Hoparlor' : 'Sessiz cikis'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.endRow}>
            <TouchableOpacity style={styles.endButton} onPress={endCall}>
              <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundLayer: { ...StyleSheet.absoluteFillObject },
  voiceBackground: { backgroundColor: '#1e1b4b' },
  videoBackground: { backgroundColor: '#111827' },
  shell: { flex: 1, width: '100%', maxWidth: 1080, alignSelf: 'center' },
  shellWide: { paddingHorizontal: 24 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  topButton: { padding: 6 },
  callTypeLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 28 },
  videoGrid: { width: '100%', gap: 16 },
  webVideo: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    objectFit: 'cover',
  } as never,
  nativeVideo: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  videoPlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6d28d9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#a78bfa',
  },
  avatarText: { fontSize: 52, fontWeight: '900', color: '#fff' },
  displayName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  callMeta: { fontSize: 12, color: 'rgba(255,255,255,0.48)' },
  status: { fontSize: 18, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textAlign: 'center' },
  helperText: { color: 'rgba(255,255,255,0.56)', textAlign: 'center', fontSize: 13, lineHeight: 18, maxWidth: 560 },
  errorText: { color: '#fecaca', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 30,
    marginBottom: 30,
    flexWrap: 'wrap',
  },
  control: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    minWidth: 96,
  },
  controlActive: { backgroundColor: 'rgba(109,40,217,0.5)' },
  controlLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  endRow: { alignItems: 'center', marginBottom: 20 },
  endButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
});
