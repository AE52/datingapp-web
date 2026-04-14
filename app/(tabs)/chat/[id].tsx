import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Alert, ActionSheetIOS,
  Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { API_BASE_URL, getStoredUser } from '@/api';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

const CIRCLE_API = API_BASE_URL.replace('/users', '/circles');
const CHAT_API   = API_BASE_URL.replace('/users', '/chat');
const NOTIF_API  = API_BASE_URL.replace('/users', '/notifications');

type Msg = {
  id: number;
  content: string;
  sender: { id: number; username: string };
  timestamp: string;
  type?: 'TEXT' | 'VOICE' | 'IMAGE' | 'VIDEO';
};

export default function ChatDetailScreen() {
  const { id, name, isPrivate } = useLocalSearchParams<{ id: string; name: string; isPrivate?: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const privateMode = isPrivate === '1';

  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const init = async () => {
      const u = await getStoredUser();
      if (!u) { router.replace('/login'); return; }
      setCurrentUser(u);
      setIsAdmin(u.admin);
      fetchMessages(u.id);
      if (!privateMode) fetchMembers();
    };
    init();
    const iv = setInterval(() => fetchMessages(currentUser?.id), 5000);
    return () => clearInterval(iv);
  }, [isPrivate, currentUser?.id]);

  const fetchMessages = async (currentUserId?: number) => {
    try {
      const endpoint = privateMode && currentUserId
        ? `${CHAT_API}/private/${currentUserId}/${id}`
        : `${CHAT_API}/${id}`;
      const res = await fetch(endpoint);
      setMessages(await res.json());
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) { /* ignore */ }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${CIRCLE_API}/${id}`);
      const circle = await res.json();
      setMembers(circle.members || []);
    } catch (e) { /* ignore */ }
  };

  const sendText = async () => {
    if (!inputText.trim() || !currentUser) return;
    const draft = inputText; setInputText('');
    setMessages(prev => [...prev, {
      id: Date.now(), content: draft,
      sender: currentUser, timestamp: new Date().toISOString(), type: 'TEXT',
    }]);
    try {
      await fetch(privateMode ? `${CHAT_API}/send-private` : `${CHAT_API}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(privateMode
          ? { senderId: currentUser.id, receiverId: Number(id), content: draft }
          : { circleId: Number(id), senderId: currentUser.id, content: draft }),
      });
      fetchMessages(currentUser.id);
    } catch (e) { /* ignore */ }
  };

  // ── Sesli Mesaj ────────────────────────────────────────────────────────────
  const startRecording = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) return Alert.alert('İzin Gerekli', 'Mikrofon izni verilmedi.');
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    setRecording(rec); setIsRecording(true);
    Haptics?.impactAsync?.('medium');
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (!uri) return;
    // Simüle: backend'e content olarak "[SES MESAJI]" gönder
    const draft = `🎙️ Ses Mesajı (${Math.floor(Math.random() * 10) + 1}sn)`;
    setMessages(prev => [...prev, {
      id: Date.now(), content: draft,
      sender: currentUser, timestamp: new Date().toISOString(), type: 'VOICE',
    }]);
    try {
      await fetch(privateMode ? `${CHAT_API}/send-private` : `${CHAT_API}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(privateMode
          ? { senderId: currentUser.id, receiverId: Number(id), content: draft }
          : { circleId: Number(id), senderId: currentUser.id, content: draft }),
      });
    } catch (e) { /* ignore */ }
  };

  // ── Görüntü / Video ─────────────────────────────────────────────────────────
  const handleAttach = () => {
    Alert.alert('Ekle', 'Ne göndermek istiyorsunuz?', [
      { text: '📸 Fotoğraf', onPress: pickImage },
      { text: '🎥 Video',    onPress: pickVideo },
      { text: '📁 Dosya',    onPress: () => Alert.alert('Yakında', 'Dosya gönderimi yakında!') },
      { text: 'İptal',       style: 'cancel' },
    ]);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!res.canceled) {
      const draft = '📷 Fotoğraf gönderildi';
      setMessages(prev => [...prev, { id: Date.now(), content: draft, sender: currentUser, timestamp: new Date().toISOString(), type: 'IMAGE' }]);
      try { await fetch(privateMode ? `${CHAT_API}/send-private` : `${CHAT_API}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(privateMode ? { senderId: currentUser.id, receiverId: Number(id), content: draft } : { circleId: Number(id), senderId: currentUser.id, content: draft }) }); } catch (e) {}
    }
  };

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos });
    if (!res.canceled) {
      const draft = '🎥 Video gönderildi';
      setMessages(prev => [...prev, { id: Date.now(), content: draft, sender: currentUser, timestamp: new Date().toISOString(), type: 'VIDEO' }]);
      try { await fetch(privateMode ? `${CHAT_API}/send-private` : `${CHAT_API}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(privateMode ? { senderId: currentUser.id, receiverId: Number(id), content: draft } : { circleId: Number(id), senderId: currentUser.id, content: draft }) }); } catch (e) {}
    }
  };

  // ── Üye Davet ────────────────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`${CIRCLE_API}/${id}/invite?email=${encodeURIComponent(inviteEmail)}`, { method: 'POST' });
      if (res.ok) { Alert.alert('✅ Başarılı', `${inviteEmail} gruba eklendi!`); setInviteEmail(''); setShowInvite(false); fetchMembers(); }
      else { const t = await res.text(); Alert.alert('Hata', t); }
    } catch (e) { Alert.alert('Hata', 'Bağlantı hatası.'); }
    setInviting(false);
  };

  // ── Görüntülü / Sesli Arama ─────────────────────────────────────────────────
  const startCall = (type: 'voice' | 'video') => {
    router.push({ pathname: '/(tabs)/call', params: { type, circleId: id, circleName: name } } as any);
  };

  const msgBg: Record<string, string> = { VOICE: '#e0f2fe', IMAGE: '#fef3c7', VIDEO: '#fee2e2', TEXT: '' };

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f4f8' }}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top'] as any} style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={30} color="#6d28d9" />
          </TouchableOpacity>

          <View style={styles.identity}>
            <View style={styles.avatarMini}><Text style={styles.avatarMiniTxt}>{name?.charAt(0)}</Text></View>
            <View>
              <Text style={styles.headerTitle}>{name}</Text>
              <Text style={styles.memberCount}>{privateMode ? 'Özel Sohbet' : `${members.length} üye`}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.headerBtn} onPress={() => startCall('voice')}>
            <Ionicons name="call" size={22} color="#6d28d9" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => startCall('video')}>
            <Ionicons name="videocam" size={24} color="#6d28d9" />
          </TouchableOpacity>
          {!privateMode && isAdmin && (
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowInvite(true)}>
              <Ionicons name="person-add" size={22} color="#6d28d9" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* ── Messages ── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={i => i.id.toString()}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = currentUser && item.sender.id === currentUser.id;
          const extra = msgBg[item.type || 'TEXT'];
          const time = new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, extra ? { backgroundColor: extra } : {}]}>
              {!isMe && <Text style={styles.senderName}>{item.sender.username}</Text>}
              <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
              <Text style={[styles.timeText, isMe && styles.timeTextMe]}>{time}</Text>
            </View>
          );
        }}
      />

      {/* ── Input Bar ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView edges={['bottom'] as any} style={{ backgroundColor: '#fff' }}>
          <View style={styles.inputBar}>
            <TouchableOpacity onPress={handleAttach} style={styles.inputIcon}>
              <Ionicons name="add-circle" size={30} color="#6d28d9" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Mesaj yazın..."
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              multiline
              returnKeyType="send"
              onSubmitEditing={sendText}
              blurOnSubmit={false}
            />

            {inputText.trim().length > 0 ? (
              <TouchableOpacity onPress={sendText} style={styles.sendBtn}>
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={isRecording ? stopRecording : startRecording}
                style={[styles.micBtn, isRecording && styles.micBtnRecording]}
              >
                <Ionicons name={isRecording ? 'stop' : 'mic'} size={20} color={isRecording ? '#fff' : '#6d28d9'} />
              </TouchableOpacity>
            )}
          </View>
          {isRecording && (
            <View style={styles.recordingBanner}>
              <ActivityIndicator color="#ef4444" size="small" />
              <Text style={styles.recordingText}>Kaydediliyor… bırakınca gönderilir</Text>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ── Davet Modal ── */}
      <Modal visible={showInvite} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Üye Davet Et</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="E-posta adresi"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowInvite(false)}>
                <Text style={styles.modalCancelTxt}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={handleInvite} disabled={inviting}>
                {inviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalOkTxt}>Davet Et</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Haptics optional import
let Haptics: any;
try { Haptics = require('expo-haptics'); } catch (e) { /* ignore */ }

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  headerBtn: { padding: 6 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  avatarMini: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  avatarMiniTxt: { fontSize: 16, fontWeight: '800', color: '#6d28d9' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  memberCount: { fontSize: 11, color: '#9ca3af' },

  chatList: { padding: 14, paddingBottom: 20 },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 18, marginBottom: 10 },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#6d28d9', borderBottomRightRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', color: '#6d28d9', marginBottom: 3 },
  msgText: { fontSize: 15, color: '#1f2937', lineHeight: 21 },
  msgTextMe: { color: '#fff' },
  timeText: { fontSize: 10, color: '#9ca3af', marginTop: 5, alignSelf: 'flex-end' },
  timeTextMe: { color: '#c4b5fd' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, gap: 8, borderTopWidth: 1, borderTopColor: '#f1f1f1' },
  inputIcon: { paddingBottom: 6 },
  textInput: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#111', maxHeight: 120, lineHeight: 20 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6d28d9', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  micBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  micBtnRecording: { backgroundColor: '#ef4444' },
  recordingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  recordingText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 18 },
  modalInput: { backgroundColor: '#f3f4f6', padding: 14, borderRadius: 12, fontSize: 16, color: '#111', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelTxt: { fontWeight: '700', color: '#374151' },
  modalOk: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#6d28d9', alignItems: 'center' },
  modalOkTxt: { fontWeight: '700', color: '#fff', fontSize: 15 },
});
