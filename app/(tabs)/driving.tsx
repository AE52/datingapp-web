import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL, NOTIFICATIONS_API_URL, getStoredUser } from '@/api';

const W = Dimensions.get('window').width;

const BADGES = [
  { id: 1, name: 'Gümüş Sürücü', icon: 'ribbon', color: '#94a3b8', desc: '100 km güvenli sürüş' },
  { id: 2, name: 'Hız Kuralları', icon: 'speedometer', color: '#10b981', desc: 'Sıfır hız ihlali haftası' },
  { id: 3, name: 'Gece Kuşu', icon: 'moon', color: '#6366f1', desc: '5 gece sürüşü' },
  { id: 4, name: 'Odaklı', icon: 'phone-portrait-outline', color: '#f59e0b', desc: 'Sıfır telefon kullanımı' },
];

export default function DrivingScreen() {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [circleId, setCircleId] = useState<number>(1);

  useEffect(() => {
    const load = async () => {
      const storedUser = await getStoredUser();
      if (storedUser) {
        setUser(storedUser);
        try {
          const circlesRes = await fetch(`${API_BASE_URL.replace('/users', '/circles')}/user/${storedUser.id}`);
          const circles = await circlesRes.json();
          if (Array.isArray(circles) && circles[0]?.id) {
            setCircleId(circles[0].id);
          }
        } catch {}
      }
    };
    load();
  }, []);

  const shareWeek = async () => {
    Alert.alert('Haftalık Özet', 'Şık bir özet kartı oluşturuldu. Paylaşmak ister misiniz?', [
      { text: 'Paylaş', onPress: async () => {
        try {
          await Sharing.shareAsync(`data:text/plain,Surus skoru 92%0AToplam mesafe 142.5 km%0AGuvenlik puani 94`);
        } catch {
          Alert.alert('Paylasim', 'Paylasim bu cihazda kullanilamadi.');
        }
      } },
      { text: 'İptal', style: 'cancel' }
    ]);
  };

  const triggerCrashAssist = async () => {
    if (!user) return;
    try {
      await fetch(`${NOTIFICATIONS_API_URL}/help-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          circleId,
          severity: 'high',
          content: 'Muhtemel kaza veya arac destegi talebi',
        }),
      });
      Alert.alert('Acil yardim baslatildi', 'Ailene kritik surus yardim bildirimi gonderildi.');
    } catch {
      Alert.alert('Hata', 'Acil yardim baslatilamadi.');
    }
  };
  
  const weeklyData = {
    labels: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    datasets: [{ data: [12, 45, 28, 80, 99, 43, 67] }]
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Sürüş Analizi</Text>
          <TouchableOpacity onPress={() => setShowAnalysis(true)} style={styles.reportBtn}>
            <Ionicons name="stats-chart" size={20} color="#fff" />
            <Text style={styles.reportBtnText}>Haftalık Rapor</Text>
          </TouchableOpacity>
        </View>

        {/* Skor Kartı */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreTitle}>Sürüş Skorun</Text>
            <Text style={styles.scoreSub}>Aferin! Geçen haftadan %12 daha iyisin.</Text>
          </View>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNum}>92</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yol Yardimi</Text>
          <TouchableOpacity style={styles.assistCard} onPress={triggerCrashAssist}>
            <Ionicons name="warning" size={28} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.assistTitle}>Kaza / Yol Yardimi Baslat</Text>
              <Text style={styles.assistText}>Kritik yardim akisini circle uyelerine iletir.</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Rozetler Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Başarı Rozetlerin</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
            {BADGES.map(badge => (
              <View key={badge.id} style={styles.badgeCard}>
                <View style={[styles.badgeIcon, { backgroundColor: badge.color + '20' }]}>
                  <Ionicons name={badge.icon as any} size={30} color={badge.color} />
                </View>
                <Text style={styles.badgeName}>{badge.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Grafik Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Haftalık Hız Trendi</Text>
          <LineChart
            data={weeklyData}
            width={W - 40}
            height={220}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(109, 40, 217, ${opacity})`,
              labelColor: () => '#666',
              propsForDots: { r: '6', strokeWidth: '2', stroke: '#6d28d9' }
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {/* Son Yolculuklar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son Yolculuklar</Text>
          <View style={styles.tripRow}>
            <Ionicons name="pin" size={20} color="#6d28d9" />
            <View style={styles.tripInfo}>
              <Text style={styles.tripRoute}>Ev → İş</Text>
              <Text style={styles.tripMeta}>08:15 • 12km • 22dk</Text>
            </View>
            <Text style={styles.tripScore}>98/100</Text>
          </View>
          <View style={styles.tripRow}>
            <Ionicons name="pin" size={20} color="#6d28d9" />
            <View style={styles.tripInfo}>
              <Text style={styles.tripRoute}>İş → Market</Text>
              <Text style={styles.tripMeta}>18:30 • 4km • 10dk</Text>
            </View>
            <Text style={styles.tripScore}>85/100</Text>
          </View>
        </View>

      </ScrollView>

      {/* Haftalık Rapor Modalı */}
      <Modal visible={showAnalysis} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAnalysis(false)}>
              <Ionicons name="close" size={32} color="#111" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Haftalık Analiz</Text>
            <View style={{ width: 32 }} />
          </View>
          
          <ScrollView style={{ padding: 20 }}>
            <View style={styles.insightCard}>
              <Ionicons name="flash" size={30} color="#f59e0b" />
              <Text style={styles.insightTitle}>Hız Analizi</Text>
              <Text style={styles.insightDesc}>Bu hafta ortalama hızın 42 km/h oldu. Şehir içi limitlerde kalman mükemmel.</Text>
            </View>

            <View style={styles.insightCard}>
              <Ionicons name="hand-right" size={30} color="#ef4444" />
              <Text style={styles.insightTitle}>Ani Frenler</Text>
              <Text style={styles.insightDesc}>Hafta başında 3 kez ani fren tespit edildi. Takip mesafesine dikkat etmelisin.</Text>
            </View>

            <View style={[styles.insightCard, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="trophy" size={30} color="#10b981" />
              <Text style={styles.insightTitle}>Haftanın Sürücüsü</Text>
              <Text style={styles.insightDesc}>Sen ve Ayşe arasında süren rekabette bu hafta %2 farkla öndesin!</Text>
            </View>

            <TouchableOpacity style={styles.shareCardBtn} onPress={shareWeek}>
              <Ionicons name="share-social" size={22} color="#fff" />
              <Text style={styles.shareCardBtnTxt}>Haftalık Özetini Paylaş</Text>
            </TouchableOpacity>

            <View style={styles.summaryBox}>
               <Text style={styles.summaryText}>Toplam Mesafe: 142.5 km</Text>
               <Text style={styles.summaryText}>Sürüş Süresi: 6s 12dk</Text>
               <Text style={styles.summaryText}>Güvenlik Puanı: 94</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#1e293b' },
  reportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6d28d9', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, gap: 8 },
  reportBtnText: { color: '#fff', fontWeight: '700' },
  scoreCard: { backgroundColor: '#6d28d9', margin: 20, borderRadius: 24, padding: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreInfo: { flex: 1 },
  scoreTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  scoreSub: { color: '#ddd', fontSize: 13, marginTop: 4 },
  scoreCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  scoreNum: { color: '#fff', fontSize: 24, fontWeight: '900' },
  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#334155', marginBottom: 15 },
  badgeScroll: { flexDirection: 'row' },
  badgeCard: { alignItems: 'center', marginRight: 20, width: 90 },
  badgeIcon: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  badgeName: { fontSize: 12, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  chart: { marginVertical: 10, borderRadius: 16 },
  assistCard: { backgroundColor: '#ef4444', padding: 18, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  assistTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  assistText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  tripRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 10, elevation: 2 },
  tripInfo: { flex: 1, marginLeft: 12 },
  tripRoute: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  tripMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  tripScore: { fontSize: 14, fontWeight: '800', color: '#10b981' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  insightCard: { padding: 20, borderRadius: 20, backgroundColor: '#f8fafc', marginBottom: 15 },
  insightTitle: { fontSize: 18, fontWeight: '800', marginTop: 10 },
  insightDesc: { fontSize: 14, color: '#64748b', marginTop: 6 },
  shareCardBtn: { backgroundColor: '#6d28d9', padding: 18, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, marginBottom: 20 },
  shareCardBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  summaryBox: { backgroundColor: '#6d28d9', padding: 25, borderRadius: 24, marginTop: 10 },
  summaryText: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 }
});
