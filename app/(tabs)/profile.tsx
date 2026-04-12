import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { API_BASE_URL, NOTIFICATIONS_API_URL, getStoredUser } from '@/api';

const AVATAR_COLORS = ['#6d28d9', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [avatarColor, setAvatarColor] = useState('#6d28d9');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [bubbleEnabled, setBubbleEnabled] = useState(false);
  const [circleId, setCircleId] = useState<number>(1);

  useEffect(() => {
    const load = async () => {
      const u = await getStoredUser();
      if (u) {
        setUser(u);
        setGhostMode(u.ghostMode);
        setBubbleEnabled(u.bubbleEnabled);
        setEditName(u.username);
        const saved = await AsyncStorage.getItem(`avatarColor_${u.id}`);
        if (saved) setAvatarColor(saved);
        try {
          const circlesRes = await fetch(`${API_BASE_URL.replace('/users', '/circles')}/user/${u.id}`);
          const circles = await circlesRes.json();
          if (Array.isArray(circles) && circles[0]?.id) {
            setCircleId(circles[0].id);
          }
        } catch {}
      }
    };
    load();
  }, []);

  const toggleGhostMode = async (val: boolean) => {
    setGhostMode(val);
    if (!user) return;
    try {
      await fetch(`${API_BASE_URL}/${user.id}/ghost`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghostMode: val }),
      });
      const updated = { ...user, ghostMode: val };
      await AsyncStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch (_) {}
  };

  const saveEditName = async () => {
    if (!user || !editName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/${user.id}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editName }),
      });
      if (res.ok) {
        const updated = { ...user, username: editName };
        await AsyncStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        setShowEdit(false);
        Alert.alert('✅', 'İsim güncellendi!');
      }
    } catch (_) { Alert.alert('Hata', 'Güncellenemedi.'); }
  };

  const pickColor = async (color: string) => {
    setAvatarColor(color);
    if (user) await AsyncStorage.setItem(`avatarColor_${user.id}`, color);
    setShowColorPicker(false);
  };

  const toggleBubbleMode = async (val: boolean) => {
    if (!user) return;
    setBubbleEnabled(val);
    try {
      let latitude = user.latitude;
      let longitude = user.longitude;
      if (val) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({});
          latitude = current.coords.latitude;
          longitude = current.coords.longitude;
        }
      }
      const res = await fetch(`${API_BASE_URL}/${user.id}/bubble`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: val,
          latitude,
          longitude,
          radiusKm: 0.8,
          durationMinutes: val ? 120 : 0,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        await AsyncStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
      }
    } catch {}
  };

  const sendLowBatteryAlert = async () => {
    if (!user) return;
    try {
      await fetch(`${NOTIFICATIONS_API_URL}/low-battery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          circleId,
          batteryLevel: user.batteryLevel ?? 15,
        }),
      });
      Alert.alert('Bildirim gonderildi', 'Dusuk pil uyarisini cevrendeki uyelere ilettik.');
    } catch {
      Alert.alert('Hata', 'Dusuk pil uyarisi gonderilemedi.');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    router.replace('/login');
  };

  if (!user) return null;

  const STATS = [
    { label: 'Toplam Mesaj', value: '248', icon: 'chatbubble' },
    { label: 'SOS Gönderildi', value: '0', icon: 'alert-circle' },
    { label: 'Aktif Grup', value: '4', icon: 'people' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profilim</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => setShowEdit(true)}>
            <Ionicons name="pencil" size={18} color="#6d28d9" />
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={() => setShowColorPicker(true)}>
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="color-palette" size={14} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{user.username}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.admin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#6d28d9" />
              <Text style={styles.adminBadgeText}>Yönetici</Text>
            </View>
          )}
        </View>

        {/* Vibe Gamification */}
        <View style={styles.gamery}>
           <View style={styles.gameTop}>
              <Text style={styles.levelTxt}>Vibe Seviyesi: 12</Text>
              <Text style={styles.rankTxt}>Gümüş Üye</Text>
           </View>
           <View style={styles.progressFull}>
              <View style={[styles.progressCurrent, { width: '65%' }]} />
           </View>
           <Text style={styles.xpTxt}>Sonraki seviyeye 340 XP kaldı</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map(st => (
            <View key={st.label} style={styles.statCard}>
              <Ionicons name={st.icon as any} size={22} color="#6d28d9" />
              <Text style={styles.statValue}>{st.value}</Text>
              <Text style={styles.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Battery */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cihaz Durumu</Text>
          <View style={styles.row}>
            <Ionicons name="battery-half-outline" size={22} color="#10b981" />
            <Text style={styles.rowLabel}>Pil Seviyesi</Text>
            <Text style={styles.rowValue}>{user.batteryLevel ?? 100}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressBar, { width: `${user.batteryLevel ?? 100}%`, backgroundColor: user.batteryLevel > 50 ? '#10b981' : user.batteryLevel > 20 ? '#f59e0b' : '#ef4444' }]} />
          </View>
          <View style={styles.row}>
            <Ionicons name="time-outline" size={22} color="#6d28d9" />
            <Text style={styles.rowLabel}>Konum Güncelleme</Text>
            <Text style={styles.rowValue}>{user.locationUpdateFrequency ?? 5} dk</Text>
          </View>
        </View>

        {/* Apple Watch Integration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apple Watch Entegrasyonu</Text>
          <View style={styles.row}>
            <Ionicons name="watch-outline" size={22} color="#10b981" />
            <Text style={styles.rowLabel}>Apple Watch ile Bağla</Text>
            <Switch value={true} trackColor={{ true: '#10b981', false: '#eee' }} />
          </View>
          <TouchableOpacity style={styles.watchBtn} onPress={() => Alert.alert('Watch Preview', 'Saatinde şu an: \n📍 Evdesin \n🔋 Pil %88 \n🚨 SOS Aktif')}>
            <Ionicons name="eye-outline" size={18} color="#6d28d9" />
            <Text style={styles.watchBtnText}>Saat Görünümünü Önizle</Text>
          </TouchableOpacity>
        </View>

        {/* Gizlilik */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gizlilik</Text>
          <View style={styles.row}>
            <Ionicons name="eye-off-outline" size={22} color="#9ca3af" />
            <Text style={styles.rowLabel}>Hayalet Modu</Text>
            <Switch value={ghostMode} onValueChange={toggleGhostMode} trackColor={{ true: '#6d28d9', false: '#e5e7eb' }} />
          </View>
          <View style={styles.row}>
            <Ionicons name="radio-outline" size={22} color="#0ea5e9" />
            <Text style={styles.rowLabel}>Bubble Konumu</Text>
            <Switch value={bubbleEnabled} onValueChange={toggleBubbleMode} trackColor={{ true: '#0ea5e9', false: '#e5e7eb' }} />
          </View>
          <Text style={styles.hint}>Hayalet modundayken konumunuz gizlenir.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guvenlik Bildirimleri</Text>
          <TouchableOpacity style={styles.watchBtn} onPress={sendLowBatteryAlert}>
            <Ionicons name="battery-dead-outline" size={18} color="#ef4444" />
            <Text style={[styles.watchBtnText, { color: '#ef4444' }]}>Dusuk pil uyarisi gonder</Text>
          </TouchableOpacity>
        </View>

        {/* Tehlike Bölgesi */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Tehlike Bölgesi</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => Alert.alert('Hesap Silinsin mi?', 'Bu işlem geri alınamaz!', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive' }])}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={styles.dangerBtnText}>Hesabımı Sil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#6d28d9" />
            <Text style={styles.logoutBtnText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={showEdit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>İsim Değiştir</Text>
            <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} placeholder="Yeni isim" placeholderTextColor="#9ca3af" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEdit(false)}><Text style={styles.modalCancelTxt}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={saveEditName}><Text style={styles.modalOkTxt}>Kaydet</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowColorPicker(false)}>
          <View style={styles.colorPickerBox}>
            <Text style={styles.modalTitle}>Avatar Rengi</Text>
            <View style={styles.colorGrid}>
              {AVATAR_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => pickColor(c)}>
                  <View style={[styles.colorCircle, { backgroundColor: c }, avatarColor === c && styles.colorCircleSelected]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#111' },
  editBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 44, fontWeight: '900', color: '#fff' },
  avatarEditBadge: { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 4 },
  email: { fontSize: 15, color: '#6b7280' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: '#ede9fe', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  adminBadgeText: { fontSize: 13, fontWeight: '700', color: '#6d28d9' },
  gamery: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  gameTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  levelTxt: { fontSize: 16, fontWeight: '800', color: '#111' },
  rankTxt: { fontSize: 13, fontWeight: '700', color: '#6d28d9' },
  progressFull: { height: 10, backgroundColor: '#f3f4f6', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressCurrent: { height: 10, backgroundColor: '#6d28d9', borderRadius: 5 },
  xpTxt: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },
  section: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rowLabel: { flex: 1, fontSize: 15, color: '#374151' },
  rowValue: { fontSize: 15, fontWeight: '700', color: '#6d28d9' },
  progressBg: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, marginBottom: 14, overflow: 'hidden' },
  progressBar: { height: 8, borderRadius: 4 },
  watchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: '#f0fdf4', borderStyle: 'dashed', borderWidth: 1, borderColor: '#10b981' },
  watchBtnText: { fontSize: 13, fontWeight: '700', color: '#10b981' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: -6 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2', marginBottom: 10 },
  dangerBtnText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: '#ede9fe' },
  logoutBtnText: { fontSize: 15, fontWeight: '700', color: '#6d28d9' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  colorPickerBox: { backgroundColor: '#fff', margin: 30, borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 18 },
  modalInput: { backgroundColor: '#f3f4f6', padding: 14, borderRadius: 12, fontSize: 16, color: '#111', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCancelTxt: { fontWeight: '700', color: '#374151' },
  modalOk: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#6d28d9', alignItems: 'center' },
  modalOkTxt: { fontWeight: '700', color: '#fff' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  colorCircle: { width: 52, height: 52, borderRadius: 26 },
  colorCircleSelected: { borderWidth: 4, borderColor: '#111' },
});
