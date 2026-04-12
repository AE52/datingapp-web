import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router } from 'expo-router';

type HistoryItem = {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
};

export default function HistoryScreen() {
  const { userId, username } = useLocalSearchParams<{ userId: string, username: string }>();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  const fetchHistory = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/${userId}/history`);
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const date = new Date(item.timestamp);
    return (
      <View style={styles.historyCard}>
        <View style={styles.iconCircle}>
          <Ionicons name="location" size={20} color="#6d28d9" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.address}>📍 {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text>
          <Text style={styles.time}>{date.toLocaleDateString('tr-TR')} - {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <TouchableOpacity style={styles.mapBtn} onPress={() => Alert.alert('Harita', 'Bu konuma haritada odaklanılacak.')}>
          <Ionicons name="map-outline" size={20} color="#6d28d9" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#111" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{username || 'Kullanıcı'} Geçmişi</Text>
          <Text style={styles.subtitle}>Son hareketler (Breadcrumbs)</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6d28d9" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Henüz bir hareket kaydı yok.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

import { Alert } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { marginRight: 15 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#666' },
  list: { padding: 15 },
  historyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0eaff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardContent: { flex: 1 },
  address: { fontSize: 15, fontWeight: '700', color: '#333' },
  time: { fontSize: 12, color: '#999', marginTop: 4 },
  mapBtn: { padding: 10 },
  empty: { textAlign: 'center', color: '#999', marginTop: 100, fontSize: 15 }
});
