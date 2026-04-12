import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

export default function CallScreen() {
  const { type, circleName } = useLocalSearchParams<{ type: string; circleName: string }>();
  const isVideo = type === 'video';
  const [seconds, setSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    // Simüle bağlanıyor
    const connectTimer = setTimeout(() => setConnected(true), 2000);
    return () => clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const iv = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, [connected]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const endCall = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={[styles.bg, isVideo ? styles.bgVideo : styles.bgVoice]} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={endCall} style={styles.topBtn}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.callTypeLabel}>
            {isVideo ? '📹 Görüntülü Görüşme' : '📞 Sesli Görüşme'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Center — Avatar / Camera */}
        <View style={styles.center}>
          {isVideo && !cameraOff ? (
            <View style={styles.cameraPlaceholder}>
              <Ionicons name="videocam" size={60} color="rgba(255,255,255,0.4)" />
              <Text style={styles.cameraNote}>Kamera görüntüsü{'\n'}(native build gerektirir)</Text>
            </View>
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{circleName?.charAt(0) ?? '?'}</Text>
            </View>
          )}
          <Text style={styles.groupName}>{circleName}</Text>
          <Text style={styles.status}>
            {connected ? formatTime(seconds) : 'Bağlanıyor...'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.ctrl, muted && styles.ctrlActive]} onPress={() => setMuted(!muted)}>
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={26} color="#fff" />
            <Text style={styles.ctrlLabel}>{muted ? 'Sesi Aç' : 'Sessiz'}</Text>
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity style={[styles.ctrl, cameraOff && styles.ctrlActive]} onPress={() => setCameraOff(!cameraOff)}>
              <Ionicons name={cameraOff ? 'videocam-off' : 'videocam'} size={26} color="#fff" />
              <Text style={styles.ctrlLabel}>{cameraOff ? 'Kamera Aç' : 'Kamerayı Kapat'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.ctrl, speakerOn && styles.ctrlActive]} onPress={() => setSpeakerOn(!speakerOn)}>
            <Ionicons name={speakerOn ? 'volume-high' : 'volume-mute'} size={26} color="#fff" />
            <Text style={styles.ctrlLabel}>{speakerOn ? 'Hoparlör' : 'Hoparlör Kapat'}</Text>
          </TouchableOpacity>
        </View>

        {/* End Call */}
        <View style={styles.endRow}>
          <TouchableOpacity style={styles.endBtn} onPress={endCall}>
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  bgVoice: { backgroundColor: '#1e1b4b' },
  bgVideo: { backgroundColor: '#111827' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  topBtn: { padding: 6 },
  callTypeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  cameraPlaceholder: { width: 240, height: 320, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.07)', justifyContent: 'center', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cameraNote: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' },
  avatarCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#6d28d9', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#a78bfa' },
  avatarInitial: { fontSize: 52, fontWeight: '900', color: '#fff' },
  groupName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  status: { fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingHorizontal: 30, marginBottom: 30 },
  ctrl: { alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 18 },
  ctrlActive: { backgroundColor: 'rgba(109,40,217,0.5)' },
  ctrlLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  endRow: { alignItems: 'center', marginBottom: 20 },
  endBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 },
});
