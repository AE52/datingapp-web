import React, { useEffect, useMemo, useState } from 'react';
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
  TextInput,
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
  activeSessions?: number;
  trustedSessions?: number;
  activePushDevices?: number;
  trustedPushDevices?: number;
  auditEvents24h?: number;
  failedLogins24h?: number;
  lastAuditAt?: string | null;
};

type AuditLog = {
  id: number;
  action: string;
  username: string;
  details: string;
  timestamp: string;
};

type RuntimePosture = {
  environment: string;
  healthDetailsMode: string;
  defaultRateLimitPerMinute: number;
  loginRateLimitPerMinute: number;
  allowedOrigins: string[];
  productionReady: boolean;
};

type SecurityWarning = {
  code: string;
  severity: string;
  message: string;
  blocking: boolean;
};

type AdminOverview = {
  stats: AdminStats;
  runtime: RuntimePosture;
  warnings: SecurityWarning[];
  generatedAt: string;
};

type HealthPayload = {
  status: string;
  components?: Record<string, { status: string }>;
};

const INITIAL_STATS: AdminStats = {
  totalUsers: 0,
  totalCircles: 0,
  totalNotifications: 0,
  activeSessions: 0,
  trustedSessions: 0,
  activePushDevices: 0,
  trustedPushDevices: 0,
  auditEvents24h: 0,
  failedLogins24h: 0,
  lastAuditAt: null,
};

