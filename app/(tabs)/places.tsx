import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Alert, Modal, TextInput, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { API_BASE_URL, getStoredUser, replaceStoredUser } from '@/api';

const PLACE_API = API_BASE_URL.replace('/users', '/places');

const PLACE_ICONS: Record<string, string> = {
  'Ev': '🏠',
  'İş': '🏢',
  'Okul': '🎓',
  'Kafe': '☕',
  'Spor': '⚽',
  'Alışveriş': '🛒',
  'Hastane': '🏥',
  'Favori': '⭐',
};

const FREQ_OPTIONS = [
  { label: 'Her dakika', value: 1, color: '#f44336' },
  { label: 'Her 5 dakika', value: 5, color: '#ff9800' },
  { label: 'Her 10 dakika', value: 10, color: '#4caf50' },
  { label: 'Her 30 dakika', value: 30, color: '#2196f3' },
  { label: 'Her saat', value: 60, color: '#9c27b0' },
];

export default function PlacesScreen() {
  const { circleId, circleName } = useLocalSearchParams();
  const [places, setPlaces] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedFreq, setSelectedFreq] = useState(5);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [savingPlaceId, setSavingPlaceId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const u = await getStoredUser();
      if (u) {
        setCurrentUser(u);
        setSelectedFreq(u.locationUpdateFrequency || 5);
      }
    };
    load();
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      const res = await fetch(`${PLACE_API}/${circleId}`);
      const data = await res.json();
      setPlaces(data);
    } catch (e) {
      console.log('Yerler çekilemedi', e);
    }
  };

  const handleFreqChange = async (freq: number) => {
    setSelectedFreq(freq);
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/${currentUser.id}/frequency`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency: freq }),
      });
      if (res.ok) {
        const updated = await res.json();
        await replaceStoredUser(updated);
        Alert.alert('✅ Güncellendi', `Konum artık her ${freq} dakikada bir paylaşılıyor.`);
      }
    } catch (e) { console.log(e); }
  };

  const handleAddPlace = async () => {
    if (!newName || !newLat || !newLng) {
      Alert.alert('Hata', 'Tüm alanları doldurun.');
      return;
    }
    try {
      await fetch(`${PLACE_API}/create?circleId=${circleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, latitude: parseFloat(newLat), longitude: parseFloat(newLng), radiusInMeters: 150, alertOnEnter: true, alertOnExit: true }),
      });
      setShowAddModal(false);
      setNewName(''); setNewLat(''); setNewLng('');
      fetchPlaces();
    } catch (e) {
      Alert.alert('Hata', 'Yer eklenemedi.');
    }
  };

  const updatePlaceSetting = async (placeId: number, patch: Record<string, unknown>) => {
    setSavingPlaceId(placeId);
    try {
      await fetch(`${PLACE_API}/${placeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setPlaces((prev) => prev.map((place) => place.id === placeId ? { ...place, ...patch } : place));
    } finally {
      setSavingPlaceId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={30} color="#8b5cf6" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📍 Yerler & Ayarlar</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={26} color="#8b5cf6" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={[]}
          ListHeaderComponent={
            <>
              {/* KONUM GÜNCELLEME SIKLIĞI */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📡 Konum Güncelleme Sıklığı</Text>
                <Text style={styles.sectionSubtitle}>Konumunuz {circleName} grubunda kaç dakikada bir paylaşılsın?</Text>
                <View style={styles.freqGrid}>
                  {FREQ_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.freqChip, selectedFreq === opt.value && { backgroundColor: opt.color, borderColor: opt.color }]}
                      onPress={() => handleFreqChange(opt.value)}
                    >
                      <Text style={[styles.freqChipText, selectedFreq === opt.value && { color: '#fff' }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* FAVORİ YERLER */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⭐ Favori Yerler</Text>
                <Text style={styles.sectionSubtitle}>{circleName} grubunun kayıtlı güvenli bölgeleri</Text>
              </View>
            </>
          }
          ListEmptyComponent={<View />}
          renderItem={null}
          keyExtractor={() => ''}
        />

        {/* PLACES LIST — outside FlatList for simplicity */}
        <FlatList
          data={places}
          keyExtractor={item => item.id.toString()}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
          renderItem={({ item }) => {
            const icon = PLACE_ICONS[item.name] || '📌';
            return (
              <View style={styles.placeCard}>
                <View style={styles.placeIcon}>
                  <Text style={{ fontSize: 26 }}>{icon}</Text>
                </View>
              <View style={styles.placeBody}>
                <Text style={styles.placeName}>{item.name}</Text>
                <Text style={styles.placeCoord}>
                  {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}  •  {item.radiusInMeters}m yarıçap
                </Text>
                <View style={styles.settingRow}>
                  <TouchableOpacity style={[styles.settingChip, item.alertOnEnter && styles.settingChipActive]} onPress={() => updatePlaceSetting(item.id, { alertOnEnter: !item.alertOnEnter })}>
                    <Text style={[styles.settingChipText, item.alertOnEnter && styles.settingChipTextActive]}>Giris Uyarisi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.settingChip, item.alertOnExit && styles.settingChipActive]} onPress={() => updatePlaceSetting(item.id, { alertOnExit: !item.alertOnExit })}>
                    <Text style={[styles.settingChipText, item.alertOnExit && styles.settingChipTextActive]}>Cikis Uyarisi</Text>
                  </TouchableOpacity>
                </View>
              </View>
                <Ionicons name={savingPlaceId === item.id ? 'sync' : 'navigate-outline'} size={22} color="#8b5cf6" style={{ paddingLeft: 10 }} />
              </View>
            );
          }}
        />

        {/* ADD PLACE MODAL */}
        <Modal visible={showAddModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Yeni Yer Ekle</Text>
              <TextInput style={styles.modalInput} placeholder="Yer Adı (Ev, Okul...)" value={newName} onChangeText={setNewName} />
              <TextInput style={styles.modalInput} placeholder="Enlem (Latitude)" value={newLat} onChangeText={setNewLat} keyboardType="decimal-pad" />
              <TextInput style={styles.modalInput} placeholder="Boylam (Longitude)" value={newLng} onChangeText={setNewLng} keyboardType="decimal-pad" />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalCancelText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalAdd} onPress={handleAddPlace}>
                  <Text style={styles.modalAddText}>Ekle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  addBtn: { padding: 5 },

  section: { marginTop: 24, marginHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#888', marginBottom: 14 },

  freqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  freqChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 2, borderColor: '#e0e0e0', backgroundColor: '#fff' },
  freqChipText: { fontSize: 14, fontWeight: '600', color: '#555' },

  placeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  placeIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0e6ff', justifyContent: 'center', alignItems: 'center' },
  placeBody: { flex: 1, marginLeft: 14 },
  placeName: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 3 },
  placeCoord: { fontSize: 12, color: '#888' },
  settingRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  settingChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f3f4f6' },
  settingChipActive: { backgroundColor: '#ede9fe' },
  settingChipText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
  settingChipTextActive: { color: '#6d28d9' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20, color: '#111' },
  modalInput: { backgroundColor: '#f2f2f7', padding: 14, borderRadius: 12, fontSize: 16, marginBottom: 12, color: '#111' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#f2f2f7', alignItems: 'center' },
  modalCancelText: { fontWeight: '600', color: '#444', fontSize: 16 },
  modalAdd: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#8b5cf6', alignItems: 'center' },
  modalAddText: { fontWeight: '700', color: '#fff', fontSize: 16 },
});
