import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Platform,
  Animated, Easing, Modal, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import AppMap, { AppMarker } from '@/components/AppMap';
import { API_BASE_URL, NOTIFICATIONS_API_URL, getStoredUser, logout } from '@/api';
import { sendForegroundLocationUpdate } from '@/lib/background-location';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

type User = {
  id: number;
  username: string;
  email?: string | null;
  batteryLevel?: number;
  ghostMode?: boolean;
  bubbleEnabled?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  locationUpdateFrequency?: number;
  locationVisibility?: 'EXACT' | 'APPROXIMATE' | 'HIDDEN' | 'UNAVAILABLE';
  locationRadiusKm?: number | null;
};
type Circle = { id: number; name: string; admin: User; members: User[] };
type AppNotification = { id: number; sender?: User; receiver?: User; type: string; content: string; timestamp: string; read: boolean };
type NotificationOption = { type: string; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; tone: string; content: string };

const CIRCLE_API = API_BASE_URL.replace('/users', '/circles');
const NOTIF_API  = NOTIFICATIONS_API_URL;
const BC = (pct: number) => pct > 50 ? '#4caf50' : pct > 20 ? '#ff9800' : '#ef4444';
const NOTIFICATION_OPTIONS: NotificationOption[] = [
  { type: 'POKE', title: 'Dürt', subtitle: 'Kısa bir ping gönder', icon: 'sparkles-outline', tone: '#6d28d9', content: 'Sadece ses veriyorum, müsait olunca yaz.' },
  { type: 'LOCATION_CHECK', title: 'Konum Kontrolü', subtitle: 'Konumunu güncellemesini iste', icon: 'locate-outline', tone: '#2563eb', content: 'Konumunu bir kontrol eder misin?' },
  { type: 'CALL_ME', title: 'Beni Ara', subtitle: 'Seni aramasını iste', icon: 'call-outline', tone: '#0f766e', content: 'Müsait olunca beni arar mısın?' },
  { type: 'ARRIVED_HOME', title: 'Varınca Haber Ver', subtitle: 'Eve varınca bildirsin', icon: 'home-outline', tone: '#ea580c', content: 'Eve varınca bana haber ver.' },
  { type: 'LOW_BATTERY', title: 'Pilini Kontrol Et', subtitle: 'Şarj durumuna dikkat çek', icon: 'battery-half-outline', tone: '#dc2626', content: 'Pilini kontrol et, gerekirse şarja tak.' },
  { type: 'STATUS_CHECK', title: 'İyi Misin?', subtitle: 'Durum kontrolü gönder', icon: 'heart-circle-outline', tone: '#db2777', content: 'Sadece iyi misin diye kontrol ediyorum.' },
];

