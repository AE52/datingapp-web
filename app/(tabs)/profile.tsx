import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';

import { API_BASE_URL, CIRCLES_API_URL, NOTIFICATIONS_API_URL, getStoredUser, logout, replaceStoredUser, type AppUser } from '@/api';
import { listSessions, revokeAllSessions, revokeSession, type SessionView, updateSessionTrust } from '@/lib/account-security';
import {
  getBackgroundLocationDiagnostics,
  isBackgroundTrackingEnabled,
  sendForegroundLocationUpdate,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '@/lib/background-location';
import {
  listPushDevices,
  registerPushDevice,
  revokePushDevice,
  type PushDeviceView,
  updatePushDeviceTrust,
} from '@/lib/push';

const FREQUENCY_PRESETS = [1, 5, 10, 30];

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const [user, setUser] = useState<AppUser | null>(null);
  const [circleId, setCircleId] = useState<number>(1);
  const [ghostMode, setGhostMode] = useState(false);
  const [bubbleEnabled, setBubbleEnabled] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [backgroundDiagnostics, setBackgroundDiagnostics] = useState<{
    enabled: boolean;
    started: boolean;
    queueSize: number;
    taskManagerAvailable: boolean;
  } | null>(null);
  const [pushDevices, setPushDevices] = useState<PushDeviceView[]>([]);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const nextUser = await getStoredUser();
      if (!nextUser) {
        router.replace('/login');
        return;
      }

      setUser(nextUser);
      setGhostMode(Boolean(nextUser.ghostMode));
      setBubbleEnabled(Boolean(nextUser.bubbleEnabled));
      setBackgroundTracking(await isBackgroundTrackingEnabled());
      setBackgroundDiagnostics(await getBackgroundLocationDiagnostics());

      try {
        const circlesResponse = await fetch(`${CIRCLES_API_URL}/user/${nextUser.id}`);
        const circles = await circlesResponse.json() as { id?: number }[];
        if (Array.isArray(circles) && circles[0]?.id) {
          setCircleId(circles[0].id);
        }
      } catch {
      }

      await Promise.allSettled([refreshSecurityData(), sendForegroundLocationUpdate()]);
      setLoading(false);
    };

    load();
  }, []);

  const hasAnyPushDevice = useMemo(
    () => pushDevices.some((device) => device.notificationsEnabled),
    [pushDevices],
  );

  const refreshBackgroundDiagnostics = async () => {
    setBackgroundDiagnostics(await getBackgroundLocationDiagnostics());
  };

  const refreshSecurityData = async () => {
    const [devicesResult, sessionsResult] = await Promise.allSettled([listPushDevices(), listSessions()]);

    if (devicesResult.status === 'fulfilled') {
      setPushDevices(devicesResult.value);
    }
    if (sessionsResult.status === 'fulfilled') {
      setSessions(sessionsResult.value);
    }
  };

  const withSaving = async (key: string, action: () => Promise<void>) => {
    setSaving(key);
    try {
      await action();
    } finally {
      setSaving(null);
    }
  };

  const persistUserUpdate = async (nextUser: AppUser) => {
    setUser(nextUser);
    await replaceStoredUser(nextUser);
  };

  const toggleGhostMode = async (value: boolean) => {
    if (!user) return;
    setGhostMode(value);

    try {
      const response = await fetch(`${API_BASE_URL}/${user.id}/ghost`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghostMode: value }),
      });
      if (!response.ok) throw new Error('Hayalet modu guncellenemedi.');
      await persistUserUpdate(await response.json() as AppUser);
    } catch (error) {
      setGhostMode(!value);
      Alert.alert('Hata', error instanceof Error ? error.message : 'Hayalet modu guncellenemedi.');
    }
  };

  const toggleBubbleMode = async (value: boolean) => {
    if (!user) return;
    setBubbleEnabled(value);

    try {
      let latitude = user.latitude;
      let longitude = user.longitude;
      if (value) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Bubble modu icin konum izni gerekli.');
        }

        const position = await Location.getCurrentPositionAsync({});
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const response = await fetch(`${API_BASE_URL}/${user.id}/bubble`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: value,
          latitude,
          longitude,
          radiusKm: 0.8,
          durationMinutes: value ? 120 : 0,
        }),
      });
      if (!response.ok) {
        throw new Error('Bubble modu guncellenemedi.');
      }
      await persistUserUpdate(await response.json() as AppUser);
    } catch (error) {
      setBubbleEnabled(!value);
      Alert.alert('Hata', error instanceof Error ? error.message : 'Bubble modu guncellenemedi.');
    }
  };

  const updateFrequency = async (frequency: number) => {
    if (!user) return;
    await withSaving(`freq-${frequency}`, async () => {
      const response = await fetch(`${API_BASE_URL}/${user.id}/frequency`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency }),
      });
      if (!response.ok) {
        throw new Error('Konum guncelleme sikligi kaydedilemedi.');
      }
      const nextUser = await response.json() as AppUser;
      await persistUserUpdate(nextUser);
      if (backgroundTracking) {
        await startBackgroundTracking(nextUser.locationUpdateFrequency ?? frequency);
      }
    }).catch((error) => {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Konum guncelleme sikligi kaydedilemedi.');
    });
  };

  const toggleNotifications = async (value: boolean) => {
    if (!user) return;

    await withSaving('notifications', async () => {
      if (value) {
        await registerPushDevice(user, backgroundTracking);
      } else {
        await Promise.all(pushDevices.map((device) => revokePushDevice(device.id)));
      }
      await refreshSecurityData();
      await refreshBackgroundDiagnostics();
    }).catch((error) => {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Bildirim ayari guncellenemedi.');
    });
  };

  const toggleBackgroundTracking = async (value: boolean) => {
    if (!user) return;

    setBackgroundTracking(value);
    try {
      if (value) {
        await startBackgroundTracking(user.locationUpdateFrequency ?? 5);
        await sendForegroundLocationUpdate();
        if (!hasAnyPushDevice) {
          await registerPushDevice(user, true);
        } else {
          await registerPushDevice(user, true);
        }
      } else {
        await stopBackgroundTracking();
        if (hasAnyPushDevice) {
          await registerPushDevice(user, false);
        }
      }
      await refreshSecurityData();
      await refreshBackgroundDiagnostics();
    } catch (error) {
      setBackgroundTracking(!value);
      Alert.alert('Hata', error instanceof Error ? error.message : 'Arka plan takibi guncellenemedi.');
    }
  };

  const sendLowBatteryAlert = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${NOTIFICATIONS_API_URL}/low-battery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          circleId,
          batteryLevel: user.batteryLevel ?? 15,
        }),
      });
      if (!response.ok) throw new Error('Dusuk pil uyarisi gonderilemedi.');
      Alert.alert('Gonderildi', 'Dusuk pil uyarisi circle uyelerine iletildi.');
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Dusuk pil uyarisi gonderilemedi.');
    }
  };

  const handleLogoutAll = async () => {
    await withSaving('logout-all', async () => {
      await revokeAllSessions();
      await logout();
      router.replace('/login');
    }).catch((error) => {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Tum oturumlar kapatilamadi.');
    });
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (!user || loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.shell, isWide && styles.shellWide]}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user.username}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.admin && (
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={14} color="#6d28d9" />
              <Text style={styles.badgeText}>Yonetici</Text>
            </View>
          )}
        </View>

        <Section title="Durum">
          <Row icon="battery-half-outline" label="Pil seviyesi" value={`${user.batteryLevel ?? 100}%`} />
          <Row icon="location-outline" label="Konum paylasimi" value={user.locationVisibility ?? 'UNAVAILABLE'} />
          <TouchableOpacity style={styles.actionButton} onPress={sendLowBatteryAlert}>
            <Ionicons name="battery-dead-outline" size={18} color="#ef4444" />
            <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Dusuk pil uyarisini circle ile paylas</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Gizlilik">
          <ToggleRow icon="eye-off-outline" label="Hayalet modu" value={ghostMode} onValueChange={toggleGhostMode} />
          <ToggleRow icon="radio-outline" label="Bubble konumu" value={bubbleEnabled} onValueChange={toggleBubbleMode} />
          <Text style={styles.hint}>Hayalet modu exact konumu gizler. Bubble modu yaklaşık güvenli alan paylaşır.</Text>
        </Section>

        <Section title="Canli Teslimat">
          <ToggleRow
            icon="notifications-outline"
            label="Push bildirimleri"
            value={hasAnyPushDevice}
            onValueChange={toggleNotifications}
            busy={saving === 'notifications'}
          />
          <ToggleRow
            icon="navigate-outline"
            label="Arka plan konum takibi"
            value={backgroundTracking}
            onValueChange={toggleBackgroundTracking}
          />
          <Text style={styles.hint}>Arka plan takibi Expo Go&apos;da sinirlidir; development build uzerinde calisir.</Text>
        </Section>

        <Section title="Teslimat Diagnostigi">
          <Row icon="pulse-outline" label="TaskManager" value={backgroundDiagnostics?.taskManagerAvailable ? 'Hazir' : 'Yok'} />
          <Row icon="navigate-outline" label="Arka plan aktif" value={backgroundDiagnostics?.started ? 'Calisiyor' : 'Beklemede'} />
          <Row icon="cloud-upload-outline" label="Kuyruktaki olay" value={String(backgroundDiagnostics?.queueSize ?? 0)} />
          <Text style={styles.hint}>
            Fiziksel cihaz development build&apos;inde TaskManager hazir ve kuyruk sifira yakin kalmali. Kuyruk buyurse ag veya izin sorunu vardir.
          </Text>
        </Section>

        <Section title="Konum Sikligi">
          <View style={styles.chipRow}>
            {FREQUENCY_PRESETS.map((preset) => {
              const active = (user.locationUpdateFrequency ?? 5) === preset;
              return (
                <TouchableOpacity
                  key={preset}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => updateFrequency(preset)}
                  disabled={saving === `freq-${preset}`}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {saving === `freq-${preset}` ? '...' : `${preset} dk`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title="Trusted Devices">
          {pushDevices.length === 0 ? (
            <EmptyState text="Kayitli push cihazı yok." />
          ) : (
            pushDevices.map((device) => (
              <SecurityCard
                key={`push-${device.id}`}
                title={device.deviceName || `${device.platform} cihaz`}
                subtitle={`${device.provider.toUpperCase()} • ${device.appVersion ?? 'dev'} • ${device.lastDeliveryStatus ?? 'hazir'}`}
                trusted={device.trusted}
                onTrustChange={(value) => withSaving(`push-${device.id}`, async () => {
                  await updatePushDeviceTrust(device.id, value);
                  await refreshSecurityData();
                }).catch((error) => Alert.alert('Hata', error instanceof Error ? error.message : 'Cihaz guncellenemedi.'))}
                onRevoke={() => withSaving(`push-revoke-${device.id}`, async () => {
                  await revokePushDevice(device.id);
                  await refreshSecurityData();
                }).catch((error) => Alert.alert('Hata', error instanceof Error ? error.message : 'Cihaz kaldirilamadi.'))}
                busy={saving === `push-${device.id}` || saving === `push-revoke-${device.id}`}
              />
            ))
          )}
        </Section>

        <Section title="Active Sessions">
          {sessions.length === 0 ? (
            <EmptyState text="Aktif refresh session yok." />
          ) : (
            sessions.map((session) => (
              <SecurityCard
                key={`session-${session.id}`}
                title={session.deviceLabel || session.userAgent || `Session #${session.id}`}
                subtitle={`${session.ipAddress ?? 'IP yok'} • son kullanim ${formatDate(session.lastUsedAt ?? session.createdAt)}`}
                trusted={session.trusted}
                onTrustChange={(value) => withSaving(`session-${session.id}`, async () => {
                  await updateSessionTrust(session.id, value);
                  await refreshSecurityData();
                }).catch((error) => Alert.alert('Hata', error instanceof Error ? error.message : 'Session guncellenemedi.'))}
                onRevoke={() => withSaving(`session-revoke-${session.id}`, async () => {
                  await revokeSession(session.id);
                  await refreshSecurityData();
                }).catch((error) => Alert.alert('Hata', error instanceof Error ? error.message : 'Session kapatilamadi.'))}
                busy={saving === `session-${session.id}` || saving === `session-revoke-${session.id}`}
              />
            ))
          )}

          <TouchableOpacity style={styles.dangerButton} onPress={handleLogoutAll} disabled={saving === 'logout-all'}>
            <Ionicons name="shield-outline" size={18} color="#ef4444" />
            <Text style={styles.dangerButtonText}>
              {saving === 'logout-all' ? 'Tum oturumlar kapatiliyor...' : 'Tum oturumlari kapat'}
            </Text>
          </TouchableOpacity>
        </Section>

        <Section title="Hesap">
          <TouchableOpacity style={styles.secondaryButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#6d28d9" />
            <Text style={styles.secondaryButtonText}>Cikis yap</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => Alert.alert('Beklemede', 'Hesap silme akisini once son onay + audit log ile baglayacagim.')}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={[styles.secondaryButtonText, { color: '#ef4444' }]}>Hesabi sil</Text>
          </TouchableOpacity>
        </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color="#6d28d9" />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color="#6d28d9" />
      <Text style={styles.rowLabel}>{label}</Text>
      {busy ? (
        <ActivityIndicator size="small" color="#6d28d9" />
      ) : (
        <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#6d28d9', false: '#d1d5db' }} />
      )}
    </View>
  );
}

function SecurityCard({
  title,
  subtitle,
  trusted,
  onTrustChange,
  onRevoke,
  busy,
}: {
  title: string;
  subtitle: string;
  trusted: boolean;
  onTrustChange: (value: boolean) => void;
  onRevoke: () => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.securityCard}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.securityTitle}>{title}</Text>
        <Text style={styles.securitySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.securityActions}>
        <Switch value={trusted} onValueChange={onTrustChange} trackColor={{ true: '#0ea5e9', false: '#d1d5db' }} disabled={busy} />
        <TouchableOpacity style={styles.revokeChip} onPress={onRevoke} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color="#ef4444" /> : <Text style={styles.revokeChipText}>Kaldir</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3ff' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f3ff' },
  content: { padding: 20, paddingBottom: 48, alignItems: 'center' },
  shell: { width: '100%', gap: 18 },
  shellWide: { maxWidth: 1040 },
  header: { alignItems: 'center', gap: 8, paddingTop: 8 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#6d28d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 34, fontWeight: '900', color: '#fff' },
  name: { fontSize: 26, fontWeight: '800', color: '#111827' },
  email: { fontSize: 14, color: '#6b7280' },
  badge: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: '#6d28d9', fontWeight: '700' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '600' },
  rowValue: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  hint: { fontSize: 12, color: '#6b7280', lineHeight: 18 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionButtonText: { fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ede9fe',
  },
  chipActive: { backgroundColor: '#6d28d9' },
  chipText: { color: '#6d28d9', fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  securityCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 14,
  },
  securityTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  securitySubtitle: { fontSize: 12, color: '#6b7280', lineHeight: 18 },
  securityActions: { alignItems: 'flex-end', gap: 10 },
  revokeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fee2e2',
  },
  revokeChipText: { color: '#ef4444', fontWeight: '700', fontSize: 12 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    padding: 14,
  },
  emptyText: { color: '#6b7280', fontSize: 13 },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#fff1f2',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dangerButtonText: { color: '#ef4444', fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: '#6d28d9', fontWeight: '700' },
});
