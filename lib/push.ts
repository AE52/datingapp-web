import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AppUser } from '@/api';
import { PUSH_DEVICES_API_URL } from '@/api';

const ANDROID_CHANNEL_ID = 'safety-alerts';

export type PushDeviceView = {
  id: number;
  platform: string;
  provider: string;
  deviceName?: string | null;
  appVersion?: string | null;
  buildNumber?: string | null;
  trusted: boolean;
  notificationsEnabled: boolean;
  backgroundTrackingEnabled: boolean;
  lastDeliveryStatus?: string | null;
  createdAt: string;
  lastSeenAt?: string | null;
};

let notificationHandlerConfigured = false;

type NotificationPermissionSnapshot = {
  granted?: boolean;
  status?: string;
  ios?: { status?: number };
};

async function loadNotificationsModule() {
  return import('expo-notifications');
}

async function ensureNotificationHandler() {
  if (Platform.OS === 'web') return null;
  if (notificationHandlerConfigured) return;
  notificationHandlerConfigured = true;

  const Notifications = await loadNotificationsModule();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  const Notifications = await loadNotificationsModule();
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Safety alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#ef4444',
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function resolveDeviceName() {
  return Constants.expoConfig?.name || `${Platform.OS} device`;
}

function resolveBuildNumber() {
  if (Platform.OS === 'ios') {
    return Constants.expoConfig?.ios?.buildNumber ?? null;
  }
  return Constants.expoConfig?.android?.versionCode?.toString() ?? null;
}

export async function registerPushDevice(user: AppUser, backgroundTrackingEnabled = false) {
  if (Platform.OS === 'web') {
    return null;
  }

  await ensureNotificationHandler();
  await ensureAndroidChannel();

  const Notifications = await loadNotificationsModule();
  const currentPermissions = await Notifications.getPermissionsAsync() as NotificationPermissionSnapshot;
  const permissions = (
    currentPermissions.granted
    || currentPermissions.status === Notifications.PermissionStatus.GRANTED
    || currentPermissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    ? currentPermissions
    : await Notifications.requestPermissionsAsync() as NotificationPermissionSnapshot;

  const notificationsEnabled = Boolean(
    permissions.granted
    || permissions.status === Notifications.PermissionStatus.GRANTED
    || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  );

  if (!notificationsEnabled) {
    return null;
  }

  const token = await Notifications.getDevicePushTokenAsync();
  const tokenValue = typeof token.data === 'string' ? token.data : JSON.stringify(token.data);
  if (!tokenValue) {
    return null;
  }

  const response = await fetch(`${PUSH_DEVICES_API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      token: tokenValue,
      platform: Platform.OS,
      provider: token.type === 'android' ? 'fcm' : token.type === 'ios' ? 'apns' : token.type,
      deviceName: resolveDeviceName(),
      appVersion: Constants.expoConfig?.version ?? 'dev',
      buildNumber: resolveBuildNumber(),
      notificationsEnabled: true,
      backgroundTrackingEnabled,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Push cihazı kaydedilemedi.');
  }

  return response.json() as Promise<PushDeviceView>;
}

export async function listPushDevices() {
  const response = await fetch(`${PUSH_DEVICES_API_URL}/me`);
  if (!response.ok) {
    throw new Error('Push cihazları yüklenemedi.');
  }
  return response.json() as Promise<PushDeviceView[]>;
}

export async function updatePushDeviceTrust(deviceId: number, trusted: boolean) {
  const response = await fetch(`${PUSH_DEVICES_API_URL}/${deviceId}/trust`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trusted }),
  });
  if (!response.ok) {
    throw new Error('Push cihaz güven ayarı güncellenemedi.');
  }
  return response.json() as Promise<PushDeviceView>;
}

export async function revokePushDevice(deviceId: number) {
  const response = await fetch(`${PUSH_DEVICES_API_URL}/${deviceId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Push cihaz kaldırılamadı.');
  }
}

type NotificationRoute = {
  pathname: '/(tabs)' | '/(tabs)/call';
  params?: Record<string, string>;
};

export function resolveNotificationRoute(data: Record<string, unknown> | null | undefined): NotificationRoute | null {
  if (!data) return null;

  if (data.type === 'CALL_INVITE' && typeof data.callId === 'string') {
    return {
      pathname: '/(tabs)/call',
      params: {
        callId: data.callId,
        type: typeof data.mode === 'string' ? data.mode : 'voice',
        peerUserId: typeof data.callerId === 'string' ? data.callerId : '',
        incoming: '1',
      },
    };
  }

  return { pathname: '/(tabs)' };
}

export function addNotificationResponseListener(onRoute: (route: NotificationRoute) => void) {
  if (Platform.OS === 'web') {
    return { remove() {} };
  }

  let subscription: { remove: () => void } = { remove() {} };
  void (async () => {
    await ensureNotificationHandler();
    const Notifications = await loadNotificationsModule();
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = resolveNotificationRoute(response.notification.request.content.data);
      if (route) {
        onRoute(route);
      }
    });
  })();

  return {
    remove() {
      subscription.remove();
    },
  };
}
