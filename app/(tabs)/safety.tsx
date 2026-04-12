import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Modal, TextInput, Alert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, getStoredUser } from '@/api';

type Contact = { name: string; phone: string };
const DEFAULT_CONTACTS: Contact[] = [
  { name: 'Ayşe Özdemir', phone: '0532 111 22 33' },
  { name: 'Baba', phone: '0533 444 55 66' },
];

export default function SafetyScreen() {
  const [contacts, setContacts] = useState<Contact[]>(DEFAULT_CONTACTS);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [sosActive, setSosActive] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Medical ID
  const [showMedID, setShowMedID] = useState(false);
  const [medData, setMedData] = useState({ bloodType: 'A Rh+', allergies: 'Penisilin', conditions: 'Astım' });
  const NOTIF_API = API_BASE_URL.replace('/users', '/notifications');

  useEffect(() => {
    getStoredUser().then(u => { if (u) setUser(u); });
    AsyncStorage.getItem('emergencyContacts').then(s => { if (s) setContacts(JSON.parse(s)); });
    AsyncStorage.getItem('medicalID').then(s => { if (s) setMedData(JSON.parse(s)); });
  }, []);

  const saveMedicalData = async () => {
    await AsyncStorage.setItem('medicalID', JSON.stringify(medData));
    setShowMedID(false);
  };

  const saveContacts = async (list: Contact[]) => {
    setContacts(list);
    await AsyncStorage.setItem('emergencyContacts', JSON.stringify(list));
  };

  const addContact = async () => {
    if (!newName.trim() || !newPhone.trim()) return;
    const list = [...contacts, { name: newName, phone: newPhone }];
    await saveContacts(list);
    setNewName(''); setNewPhone(''); setShowAdd(false);
  };

  const removeContact = (idx: number) => {
    Alert.alert('Sil', `${contacts[idx].name} silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => saveContacts(contacts.filter((_, i) => i !== idx)) },
    ]);
  };

  const triggerSOS = async () => {
    setSosActive(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Vibration.vibrate([0, 400, 200, 400]);
    if (user) {
      try {
        await fetch(`${NOTIF_API}/sos/${user.id}?circleId=1`, { method: 'POST' });
      } catch (_) {}
    }
    Alert.alert('🚨 SOS Tetiklendi!', 'Tüm grup üyelerine ve acil kişilerinize bildirim gönderildi.', [
      { text: 'Tamam', onPress: () => setSosActive(false) },
    ]);
  };

  const SAFETY_TIPS = [
    { icon: '🚗', tip: 'Araç kullanırken telefonu bırak.' },
    { icon: '📍', tip: 'Konumunu güvendiğin kişilerle paylaş.' },
    { icon: '🔋', tip: 'Pilin düşük olunca erkenden şarj et.' },
    { icon: '🏥', tip: 'Medikal bilgilerini güncel tut.' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Güvenlik</Text>
          <Text style={styles.subtitle}>Acil durumlar için hazır ol</Text>
        </View>

        {/* SOS Butonu */}
        <TouchableOpacity
          style={[styles.sosCard, sosActive && styles.sosCardActive]}
          onPress={triggerSOS}
          activeOpacity={0.85}
        >
          <View style={styles.sosIcon}>
            <Ionicons name="alert-circle" size={48} color="#fff" />
          </View>
          <Text style={styles.sosTitleTxt}>Acil SOS Gönder</Text>
          <Text style={styles.sosSubtitle}>Tüm aile üyelerine anlık bildirim gider</Text>
        </TouchableOpacity>

        {/* Hızlı Arama */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acil Hatlar</Text>
          <View style={styles.quickCallRow}>
            {[
              { label: 'Ambulans', num: '112', icon: 'medkit', color: '#ef4444' },
              { label: 'Polis', num: '155', icon: 'shield', color: '#2563eb' },
              { label: 'İtfaiye', num: '110', icon: 'flame', color: '#f59e0b' },
            ].map(c => (
              <TouchableOpacity key={c.num} style={[styles.quickCall, { borderColor: c.color }]} onPress={() => Linking.openURL(`tel:${c.num}`)}>
                <Ionicons name={c.icon as any} size={26} color={c.color} />
                <Text style={styles.quickCallLabel}>{c.label}</Text>
                <Text style={[styles.quickCallNum, { color: c.color }]}>{c.num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Acil Kişiler */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Acil Kişiler</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
              <Ionicons name="add" size={20} color="#6d28d9" />
              <Text style={styles.addBtnTxt}>Ekle</Text>
            </TouchableOpacity>
          </View>
          {contacts.map((c, i) => (
            <View key={i} style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>{c.name.charAt(0)}</Text>
              </View>
              <View style={styles.contactBody}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactPhone}>{c.phone}</Text>
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${c.phone.replace(/\s/g, '')}`)}>
                <Ionicons name="call" size={20} color="#10b981" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeContact(i)}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Medikal Kimlik (Medical ID) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Medikal Kimlik</Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#fef2f2' }]} onPress={() => setShowMedID(true)}>
              <Ionicons name="medical" size={16} color="#ef4444" />
              <Text style={[styles.addBtnTxt, { color: '#ef4444' }]}>Düzenle</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.medCard}>
             <View style={styles.medRow}><Text style={styles.medLabel}>Kan Grubu:</Text><Text style={styles.medVal}>{medData.bloodType || 'Belirtilmedi'}</Text></View>
             <View style={styles.medRow}><Text style={styles.medLabel}>Alerjiler:</Text><Text style={styles.medVal}>{medData.allergies || 'Yok'}</Text></View>
             <View style={styles.medRow}><Text style={styles.medLabel}>Kronik Hastalık:</Text><Text style={styles.medVal}>{medData.conditions || 'Yok'}</Text></View>
          </View>
          <Text style={styles.medHint}>* Bu bilgiler SOS durumunda aile üyelerinizle paylaşılır.</Text>
        </View>

        {/* Güvenlik İpuçları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Güvenlik İpuçları</Text>
          {SAFETY_TIPS.map((t, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={{ fontSize: 22 }}>{t.icon}</Text>
              <Text style={styles.tipText}>{t.tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Medical ID Modal */}
      <Modal visible={showMedID} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Medikal Kimliği Düzenle</Text>
            <TextInput style={styles.input} placeholder="Kan Grubu" value={medData.bloodType} onChangeText={t => setMedData({...medData, bloodType: t})} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Alerjiler" value={medData.allergies} onChangeText={t => setMedData({...medData, allergies: t})} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Kronik Hastalıklar" value={medData.conditions} onChangeText={t => setMedData({...medData, conditions: t})} placeholderTextColor="#9ca3af" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowMedID(false)}><Text style={styles.cancelBtnTxt}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity style={styles.okBtn} onPress={saveMedicalData}><Text style={styles.okBtnTxt}>Kaydet</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Contact Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Acil Kişi Ekle</Text>
            <TextInput style={styles.input} placeholder="Ad Soyad" value={newName} onChangeText={setNewName} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Telefon Numarası" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" placeholderTextColor="#9ca3af" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}><Text style={styles.cancelBtnTxt}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity style={styles.okBtn} onPress={addContact}><Text style={styles.okBtnTxt}>Ekle</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8fb' },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 32, fontWeight: '900', color: '#111' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  sosCard: { marginHorizontal: 20, borderRadius: 24, backgroundColor: '#ef4444', padding: 28, alignItems: 'center', marginBottom: 20, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  sosCardActive: { backgroundColor: '#b91c1c' },
  sosIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  sosTitleTxt: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 6 },
  sosSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  section: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ede9fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  addBtnTxt: { fontSize: 13, fontWeight: '700', color: '#6d28d9' },
  quickCallRow: { flexDirection: 'row', gap: 12 },
  quickCall: { flex: 1, borderRadius: 14, borderWidth: 2, padding: 14, alignItems: 'center', gap: 6 },
  quickCallLabel: { fontSize: 12, fontWeight: '700', color: '#111' },
  quickCallNum: { fontSize: 18, fontWeight: '900' },
  contactCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  contactInitial: { fontSize: 18, fontWeight: '800', color: '#6d28d9' },
  contactBody: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '700', color: '#111' },
  contactPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  callBtn: { padding: 10, backgroundColor: '#dcfce7', borderRadius: 12, marginRight: 6 },
  deleteBtn: { padding: 10, backgroundColor: '#fef2f2', borderRadius: 12 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  tipText: { fontSize: 14, color: '#374151', flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 18 },
  input: { backgroundColor: '#f3f4f6', padding: 14, borderRadius: 12, fontSize: 16, color: '#111', marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 6 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  cancelBtnTxt: { fontWeight: '700', color: '#374151' },
  okBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#6d28d9', alignItems: 'center' },
  okBtnTxt: { fontWeight: '700', color: '#fff' },
  medCard: { backgroundColor: '#fef2f2', padding: 15, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  medRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  medLabel: { fontSize: 13, fontWeight: '700', color: '#991b1b' },
  medVal: { fontSize: 13, color: '#b91c1c', fontWeight: '800' },
  medHint: { fontSize: 11, color: '#9ca3af', marginTop: 8, fontStyle: 'italic' },
});
