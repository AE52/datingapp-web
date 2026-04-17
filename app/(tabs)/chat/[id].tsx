import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { CHAT_API_URL, CIRCLES_API_URL, getStoredUser, type AppUser } from '@/api';
import { createCallSession } from '@/lib/calls';
import { getMediaDownloadUrl, uploadMediaAsset } from '@/lib/media';

type MessageKind = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';

type Message = {
  id: number;
  content: string;
  sender: { id: number; username: string };
  receiver?: { id: number; username: string } | null;
  timestamp: string;
  mediaAssetId?: number | null;
  mediaKind?: MessageKind | null;
};

type CircleMember = {
  id: number;
  username: string;
};

const ATTACHMENT_COLORS: Record<MessageKind, string> = {
  TEXT: '#ffffff',
  IMAGE: '#fef3c7',
  VIDEO: '#fee2e2',
  AUDIO: '#e0f2fe',
};

export default function ChatDetailScreen() {
  const { id, name, isPrivate } = useLocalSearchParams<{ id: string; name: string; isPrivate?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<number, string>>({});

  const privateMode = isPrivate === '1';
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const listRef = useRef<FlatList<Message>>(null);

  const resolveMediaUrls = useEffectEvent(async (items: Message[]) => {
    const missingMediaIds = items
      .filter((message) => message.mediaAssetId && !mediaUrls[message.mediaAssetId])
      .map((message) => message.mediaAssetId) as number[];

    if (!missingMediaIds.length) return;

    for (const mediaAssetId of missingMediaIds) {
      try {
        const downloadUrl = await getMediaDownloadUrl(mediaAssetId);
        setMediaUrls((current) => ({ ...current, [mediaAssetId]: downloadUrl }));
      } catch {
      }
    }
  });

  const fetchMessages = useEffectEvent(async (currentUserId: number) => {
    try {
      const endpoint = privateMode
        ? `${CHAT_API_URL}/private/${currentUserId}/${id}`
        : `${CHAT_API_URL}/${id}`;
      const response = await fetch(endpoint);
      if (!response.ok) return;

      const payload = await response.json() as Message[];
      setMessages(payload);
      await resolveMediaUrls(payload);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
    } catch {
    }
  });

  const fetchMembers = useEffectEvent(async () => {
    try {
      const response = await fetch(`${CIRCLES_API_URL}/${id}`);
      if (!response.ok) return;
      const circle = await response.json() as { members?: CircleMember[] };
      setMembers(circle.members ?? []);
    } catch {
    }
  });

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const user = await getStoredUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      if (!active) return;
      setCurrentUser(user);
      setIsAdmin(user.admin);
      await fetchMessages(user.id);
      if (!privateMode) {
        await fetchMembers();
      }
      if (active) {
        setLoading(false);
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, [fetchMembers, fetchMessages, id, privateMode]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const intervalId = setInterval(() => {
      void fetchMessages(currentUser.id);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [currentUser?.id, fetchMessages]);

  const sendPayload = async (payload: Record<string, unknown>) => {
    const response = await fetch(privateMode ? `${CHAT_API_URL}/send-private` : `${CHAT_API_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Mesaj gonderilemedi.');
    }
  };

  const sendText = async () => {
    if (!currentUser || !messageInput.trim()) return;
    const draft = messageInput.trim();
    setMessageInput('');

    try {
      await sendPayload(privateMode
        ? { senderId: currentUser.id, receiverId: Number(id), content: draft }
        : { circleId: Number(id), senderId: currentUser.id, content: draft });
      await fetchMessages(currentUser.id);
    } catch {
      Alert.alert('Hata', 'Mesaj gonderilemedi.');
      setMessageInput(draft);
    }
  };

  const sendAttachment = async (
    category: string,
    mediaKind: MessageKind,
    asset: { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number | null },
    content: string,
    fallbackType: string,
  ) => {
    if (!currentUser) return;

    setSendingMedia(true);
    try {
      const mediaAsset = await uploadMediaAsset(currentUser.id, category, asset, fallbackType);
      await sendPayload(privateMode
        ? {
            senderId: currentUser.id,
            receiverId: Number(id),
            content,
            mediaAssetId: mediaAsset.id,
            mediaKind,
          }
        : {
            circleId: Number(id),
            senderId: currentUser.id,
            content,
            mediaAssetId: mediaAsset.id,
            mediaKind,
          });
      await fetchMessages(currentUser.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Medya gonderilemedi.';
      Alert.alert('Hata', message);
    } finally {
      setSendingMedia(false);
    }
  };

  const startRecording = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Izin gerekli', 'Sesli mesaj icin mikrofon izni gerekli.');
      return;
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    });
    await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
    recorder.record();
  };

  const stopRecording = async () => {
    if (!currentUser || !recorderState.isRecording) return;

    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return;

    const durationSeconds = Math.max(1, Math.round(recorderState.durationMillis / 1000));
    await sendAttachment(
      'chat-audio',
      'AUDIO',
      {
        uri,
        fileName: `voice-${Date.now()}.m4a`,
        fileSize: null,
        mimeType: 'audio/m4a',
      },
      `Sesli mesaj (${durationSeconds} sn)`,
      'audio/m4a',
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    await sendAttachment(
      'chat-image',
      'IMAGE',
      {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      },
      asset.fileName || 'Fotograf',
      'image/jpeg',
    );
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];
    await sendAttachment(
      'chat-video',
      'VIDEO',
      {
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      },
      asset.fileName || 'Video',
      'video/mp4',
    );
  };

  const handleAttach = () => {
    Alert.alert('Ekle', 'Ne gondermek istiyorsunuz?', [
      { text: 'Fotograf', onPress: pickImage },
      { text: 'Video', onPress: pickVideo },
      { text: 'Iptal', style: 'cancel' },
    ]);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const response = await fetch(`${CIRCLES_API_URL}/${id}/invite?email=${encodeURIComponent(inviteEmail.trim())}`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setInviteEmail('');
      setShowInvite(false);
      await fetchMembers();
      Alert.alert('Basarili', `${inviteEmail.trim()} gruba davet edildi.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Davet gonderilemedi.';
      Alert.alert('Hata', message);
    } finally {
      setInviting(false);
    }
  };

  const startCall = async (mode: 'voice' | 'video') => {
    if (!privateMode || !currentUser) {
      Alert.alert('Yakinda', 'Coklu kisi aramalari icin SFU katmani sonraki pakette eklenecek.');
      return;
    }

    try {
      const session = await createCallSession(currentUser.id, Number(id), mode);
      router.push({
        pathname: '/(tabs)/call',
        params: {
          callId: session.callId,
          type: mode,
          peerUserId: id,
          circleName: name,
        },
      } as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Arama baslatilamadi.';
      Alert.alert('Arama hatasi', message);
    }
  };

  const renderMediaBody = (message: Message, isMe: boolean) => {
    if (!message.mediaKind || !message.mediaAssetId) {
      return <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{message.content}</Text>;
    }

    const mediaUrl = mediaUrls[message.mediaAssetId];
    if (message.mediaKind === 'IMAGE' && mediaUrl) {
      return (
        <View style={styles.mediaStack}>
          <Image source={{ uri: mediaUrl }} style={styles.imageAttachment} resizeMode="cover" />
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{message.content}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.attachmentCard, isMe && styles.attachmentCardMe]}
        onPress={() => mediaUrl ? Linking.openURL(mediaUrl) : undefined}
        disabled={!mediaUrl}
      >
        <Ionicons
          name={message.mediaKind === 'VIDEO' ? 'videocam' : message.mediaKind === 'AUDIO' ? 'mic' : 'image'}
          size={20}
          color={isMe ? '#fff' : '#6d28d9'}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.attachmentTitle, isMe && styles.messageTextMe]}>
            {message.mediaKind === 'VIDEO' ? 'Video eki' : message.mediaKind === 'AUDIO' ? 'Sesli mesaj' : 'Medya eki'}
          </Text>
          <Text style={[styles.attachmentSubtitle, isMe && styles.timeTextMe]}>
            {mediaUrl ? 'Acmak icin dokun' : 'Baglanti hazirlaniyor'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!currentUser || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color="#6d28d9" />
          </TouchableOpacity>

          <View style={styles.identity}>
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>{String(name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>{name}</Text>
              <Text style={styles.memberCount}>{privateMode ? 'Ozel sohbet' : `${members.length} uye`}</Text>
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

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.sender.id === currentUser.id;
          const kind = item.mediaKind || 'TEXT';
          const bubbleColor = isMe ? '#6d28d9' : ATTACHMENT_COLORS[kind];
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, { backgroundColor: bubbleColor }]}>
              {!isMe && <Text style={styles.senderName}>{item.sender.username}</Text>}
              {renderMediaBody(item, isMe)}
              <Text style={[styles.timeText, isMe && styles.timeTextMe]}>
                {new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#fff' }}>
          <View style={styles.inputBar}>
            <TouchableOpacity onPress={handleAttach} style={styles.iconButton} disabled={sendingMedia}>
              <Ionicons name="add-circle" size={30} color="#6d28d9" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Mesaj yazin..."
              placeholderTextColor="#9ca3af"
              value={messageInput}
              onChangeText={setMessageInput}
              multiline
            />

            {messageInput.trim().length > 0 ? (
              <TouchableOpacity onPress={sendText} style={styles.sendButton}>
                <Ionicons name="arrow-up" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={recorderState.isRecording ? stopRecording : startRecording}
                style={[styles.micButton, recorderState.isRecording && styles.micButtonRecording]}
                disabled={sendingMedia}
              >
                <Ionicons name={recorderState.isRecording ? 'stop' : 'mic'} size={20} color={recorderState.isRecording ? '#fff' : '#6d28d9'} />
              </TouchableOpacity>
            )}
          </View>

          {(sendingMedia || recorderState.isRecording) && (
            <View style={styles.statusBanner}>
              <ActivityIndicator size="small" color={recorderState.isRecording ? '#ef4444' : '#6d28d9'} />
              <Text style={[styles.statusBannerText, recorderState.isRecording && { color: '#ef4444' }]}>
                {recorderState.isRecording ? 'Kayit aliniyor, tekrar dokununca gonderilecek.' : 'Medya yukleniyor...'}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>

      <Modal visible={showInvite} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Uye davet et</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="E-posta adresi"
              placeholderTextColor="#9ca3af"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowInvite(false)}>
                <Text style={styles.modalCancelText}>Vazgec</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleInvite} disabled={inviting}>
                {inviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Davet et</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f8' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  headerBtn: { padding: 6 },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: { fontSize: 16, fontWeight: '800', color: '#6d28d9' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  memberCount: { fontSize: 11, color: '#9ca3af' },
  chatList: { padding: 14, paddingBottom: 24 },
  bubble: { maxWidth: '84%', padding: 12, borderRadius: 18, marginBottom: 10 },
  bubbleThem: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleMe: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', color: '#6d28d9', marginBottom: 4 },
  messageText: { fontSize: 15, color: '#1f2937', lineHeight: 21 },
  messageTextMe: { color: '#fff' },
  timeText: { fontSize: 10, color: '#9ca3af', marginTop: 6, alignSelf: 'flex-end' },
  timeTextMe: { color: '#ddd6fe' },
  mediaStack: { gap: 8 },
  imageAttachment: { width: 220, height: 180, borderRadius: 14, backgroundColor: '#e5e7eb' },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  attachmentCardMe: { backgroundColor: 'rgba(255,255,255,0.14)' },
  attachmentTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  attachmentSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f1f1',
  },
  iconButton: { paddingBottom: 6 },
  textInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    maxHeight: 120,
    lineHeight: 20,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6d28d9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  micButtonRecording: { backgroundColor: '#ef4444' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  statusBannerText: { fontSize: 13, fontWeight: '600', color: '#6d28d9' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 18 },
  modalInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14 },
  modalCancelText: { fontWeight: '700', color: '#374151' },
  modalConfirm: { flex: 1, alignItems: 'center', backgroundColor: '#6d28d9', borderRadius: 12, padding: 14 },
  modalConfirmText: { fontWeight: '700', color: '#fff' },
});