export default function AdminScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [userSearch, setUserSearch] = useState('');
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
        Alert.alert('Yetkisiz', 'Bu ekran sadece yoneticiler icin aciktir.');
        router.back();
        return;
      }
      await fetchAdminData();
    };

    void bootstrap();
  }, []);

  const stats = overview?.stats ?? INITIAL_STATS;
  const healthEntries = useMemo(
    () => Object.entries(health?.components ?? {}),
    [health],
  );
  const filteredUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLowerCase();
    if (!normalizedSearch) return users;
    return users.filter((user) => (
      user.username.toLowerCase().includes(normalizedSearch)
      || user.email.toLowerCase().includes(normalizedSearch)
    ));
  }, [userSearch, users]);

  const fetchAdminData = async () => {
    try {
      setRefreshing(true);
      const [usersRes, overviewRes, logsRes, healthRes] = await Promise.all([
        fetch(`${API_BASE_URL}`),
        fetch(`${API_ORIGIN}/api/admin/overview`),
        fetch(`${API_ORIGIN}/api/admin/logs`),
        fetch(`${API_ORIGIN}/actuator/health`, { headers: { Accept: 'application/json' } }),
      ]);

      if (!usersRes.ok || !overviewRes.ok || !logsRes.ok) {
        throw new Error('Admin verileri alinamadi.');
      }

      const [usersData, overviewData, logsData] = await Promise.all([
        usersRes.json() as Promise<User[]>,
        overviewRes.json() as Promise<AdminOverview>,
        logsRes.json() as Promise<AuditLog[]>,
      ]);

      setUsers(usersData);
      setOverview(overviewData);
      setLogs(logsData);

      if (healthRes.ok) {
        setHealth(await healthRes.json() as HealthPayload);
      } else {
        setHealth(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteUser = (userId: number, name: string) => {
    Alert.alert('Kullanici Sil', `${name} adli kullanici silinsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/${userId}`, { method: 'DELETE' });
            if (!response.ok) {
              throw new Error('Kullanici silinemedi.');
            }
            await fetchAdminData();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Silme islemi basarisiz.';
            Alert.alert('Hata', message);
          }
        },
      },
    ]);
  };

  const renderStat = (label: string, value: string, icon: keyof typeof Ionicons.glyphMap, color: string) => (
    <View style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderWarning = (warning: SecurityWarning) => (
    <View
      key={warning.code}
      style={[
        styles.warningCard,
        warning.severity === 'critical'
          ? styles.warningCritical
          : warning.severity === 'high'
            ? styles.warningHigh
            : styles.warningMedium,
      ]}
    >
      <View style={styles.warningHeader}>
        <Text style={styles.warningCode}>{warning.code}</Text>
        <Text style={styles.warningBadge}>{warning.blocking ? 'blocking' : warning.severity}</Text>
      </View>
      <Text style={styles.warningText}>{warning.message}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0f766e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Admin Paneli</Text>
            <Text style={styles.subtitle}>Kullanici, runtime posture, health ve audit gorunurlugu</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void fetchAdminData()}>
            <Ionicons name="refresh" size={18} color="#0f766e" />
            <Text style={styles.refreshButtonText}>{refreshing ? 'Yenileniyor' : 'Yenile'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.metaLine}>
          Son guncelleme: {overview?.generatedAt ? new Date(overview.generatedAt).toLocaleString('tr-TR') : 'yok'}
        </Text>
        <Text style={styles.metaLine}>
          Warning sayisi: {overview?.warnings?.length ?? 0} • Production ready: {overview?.runtime.productionReady ? 'evet' : 'review gerekli'}
        </Text>
      </View>

      <View style={styles.tabBar}>
        {(['users', 'stats', 'logs'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'users' ? 'Kullanicilar' : tab === 'stats' ? 'Ops & Guvenlik' : 'Audit Log'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'users' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#64748b" />
            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Kullanici ara"
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filteredUsers}
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
            ListEmptyComponent={<Text style={styles.emptyText}>Kullanici bulunamadi.</Text>}
          />
        </View>
      )}

      {activeTab === 'stats' && (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={styles.sectionTitle}>Sistem Genel Bakis</Text>
          <View style={styles.statsGrid}>
            {renderStat('Toplam Kullanici', String(stats.totalUsers), 'people', '#0f766e')}
            {renderStat('Toplam Circle', String(stats.totalCircles), 'map', '#2563eb')}
            {renderStat('Bildirim', String(stats.totalNotifications), 'notifications', '#f59e0b')}
            {renderStat('Aktif Session', String(stats.activeSessions ?? 0), 'shield-checkmark', '#7c3aed')}
            {renderStat('Push Device', String(stats.activePushDevices ?? 0), 'phone-portrait', '#10b981')}
            {renderStat('Failed Login / 24h', String(stats.failedLogins24h ?? 0), 'warning', '#ef4444')}
          </View>

          <View style={styles.runtimePanel}>
            <Text style={styles.panelTitle}>Runtime Posture</Text>
            <Text style={styles.runtimeLine}>Environment: {overview?.runtime.environment ?? 'unknown'}</Text>
            <Text style={styles.runtimeLine}>Health details: {overview?.runtime.healthDetailsMode ?? 'unknown'}</Text>
            <Text style={styles.runtimeLine}>
              Rate limit: default {overview?.runtime.defaultRateLimitPerMinute ?? 0}/min • login {overview?.runtime.loginRateLimitPerMinute ?? 0}/min
            </Text>
            <Text style={styles.runtimeLine}>
              Trusted assets: {stats.trustedSessions ?? 0} session • {stats.trustedPushDevices ?? 0} device
            </Text>
            <Text style={styles.runtimeLine}>
              Son audit: {stats.lastAuditAt ? new Date(stats.lastAuditAt).toLocaleString('tr-TR') : 'Yok'}
            </Text>
            <Text style={styles.runtimeLine}>
              Production ready: {overview?.runtime.productionReady ? 'Evet' : 'Review gerekli'}
            </Text>
          </View>

          <View style={styles.runtimePanel}>
            <Text style={styles.panelTitle}>Allowed Origins</Text>
            {(overview?.runtime.allowedOrigins ?? []).length === 0 ? (
              <Text style={styles.placeholderText}>Origin bilgisi yok.</Text>
            ) : (
              <View style={styles.originWrap}>
                {(overview?.runtime.allowedOrigins ?? []).map((origin) => (
                  <View key={origin} style={styles.originChip}>
                    <Text style={styles.originChipText}>{origin}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.runtimePanel}>
            <Text style={styles.panelTitle}>Security Warnings</Text>
            {overview?.warnings?.length ? (
              overview.warnings.map(renderWarning)
            ) : (
              <Text style={styles.okText}>Bu environment icin backend warning üretmiyor.</Text>
            )}
          </View>

          <View style={styles.runtimePanel}>
            <Text style={styles.panelTitle}>Dependency Health</Text>
            {healthEntries.length === 0 ? (
              <Text style={styles.placeholderText}>Health component verisi mevcut degil.</Text>
            ) : (
              healthEntries.map(([name, component]) => (
                <View key={name} style={styles.healthRow}>
                  <Text style={styles.healthName}>{name}</Text>
                  <View style={[styles.healthBadge, component.status === 'UP' ? styles.healthUp : styles.healthDown]}>
                    <Text style={styles.healthBadgeText}>{component.status}</Text>
                  </View>
                </View>
              ))
            )}
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
          ListEmptyComponent={<Text style={styles.emptyText}>Henuz audit kaydi yok.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fb' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e7edf5' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#172033' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  metaLine: { fontSize: 12, color: '#64748b', marginTop: 8 },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#eef7f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  refreshButtonText: { color: '#0f766e', fontSize: 12, fontWeight: '800' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 10 },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#0f766e' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  activeTabText: { color: '#0f766e' },
  searchBar: {
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, color: '#172033', fontSize: 14, padding: 0 },
  list: { padding: 15, paddingBottom: 30 },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  userInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '700', color: '#172033' },
  adminLabel: { color: '#0f766e', fontSize: 12 },
  email: { fontSize: 13, color: '#64748b', marginTop: 2 },
  batteryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  batteryText: { fontSize: 11, color: '#64748b' },
  actionBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { backgroundColor: '#fff0f0' },
  scroll: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#172033', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statBox: {
    width: (width - 52) / 2,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  statIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#172033' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'center' },
  runtimePanel: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginTop: 18,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  panelTitle: { fontSize: 16, fontWeight: '800', color: '#172033', marginBottom: 12 },
  runtimeLine: { fontSize: 13, color: '#334155', marginBottom: 8, lineHeight: 19 },
  originWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  originChip: { backgroundColor: '#eef7f6', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  originChipText: { fontSize: 11, color: '#0f766e', fontWeight: '700' },
  warningCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  warningCritical: { backgroundColor: '#fff3f2', borderColor: '#fdba74' },
  warningHigh: { backgroundColor: '#fff7ed', borderColor: '#fdba74' },
  warningMedium: { backgroundColor: '#ecfeff', borderColor: '#99f6e4' },
  warningHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  warningCode: { fontSize: 12, fontWeight: '800', color: '#172033' },
  warningBadge: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#475569' },
  warningText: { fontSize: 12, color: '#334155', marginTop: 8, lineHeight: 18 },
  okText: { fontSize: 13, color: '#0f766e', fontWeight: '700' },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  healthName: { fontSize: 13, color: '#172033', fontWeight: '700', textTransform: 'capitalize' },
  healthBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  healthUp: { backgroundColor: '#d1fae5' },
  healthDown: { backgroundColor: '#fee2e2' },
  healthBadgeText: { fontSize: 11, fontWeight: '800', color: '#172033' },
  placeholderText: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  logsContainer: { padding: 15, paddingBottom: 30 },
  logCard: { backgroundColor: '#172033', borderRadius: 14, padding: 14, marginBottom: 12 },
  logAction: { color: '#99f6e4', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  logMeta: { color: '#94a3b8', fontSize: 11, marginBottom: 8 },
  logLine: { color: '#e5e7eb', fontSize: 13, lineHeight: 18 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 40 },
});
