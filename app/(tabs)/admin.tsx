import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, FlatList, ActivityIndicator, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/api';

const { width } = Dimensions.get('window');

type User = {
  id: number;
  username: string;
  email: string;
  admin: boolean;
  batteryLevel: number;
};

export default function AdminScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'logs'>('users');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(API_BASE_URL);
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      Alert.alert('Hata', 'Kullanıcılar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = (userId: number, name: string) => {
    Alert.alert('Kullanıcı Sil', `${name} adlı kullanıcıyı silmek istediğinize emin misiniz?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            await fetch(`${API_BASE_URL}/${userId}`, { method: 'DELETE' });
            setUsers(users.filter(u => u.id !== userId));
          } catch (e) {
            Alert.alert('Hata', 'Kullanıcı silinemedi.');
          }
        }
      }
    ]);
  };

  const renderStat = (label: string, value: string, icon: string, color: string) => (
    <View style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Paneli</Text>
        <Text style={styles.subtitle}>Sistem ve kullanıcı yönetimi</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['users', 'stats', 'logs'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'users' ? 'Kullanıcılar' : tab === 'stats' ? 'İstatistik' : 'Loglar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'users' && (
        <FlatList
          data={users}
          keyExtractor={item => item.id.toString()}
          refreshing={loading}
          onRefresh={fetchUsers}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username} {item.admin && <Text style={styles.adminLabel}>(Admin)</Text>}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <View style={styles.batteryRow}>
                   <Ionicons name="battery-dead" size={14} color="#666" />
                   <Text style={styles.batteryText}> Pil: %{item.batteryLevel}</Text>
                </View>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Düzenle', 'Kullanıcı düzenleme yakında!')}>
                  <Ionicons name="pencil" size={20} color="#6d28d9" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => deleteUser(item.id, item.username)}>
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={loading ? <ActivityIndicator size="large" color="#6d28d9" style={{marginTop: 50}} /> : null}
        />
      )}

      {activeTab === 'stats' && (
        <ScrollView style={styles.scroll}>
          <Text style={styles.sectionTitle}>Sistem Genel Bakış</Text>
          <View style={styles.statsGrid}>
            {renderStat('Toplam Kayıt', users.length.toString(), 'people', '#6d28d9')}
            {renderStat('Aktif Gruplar', '14', 'map', '#10b981')}
            {renderStat('Günlük Mesaj', '1.2k', 'chatbubbles', '#f59e0b')}
            {renderStat('Sunucu Durumu', 'Aktif', 'server', '#3b82f6')}
          </View>

          <View style={styles.chartPlaceholder}>
            <Ionicons name="analytics" size={40} color="#ccc" />
            <Text style={styles.placeholderText}>Cihaz kullanım grafikleri burada görünecek</Text>
          </View>
        </ScrollView>
      )}

      {activeTab === 'logs' && (
        <View style={styles.logsContainer}>
           <Text style={styles.logLine}>[15:40:22] - Eren login oldu.</Text>
           <Text style={styles.logLine}>[15:42:01] - Ayşe SOS tetikledi.</Text>
           <Text style={styles.logLine}>[15:45:10] - Yeni grup oluşturuldu: "Yazılımcılar".</Text>
           <Text style={styles.logLine}>[15:50:33] - Baba "Ev" alanından ayrıldı.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 10 },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#6d28d9' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#999' },
  activeTabText: { color: '#6d28d9' },
  list: { padding: 15 },
  userCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  userInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '700', color: '#333' },
  adminLabel: { color: '#6d28d9', fontSize: 12 },
  email: { fontSize: 13, color: '#666', marginTop: 2 },
  batteryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  batteryText: { fontSize: 11, color: '#666' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0eaff', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { backgroundColor: '#fff0f0' },
  scroll: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statBox: { width: (width - 52) / 2, backgroundColor: '#fff', padding: 20, borderRadius: 16, alignItems: 'center', elevation: 2 },
  statIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#333' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  chartPlaceholder: { height: 200, backgroundColor: '#fff', borderRadius: 16, marginTop: 20, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' },
  placeholderText: { color: '#999', marginTop: 10, fontSize: 12 },
  logsContainer: { flex: 1, backgroundColor: '#1a1a1a', padding: 15, margin: 15, borderRadius: 8 },
  logLine: { color: '#00ff00', fontFamily: 'Courier', fontSize: 12, marginBottom: 5 }
});
