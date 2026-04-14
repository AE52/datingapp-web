import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, API_ORIGIN, getStoredUser } from '@/api';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

type User = {
  id: number;
  username: string;
  email: string;
  admin: boolean;
  batteryLevel?: number;
};

type AdminStats = {
  totalUsers: number;
  totalCircles: number;
  totalNotifications: number;
};

type AuditLog = {
  id: number;
  action: string;
  username: string;
  details: string;
  timestamp: string;
};

const INITIAL_STATS: AdminStats = {
  totalUsers: 0,
  totalCircles: 0,
  totalNotifications: 0,
};

export default function AdminScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats>(INITIAL_STATS);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'logs'>('users');

  useEffect(() => {
    const bootstrap = async () => {
      const currentUser = await getStoredUser();
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      if (!currentUser.admin) {
        Alert.alert('Yetkisiz', 'Bu ekran sadece yöneticiler için açıktır.');
        router.back();
        return;
      }
      await fetchAdminData();
    };

    bootstrap();
  }, []);

  const fetchAdminData = async () => {
    try {
      setRefreshing(true);
      const [usersRes, statsRes, logsRes] = await Promise.all([
        fetch(API_BASE_URL),
        fetch(`${API_ORIGIN}/api/admin/stats`),
        fetch(`${API_ORIGIN}/api/admin/logs`),
      ]);

      if (!usersRes.ok || !statsRes.ok || !logsRes.ok) {
        throw new Error('Admin verileri alınamadı.');
      }

      const [usersData, statsData, logsData] = await Promise.all([
        usersRes.json() as Promise<User[]>,
        statsRes.json() as Promise<AdminStats>,
        logsRes.json() as Promise<AuditLog[]>,
      ]);

      setUsers(usersData);
      setStats(statsData);
      setLogs(logsData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteUser = (userId: number, name: string) => {
    Alert.alert('Kullanıcı Sil', `${name} adlı kullanıcı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/${userId}`, { method: 'DELETE' });
            if (!response.ok) {
              throw new Error('Kullanıcı silinemedi.');
            }
            await fetchAdminData();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Silme işlemi başarısız.';
            Alert.alert('Hata', message);
          }
        },
      },
    ]);
  };

  const renderStat = (label: string, value: string, icon: keyof typeof Ionicons.glyphMap, color: string) => (
    <View style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Paneli</Text>
        <Text style={styles.subtitle}>Kullanıcı, sistem ve audit görünürlüğü</Text>
      </View>

      <View style={styles.tabBar}>
        {(['users', 'stats', 'logs'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'users' ? 'Kullanıcılar' : tab === 'stats' ? 'İstatistik' : 'Audit Log'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'users' && (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          refreshing={refreshing}
          onRefresh={fetchAdminData}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.username}>
                  {item.username} {item.admin ? <Text style={styles.adminLabel}>(Admin)</Text> : null}
                </Text>
                <Text style={styles.email}>{item.email}</Text>
                <View style={styles.batteryRow}>
                  <Ionicons name="battery-half" size={14} color="#666" />
                  <Text style={styles.batteryText}> Pil: %{item.batteryLevel ?? 0}</Text>
                </View>
              </View>
              {!item.admin && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => deleteUser(item.id, item.username)}
                >
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>Kullanıcı bulunamadı.</Text>}
        />
      )}

      {activeTab === 'stats' && (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={styles.sectionTitle}>Sistem Genel Bakış</Text>
          <View style={styles.statsGrid}>
            {renderStat('Toplam Kullanıcı', String(stats.totalUsers), 'people', '#6d28d9')}
            {renderStat('Aktif Circle', String(stats.totalCircles), 'map', '#10b981')}
            {renderStat('Bildirim', String(stats.totalNotifications), 'notifications', '#f59e0b')}
            {renderStat('Backend', 'Healthy', 'shield-checkmark', '#3b82f6')}
          </View>

          <View style={styles.chartPlaceholder}>
            <Ionicons name="analytics" size={40} color="#ccc" />
            <Text style={styles.placeholderText}>
              Prod dashboard metrikleri için `/actuator/metrics` ve audit log akışı hazır.
            </Text>
          </View>
        </ScrollView>
      )}

      {activeTab === 'logs' && (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          refreshing={refreshing}
          onRefresh={fetchAdminData}
          contentContainerStyle={styles.logsContainer}
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <Text style={styles.logAction}>{item.action}</Text>
              <Text style={styles.logMeta}>{item.username} • {new Date(item.timestamp).toLocaleString('tr-TR')}</Text>
              <Text style={styles.logLine}>{item.details}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz audit kaydı yok.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 10 },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#6d28d9' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#999' },
  activeTabText: { color: '#6d28d9' },
  list: { padding: 15, paddingBottom: 30 },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '700', color: '#333' },
  adminLabel: { color: '#6d28d9', fontSize: 12 },
  email: { fontSize: 13, color: '#666', marginTop: 2 },
  batteryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  batteryText: { fontSize: 11, color: '#666' },
  actionBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { backgroundColor: '#fff0f0' },
  scroll: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statBox: { width: (width - 52) / 2, backgroundColor: '#fff', padding: 20, borderRadius: 16, alignItems: 'center', elevation: 2 },
  statIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#333' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  chartPlaceholder: {
    minHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 20,
  },
  placeholderText: { color: '#999', marginTop: 10, fontSize: 12, textAlign: 'center' },
  logsContainer: { padding: 15, paddingBottom: 30 },
  logCard: { backgroundColor: '#111827', borderRadius: 14, padding: 14, marginBottom: 12 },
  logAction: { color: '#c4b5fd', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  logMeta: { color: '#9ca3af', fontSize: 11, marginBottom: 8 },
  logLine: { color: '#e5e7eb', fontSize: 13, lineHeight: 18 },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 40 },
});
