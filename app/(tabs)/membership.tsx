import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const PLANS = [
  {
    name: 'Ücretsiz',
    price: '₺0',
    color: '#9ca3af',
    features: ['2 üyeye kadar', 'Her 5 dakika konum güncelleme', 'Temel yer bildirimleri', 'Sohbet'],
    icon: '👤',
  },
  {
    name: 'Aile',
    price: '₺89/ay',
    color: '#6d28d9',
    features: ['6 üyeye kadar', 'Her 1 dakika konum', 'Anlık bildirimler', 'Sürüş raporları', 'Sınırsız sohbet', 'Favori yerler'],
    icon: '👨‍👩‍👧‍👦',
    popular: true,
  },
  {
    name: 'Premium',
    price: '₺149/ay',
    color: '#f59e0b',
    features: ['Sınırsız üye', 'Anlık GPS', 'Sürücü analizi', 'Acil müdahale', 'Tüm aile özelliği +', 'Öncelikli destek'],
    icon: '⭐',
  },
];

export default function MembershipScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Planlar</Text>
        <Text style={styles.subtitle}>Aileniz için en uygun planı seçin</Text>

        {PLANS.map((plan) => (
          <View key={plan.name} style={[styles.card, plan.popular && styles.cardPopular]}>
            {plan.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>En Popüler</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <Text style={styles.planIcon}>{plan.icon}</Text>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={[styles.planPrice, { color: plan.color }]}>{plan.price}</Text>
              </View>
            </View>
            {plan.features.map(f => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={plan.color} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.selectBtn, { backgroundColor: plan.color }]}
              onPress={() => Alert.alert(`${plan.name} Planı`, `${plan.price} ile başlayın!`)}
            >
              <Text style={styles.selectBtnText}>Seç</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8fb' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: '#111', marginTop: 10 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 24, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4, position: 'relative' },
  cardPopular: { borderWidth: 2, borderColor: '#6d28d9' },
  popularBadge: { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: '#6d28d9', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10 },
  popularBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  planIcon: { fontSize: 36 },
  planName: { fontSize: 20, fontWeight: '800', color: '#111' },
  planPrice: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  featureText: { fontSize: 14, color: '#374151' },
  selectBtn: { marginTop: 14, padding: 15, borderRadius: 14, alignItems: 'center' },
  selectBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