export default function MapScreen() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers]   = useState<User[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [locationLabels, setLocationLabels] = useState<Record<number, string>>({});
  const [activeCircle, setActiveCircle] = useState<Circle | null>(null);
  const [showCirclePicker, setShowCirclePicker] = useState(false);
  const [showSafetyLayer, setShowSafetyLayer] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserActions, setShowUserActions] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showNotificationOptions, setShowNotificationOptions] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<any>(null);
  const snapPoints = useMemo(() => ['22%', '50%', '92%'], []);
  const [kisses, setKisses] = useState<{ id: number; scale: Animated.Value; ty: Animated.Value }[]>([]);

  const getLocationSubtitle = (user: User) => {
    if (user.locationVisibility === 'HIDDEN') return 'Konum gizli tutuluyor';
    if (user.locationVisibility === 'UNAVAILABLE') return 'Konum paylaşımı yok';

    const label = locationLabels[user.id];
    if (!label) {
      return user.locationVisibility === 'APPROXIMATE' ? 'Yaklaşık konum hazırlanıyor' : 'Konum bilgisi hazırlanıyor';
    }

    return user.locationVisibility === 'APPROXIMATE' ? `Yaklaşık: ${label}` : `📍 ${label}`;
  };

  const getVisibilityBadge = (user: User) => {
    if (user.locationVisibility === 'APPROXIMATE') return 'Yaklaşık';
    if (user.locationVisibility === 'HIDDEN') return 'Gizli';
    return null;
  };

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const u = await getStoredUser();
      if (!u) { router.replace('/login'); return; }
      setCurrentUser(u);
      fetchCircles(u.id);
      fetchNotifications(u.id);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        await sendForegroundLocationUpdate();
      }
    };
    init();
  }, []);

  const fetchCircles = async (uid: number) => {
    try {
      const url = `${CIRCLE_API}/user/${uid}`;
      console.log('📡 Fetching circles:', url);
      const res = await fetch(url);
      const data: Circle[] = await res.json();
      console.log('✅ Circles fetched:', data.length, data.map(c => c.name));
      setCircles(data);
      if (data.length > 0) setActiveCircle(data[0]);
    } catch (e: any) {
      console.log('❌ Circles error:', e.message);
    }
  };

  const fetchUsers = async (circleId: number) => {
    try {
      const url = `${CIRCLE_API}/${circleId}`;
      console.log('📡 Fetching users for circle:', circleId);
      const res = await fetch(url);
      const circle: Circle = await res.json();
      console.log('✅ Users fetched:', circle.members?.length, circle.members?.map((u: User) => u.username));
      setUsers(circle.members || []);
    } catch (e: any) {
      console.log('❌ Users error:', e.message);
    }
  };

  const fetchNotifications = async (uid: number) => {
    try {
      const res = await fetch(`${NOTIF_API}/${uid}`);
      setNotifications(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (!activeCircle) return;
    fetchUsers(activeCircle.id);
    const iv = setInterval(() => fetchUsers(activeCircle.id), 10000);
    return () => clearInterval(iv);
  }, [activeCircle]);

  useEffect(() => {
    users.forEach((user) => {
      if (!user.latitude || !user.longitude || locationLabels[user.id]) return;
      if (user.locationVisibility === 'HIDDEN' || user.locationVisibility === 'UNAVAILABLE') return;
      Location.reverseGeocodeAsync({ latitude: user.latitude, longitude: user.longitude })
        .then((results) => {
          const first = results[0];
          if (!first) return;
          const parts = [first.street, first.district || first.subregion, first.city];
          const label = parts.filter(Boolean).join(', ');
          if (!label) return;
          setLocationLabels((prev) => ({ ...prev, [user.id]: label }));
        })
        .catch(() => {});
    });
  }, [users, locationLabels]);

  // ── Kisses ────────────────────────────────────────────────────────────────
  const spawnKiss = async (targetId: number) => {
    const nk = { id: Date.now(), scale: new Animated.Value(0), ty: new Animated.Value(0) };
    setKisses(p => [...p, nk]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(nk.scale, { toValue: 1.6, duration: 300, useNativeDriver: true }),
      Animated.timing(nk.ty, { toValue: -310, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start(() => setKisses(p => p.filter(k => k.id !== nk.id)));
    if (currentUser) {
      try { await fetch(`${NOTIF_API}/poke?senderId=${currentUser.id}&receiverId=${targetId}`, { method: 'POST' }); } catch {}
    }
  };

  const sendSOS = async () => {
    if (!currentUser || !activeCircle) return;
    try {
      await fetch(`${NOTIF_API}/sos/${currentUser.id}?circleId=${activeCircle.id}`, { method: 'POST' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Toast.show({ type: 'success', text1: 'SOS gönderildi', text2: 'Acil durum bildirimi grup üyelerine iletildi.' });
    } catch {
      Toast.show({ type: 'error', text1: 'SOS gönderilemedi', text2: 'İstek backend tarafına ulaşmadı.' });
    }
  };

  const checkIn = async () => {
    if (!currentUser || !activeCircle) return;
    try {
      const location = await Location.getCurrentPositionAsync({});
      await fetch(`${NOTIF_API}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          circleId: activeCircle.id,
          content: locationLabels[currentUser.id] || 'Canli konum',
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Check-in gonderildi', text2: `Konumun "${activeCircle.name}" grubuna bildirildi.` });
    } catch {
      Toast.show({ type: 'error', text1: 'Check-in gonderilemedi', text2: 'Konum alinirken veya bildirim gonderilirken hata olustu.' });
    }
  };

  const handleUserPress = (user: User) => {
    if (user.id === currentUser?.id) return;
    setSelectedUser(user);
    setShowUserActions(true);
  };

  const closeUserSheets = () => {
    setShowUserActions(false);
    setShowUserProfile(false);
  };

  const openUserProfile = () => {
    setShowUserActions(false);
    setShowUserProfile(true);
  };

  const openNotificationOptions = () => {
    setShowUserActions(false);
    setShowUserProfile(false);
    setShowNotificationOptions(true);
  };

  const openPrivateChat = () => {
    if (!selectedUser) return;
    closeUserSheets();
    router.push({
      pathname: '/(tabs)/chat/[id]',
      params: { id: selectedUser.id.toString(), name: selectedUser.username, isPrivate: '1' }
    } as any);
  };

  const sendNotificationOption = async (option: NotificationOption) => {
    if (!currentUser || !selectedUser) return;
    try {
      await fetch(`${NOTIF_API}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          receiverId: selectedUser.id,
          type: option.type,
          content: option.content,
        }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: `${option.title} gönderildi`,
        text2: `${selectedUser.username} kullanıcısına bildirim iletildi.`,
      });
      if (currentUser) {
        fetchNotifications(currentUser.id);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Bildirim gönderilemedi', text2: 'İstek işlenemedi, tekrar dene.' });
    } finally {
      setShowNotificationOptions(false);
    }
  };

  const openCall = () => {
    if (!selectedUser) return;
    closeUserSheets();
    router.push({
      pathname: '/(tabs)/call',
      params: { type: 'voice', circleName: selectedUser.username, peerUserId: selectedUser.id.toString() },
    } as any);
  };

  const openHistory = () => {
    if (!selectedUser) return;
    if (selectedUser.id !== currentUser?.id && selectedUser.locationVisibility !== 'EXACT') {
      Alert.alert('Geçmiş Paylaşılmıyor', 'Bu kullanıcının ayrıntılı konum geçmişi şu anda paylaşılmıyor.');
      return;
    }
    closeUserSheets();
    router.push({ pathname: '/(tabs)/history', params: { userId: selectedUser.id.toString(), username: selectedUser.username } } as any);
  };

  const focusUserLocation = () => {
    if (!selectedUser) return;
    if (selectedUser.latitude && selectedUser.longitude && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion({ latitude: selectedUser.latitude, longitude: selectedUser.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 900);
      bottomSheetRef.current?.snapToIndex(0);
    }
    closeUserSheets();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const unreadCount = notifications.filter((n: AppNotification) => !n.read).length;
  const initialRegion = { latitude: 41.0082, longitude: 28.9784, latitudeDelta: 0.15, longitudeDelta: 0.15 };

  const NOTIF_ICONS: Record<string,string> = { POKE:'😘', CHECK_IN:'📍', SOS:'🚨', ARRIVED:'✅', LEFT:'🏃', KISS:'💋', LOW_BATTERY:'🔋', SPEED:'🚗', LOCATION_CHECK:'🧭', CALL_ME:'📞', ARRIVED_HOME:'🏠', STATUS_CHECK:'💗', DEFAULT:'🔔' };

  return (
    <View style={{ flex: 1 }}>
      {/* Kiss overlay */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {kisses.map(k => (
          <Animated.Text key={k.id} style={[s.floatingEmoji, { transform: [{ scale: k.scale }, { translateY: k.ty }] }]}>😘</Animated.Text>
        ))}
      </View>

      {/* Map */}
      <AppMap ref={mapRef} style={StyleSheet.absoluteFillObject} initialRegion={initialRegion}>
        {users.map((u, idx) => {
          if (Platform.OS === 'web') {
            const pos = [{ top: 240, left: 90 }, { top: 370, left: 170 }, { top: 310, left: 240 }, { top: 170, left: 210 }][idx % 4];
            return <AppMarker key={u.id} onPress={() => handleUserPress(u)}><View style={[s.staticMarker, pos]}><MarkerBubble user={u} isMe={u.id === currentUser?.id} /></View></AppMarker>;
          }
          if (!u.latitude || !u.longitude) return null;
          return <AppMarker key={u.id} coordinate={{ latitude: u.latitude, longitude: u.longitude }} onPress={() => handleUserPress(u)}><MarkerBubble user={u} isMe={u.id === currentUser?.id} /></AppMarker>;
        })}

        {/* Advanced Safety Layer Markers */}
        {showSafetyLayer && (
          <>
            <AppMarker coordinate={{ latitude: 41.042, longitude: 29.008 }}>
              <View style={[s.safetyScore, { backgroundColor: '#10b981cc' }]}><Text style={s.safetyTxt}>9.4 Benzeri Güvenli</Text></View>
            </AppMarker>
            <AppMarker coordinate={{ latitude: 41.008, longitude: 28.978 }}>
              <View style={[s.safetyScore, { backgroundColor: '#f59e0bcc' }]}><Text style={s.safetyTxt}>7.2 Orta Güvenli</Text></View>
            </AppMarker>
            <AppMarker coordinate={{ latitude: 40.992, longitude: 29.022 }}>
              <View style={[s.safetyScore, { backgroundColor: '#6d28d9cc' }]}><Text style={s.safetyTxt}>8.9 Güvenli</Text></View>
            </AppMarker>
          </>
        )}
      </AppMap>

      {/* Header */}
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <TouchableOpacity style={s.iconBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#6d28d9" />
          </TouchableOpacity>

          {/* Group Picker */}
          <TouchableOpacity style={s.groupChip} onPress={() => setShowCirclePicker(true)}>
            <Text style={s.groupChipText} numberOfLines={1}>{activeCircle?.name ?? 'Grup Seç'}</Text>
            <Ionicons name="chevron-down" size={15} color="#6d28d9" />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* Notifications */}
            <TouchableOpacity style={s.iconBtn} onPress={() => setShowNotifs(true)}>
              <Ionicons name="notifications-outline" size={22} color="#6d28d9" />
              {unreadCount > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{unreadCount}</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>

      {/* Bottom Sheet */}
      <BottomSheet ref={bottomSheetRef} index={1} snapPoints={snapPoints}
        enablePanDownToClose={false} handleIndicatorStyle={s.handle} backgroundStyle={s.sheetBg}>
        <BottomSheetScrollView contentContainerStyle={s.sheetScroll}>
          {/* FABs */}
          <View style={s.fabRow}>
            <TouchableOpacity style={[s.fab, showSafetyLayer && s.fabActive]} onPress={() => setShowSafetyLayer(!showSafetyLayer)}>
              <Ionicons name="shield-checkmark" size={20} color={showSafetyLayer ? '#fff' : '#6d28d9'} />
              <Text style={[s.fabTxt, showSafetyLayer && s.fabTxtActive]}>Güvenlik</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.fab} onPress={checkIn}>
              <Ionicons name="checkmark-circle" size={20} color="#6d28d9" />
              <Text style={s.fabTxt}>Check In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.fab, s.fabSOS]} onPress={sendSOS}>
              <Ionicons name="alert-circle" size={20} color="#fff" />
              <Text style={[s.fabTxt, { color: '#fff' }]}>SOS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.fab} onPress={() => activeCircle && router.push({ pathname: '/(tabs)/places', params: { circleId: activeCircle.id, circleName: activeCircle.name } } as any)}>
              <Ionicons name="map-outline" size={20} color="#6d28d9" />
              <Text style={s.fabTxt}>Yerler</Text>
            </TouchableOpacity>
          </View>

          {/* Family Vibe Hub */}
          <View style={s.vibeHub}>
             <View style={s.vibeHeader}>
                <Text style={s.vibeTitle}>Aile Güvenlik Hub</Text>
                <View style={s.vibeLevel}>
                   <Text style={s.vibeLevelTxt}>94</Text>
                </View>
             </View>
             <Text style={s.vibeDesc}>Tüm aile üyeleri güvende ve hız limitlerine uyuyor.</Text>
             <View style={s.vibeStats}>
                <View style={s.vibeStat}>
                   <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                   <Text style={s.vibeStatTxt}>3 Güvenli Bölge</Text>
                </View>
                <View style={s.vibeStat}>
                   <Ionicons name="battery-dead" size={16} color="#f59e0b" />
                   <Text style={s.vibeStatTxt}>1 Düşük Pil</Text>
                </View>
             </View>
          </View>

          {/* People header */}
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Kişiler</Text>
            <Text style={s.sectionCount}>{users.length} üye</Text>
          </View>

          {users.map(user => (
            <TouchableOpacity key={user.id} style={s.card} onPress={() => handleUserPress(user)}>
              <View style={s.avatarWrap}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{user.username.charAt(0).toUpperCase()}</Text></View>
                <View style={[s.dot, { backgroundColor: user.ghostMode ? '#d1d5db' : '#22c55e' }]} />
              </View>
              <View style={s.info}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.uName}>{user.username}{user.id === currentUser?.id ? ' (Sen)' : ''}</Text>
                  {getVisibilityBadge(user) && <View style={s.ghost}><Text style={s.ghostTxt}>{getVisibilityBadge(user)}</Text></View>}
                </View>
                <Text style={s.uLoc} numberOfLines={1}>{getLocationSubtitle(user)}</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name={(user.batteryLevel ?? 0) > 20 ? 'battery-half' : 'battery-dead'} size={13} color={BC(user.batteryLevel ?? 0)} />
                    <Text style={[s.meta, { color: BC(user.batteryLevel ?? 0) }]}>{user.batteryLevel ?? 0}%</Text>
                  </View>
                  <Text style={s.meta}>⏱ {user.locationUpdateFrequency ?? 5}dk</Text>
                </View>
              </View>
              {user.id !== currentUser?.id && (
                <TouchableOpacity style={s.kissBtn} onPress={() => spawnKiss(user.id)}>
                  <Text style={{ fontSize: 20 }}>😘</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* ── Group Picker Modal ── */}
      <Modal visible={showCirclePicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Grup Seç</Text>
            <FlatList
              data={circles}
              keyExtractor={c => c.id.toString()}
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={[s.circleItem, activeCircle?.id === c.id && s.circleItemActive]}
                  onPress={() => { setActiveCircle(c); setShowCirclePicker(false); }}
                >
                  <View style={s.circleAvatar}><Text style={s.circleAvatarTxt}>{c.name.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.circleName}>{c.name}</Text>
                    <Text style={s.circleMeta}>{c.members.length} üye</Text>
                  </View>
                  {activeCircle?.id === c.id && <Ionicons name="checkmark-circle" size={24} color="#6d28d9" />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={s.modalClose} onPress={() => setShowCirclePicker(false)}>
              <Text style={s.modalCloseTxt}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Notifications Modal ── */}
      <Modal visible={showNotifs} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Bildirimler</Text>
            <FlatList
              data={notifications}
              keyExtractor={n => n.id.toString()}
              ListEmptyComponent={<Text style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>Henüz bildirim yok.</Text>}
              renderItem={({ item: n }) => {
                const icon = NOTIF_ICONS[n.type] ?? NOTIF_ICONS.DEFAULT;
                return (
                  <View style={[s.notifCard, !n.read && s.notifUnread]}>
                    <Text style={{ fontSize: 26 }}>{icon}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.notifContent}>{n.content}</Text>
                      <Text style={s.notifMeta}>{n.sender?.username} • {new Date(n.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    {!n.read && <View style={s.notifDot} />}
                  </View>
                );
              }}
            />
            <TouchableOpacity style={s.modalClose} onPress={() => setShowNotifs(false)}>
              <Text style={s.modalCloseTxt}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showUserActions} transparent animationType="slide" onRequestClose={closeUserSheets}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.userHero}>
              <View style={s.userHeroAvatar}>
                <Text style={s.userHeroAvatarTxt}>{selectedUser?.username?.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{selectedUser?.username}</Text>
                <Text style={s.userHeroMeta}>{selectedUser?.email || 'E-posta paylaşılmıyor'}</Text>
              </View>
            </View>

            <View style={s.actionGrid}>
              <TouchableOpacity style={s.actionCard} onPress={openPrivateChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#6d28d9" />
                <Text style={s.actionCardTxt}>Mesaj</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionCard} onPress={openNotificationOptions}>
                <Ionicons name="notifications-outline" size={22} color="#6d28d9" />
                <Text style={s.actionCardTxt}>Bildirim</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionCard} onPress={openCall}>
                <Ionicons name="call-outline" size={22} color="#6d28d9" />
                <Text style={s.actionCardTxt}>Ara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionCard} onPress={openHistory}>
                <Ionicons name="time-outline" size={22} color="#6d28d9" />
                <Text style={s.actionCardTxt}>Geçmiş</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionCard} onPress={focusUserLocation}>
                <Ionicons name="navigate-outline" size={22} color="#6d28d9" />
                <Text style={s.actionCardTxt}>Konuma Git</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionCard} onPress={openUserProfile}>
                <Ionicons name="person-circle-outline" size={22} color="#6d28d9" />
                <Text style={s.actionCardTxt}>Profil</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.modalClose} onPress={closeUserSheets}>
              <Text style={s.modalCloseTxt}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showUserProfile} transparent animationType="slide" onRequestClose={closeUserSheets}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Kullanıcı Profili</Text>
            <View style={s.profileHeader}>
              <View style={s.profileAvatarLarge}>
                <Text style={s.profileAvatarTxt}>{selectedUser?.username?.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={s.profileName}>{selectedUser?.username}</Text>
              <Text style={s.profileMail}>{selectedUser?.email || 'E-posta paylaşılmıyor'}</Text>
            </View>

            <View style={s.profileStats}>
              <View style={s.profileStatCard}>
                <Ionicons name="battery-half-outline" size={20} color={selectedUser ? BC(selectedUser.batteryLevel ?? 0) : '#6d28d9'} />
                <Text style={s.profileStatValue}>%{selectedUser?.batteryLevel ?? 0}</Text>
                <Text style={s.profileStatLabel}>Pil</Text>
              </View>
              <View style={s.profileStatCard}>
                <Ionicons name="time-outline" size={20} color="#6d28d9" />
                <Text style={s.profileStatValue}>{selectedUser?.locationUpdateFrequency ?? 0} dk</Text>
                <Text style={s.profileStatLabel}>Sıklık</Text>
              </View>
              <View style={s.profileStatCard}>
                <Ionicons
                  name={selectedUser?.locationVisibility === 'HIDDEN' ? 'eye-off-outline' : selectedUser?.locationVisibility === 'APPROXIMATE' ? 'navigate-outline' : 'eye-outline'}
                  size={20}
                  color="#6d28d9"
                />
                <Text style={s.profileStatValue}>
                  {selectedUser?.locationVisibility === 'HIDDEN'
                    ? 'Gizli'
                    : selectedUser?.locationVisibility === 'APPROXIMATE'
                      ? 'Yaklaşık'
                      : 'Açık'}
                </Text>
                <Text style={s.profileStatLabel}>Görünürlük</Text>
              </View>
            </View>

            <View style={s.profileDetailBox}>
              <Text style={s.profileDetailLabel}>Son Konum</Text>
              <Text style={s.profileDetailValue}>
                {selectedUser ? getLocationSubtitle(selectedUser) : 'Konum paylaşımı yok'}
              </Text>
              {selectedUser?.locationVisibility === 'APPROXIMATE' && selectedUser.locationRadiusKm ? (
                <Text style={s.profileDetailHint}>Paylaşılan alan yarıçapı yaklaşık {selectedUser.locationRadiusKm.toFixed(1)} km</Text>
              ) : null}
            </View>

            <View style={s.profileActionsRow}>
              <TouchableOpacity style={s.profilePrimaryBtn} onPress={openPrivateChat}>
                <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                <Text style={s.profilePrimaryBtnTxt}>Mesaj Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.profileSecondaryBtn} onPress={openNotificationOptions}>
                <Ionicons name="notifications-outline" size={18} color="#6d28d9" />
                <Text style={s.profileSecondaryBtnTxt}>Bildirim At</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.modalClose} onPress={closeUserSheets}>
              <Text style={s.modalCloseTxt}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showNotificationOptions} transparent animationType="slide" onRequestClose={() => setShowNotificationOptions(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Bildirim Gönder</Text>
            <Text style={s.optionIntro}>{selectedUser?.username} için hızlı bir bildirim seç.</Text>
            <FlatList
              data={NOTIFICATION_OPTIONS}
              keyExtractor={(item) => item.type}
              contentContainerStyle={s.optionList}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.optionCard} onPress={() => sendNotificationOption(item)}>
                  <View style={[s.optionIconWrap, { backgroundColor: `${item.tone}18` }]}>
                    <Ionicons name={item.icon} size={20} color={item.tone} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionTitle}>{item.title}</Text>
                    <Text style={s.optionSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={s.modalClose} onPress={() => setShowNotificationOptions(false)}>
              <Text style={s.modalCloseTxt}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MarkerBubble({ user, isMe }: { user: User; isMe: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[ms.bubble, isMe && ms.bubbleMe]}>
        <Text style={ms.initial}>{user.username.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={[ms.tail, isMe && ms.tailMe]} />
      <View style={ms.label}><Text style={ms.labelTxt}>{isMe ? 'Sen' : user.username}</Text></View>
    </View>
  );
}
const ms = StyleSheet.create({
  bubble: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#6d28d9', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  bubbleMe: { borderColor: '#10b981' },
  initial: { fontSize: 18, fontWeight: '800', color: '#6d28d9' },
  tail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#6d28d9', marginTop: -2 },
  tailMe: { borderTopColor: '#10b981' },
  label: { marginTop: 3, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  labelTxt: { fontSize: 11, fontWeight: '700', color: '#333' },
});

const s = StyleSheet.create({
  floatingEmoji: { position: 'absolute', bottom: '18%', alignSelf: 'center', fontSize: 58, zIndex: 9999 },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  groupChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginHorizontal: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4, maxWidth: 200 },
  groupChipText: { fontSize: 15, fontWeight: '700', color: '#111', flexShrink: 1 },
  badge: { position: 'absolute', top: 5, right: 5, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  handle: { backgroundColor: '#d1d5db', width: 40 },
  sheetBg: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 12 },
  sheetScroll: { paddingBottom: 40 },
  fabRow: { flexDirection: 'row', gap: 10, marginHorizontal: 18, marginBottom: 18, marginTop: 4 },
  fab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f0ff', paddingVertical: 12, borderRadius: 14, gap: 6 },
  fabActive: { backgroundColor: '#10b981' },
  fabSOS: { backgroundColor: '#ef4444' },
  fabTxt: { fontSize: 13, fontWeight: '700', color: '#6d28d9' },
  fabTxtActive: { color: '#fff' },
  vibeHub: { backgroundColor: '#f3f0ff', marginHorizontal: 18, borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#e9d5ff' },
  vibeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  vibeTitle: { fontSize: 18, fontWeight: '800', color: '#6d28d9' },
  vibeLevel: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6d28d9', justifyContent: 'center', alignItems: 'center' },
  vibeLevelTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
  vibeDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 12 },
  vibeStats: { flexDirection: 'row', gap: 15 },
  vibeStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vibeStatTxt: { fontSize: 12, fontWeight: '700', color: '#4b5563' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: '#111' },
  sectionCount: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '800', color: '#6d28d9' },
  dot: { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  info: { flex: 1 },
  uName: { fontSize: 17, fontWeight: '700', color: '#111' },
  ghost: { backgroundColor: '#f3f4f6', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  ghostTxt: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  uLoc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  meta: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  kissBtn: { padding: 8 },
  staticMarker: { position: 'absolute', alignItems: 'center' },
  safetyScore: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  safetyTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#111', marginBottom: 18 },
  modalClose: { marginTop: 14, padding: 15, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCloseTxt: { fontWeight: '700', color: '#374151', fontSize: 16 },
  circleItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, marginBottom: 10 },
  circleItemActive: { backgroundColor: '#f3f0ff' },
  circleAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  circleAvatarTxt: { fontSize: 20, fontWeight: '800', color: '#6d28d9' },
  circleName: { fontSize: 17, fontWeight: '700', color: '#111' },
  circleMeta: { fontSize: 13, color: '#9ca3af' },
  notifCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 10, backgroundColor: '#f9fafb' },
  notifUnread: { backgroundColor: '#f3f0ff' },
  notifContent: { fontSize: 14, fontWeight: '600', color: '#111' },
  notifMeta: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  notifDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6d28d9', marginLeft: 8 },
  userHero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  userHeroAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center' },
  userHeroAvatarTxt: { fontSize: 24, fontWeight: '800', color: '#6d28d9' },
  userHeroMeta: { color: '#6b7280', fontSize: 13 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  actionCard: { width: '47%', backgroundColor: '#f8f6ff', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ede9fe' },
  actionCardTxt: { fontSize: 14, fontWeight: '700', color: '#4b5563' },
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  profileAvatarLarge: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileAvatarTxt: { fontSize: 38, fontWeight: '900', color: '#6d28d9' },
  profileName: { fontSize: 24, fontWeight: '800', color: '#111' },
  profileMail: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  profileStats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  profileStatCard: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 6 },
  profileStatValue: { fontSize: 15, fontWeight: '800', color: '#111' },
  profileStatLabel: { fontSize: 12, color: '#9ca3af' },
  profileDetailBox: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 16, marginBottom: 16 },
  profileDetailLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase' },
  profileDetailValue: { fontSize: 15, fontWeight: '600', color: '#374151' },
  profileDetailHint: { marginTop: 8, fontSize: 12, color: '#6b7280' },
  profileActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  profilePrimaryBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#6d28d9', borderRadius: 14, paddingVertical: 14 },
  profilePrimaryBtnTxt: { color: '#fff', fontWeight: '800' },
  profileSecondaryBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#f3f0ff', borderRadius: 14, paddingVertical: 14 },
  profileSecondaryBtnTxt: { color: '#6d28d9', fontWeight: '800' },
  optionIntro: { fontSize: 14, color: '#6b7280', marginTop: -8, marginBottom: 16 },
  optionList: { paddingBottom: 4 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f9fafb', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  optionIconWrap: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  optionSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
});
