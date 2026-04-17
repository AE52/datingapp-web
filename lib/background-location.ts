import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { getSessionSnapshot, LOCATIONS_API_URL } from '@/api';
import { buildQueuedLocationEvent, dedupeQueuedLocationEvents, type QueuedLocationEvent } from '@/lib/background-location-queue';

export const BACKGROUND_LOCATION_TASK = 'vibeapp-background-location';
const BACKGROUND_LOCATION_ENABLED_KEY = 'backgroundLocationEnabled';
const LOCATION_QUEUE_KEY = 'backgroundLocationQueue';
const MAX_QUEUE_SIZE = 250;

type TaskLocationPayload = {
  locations?: Array<{
    coords?: {
      latitude?: number;
      longitude?: number;
      speed?: number | null;
      accuracy?: number | null;
    };
    timestamp?: number;
  }>;
};

async function readQueue(): Promise<QueuedLocationEvent[]> {
  const raw = await AsyncStorage.getItem(LOCATION_QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as QueuedLocationEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
    return [];
  }
}

async function writeQueue(events: QueuedLocationEvent[]) {
  await AsyncStorage.setItem(LOCATION_QUEUE_KEY, JSON.stringify(dedupeQueuedLocationEvents(events, MAX_QUEUE_SIZE)));
}

async function appendQueue(events: QueuedLocationEvent[]) {
  const current = await readQueue();
  await writeQueue([...current, ...events]);
}

async function flushQueue(): Promise<boolean> {
  const session = await getSessionSnapshot();
  if (!session) return false;

  const queuedEvents = await readQueue();
  if (!queuedEvents.length) return true;

  const response = await fetch(`${LOCATIONS_API_URL}/batch/${session.user.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: queuedEvents }),
  });

  if (!response.ok) {
    return false;
  }

  await AsyncStorage.removeItem(LOCATION_QUEUE_KEY);
  return true;
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<TaskLocationPayload>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('Background location task failed:', error.message);
      return;
    }

    const events = (data?.locations ?? [])
      .map((location) => buildQueuedLocationEvent(location.coords ?? {}, 'background', location.timestamp ?? Date.now()))
      .filter((event): event is QueuedLocationEvent => Boolean(event));

    if (!events.length) {
      return;
    }

    await appendQueue(events);
    try {
      await flushQueue();
    } catch (taskError) {
      console.warn('Background location flush failed:', taskError);
    }
  });
}

export async function isBackgroundTrackingEnabled() {
  return (await AsyncStorage.getItem(BACKGROUND_LOCATION_ENABLED_KEY)) === '1';
}

export async function syncPendingLocationQueue() {
  try {
    await flushQueue();
  } catch {
  }
}

export async function getQueuedLocationCount() {
  return (await readQueue()).length;
}

export async function getBackgroundLocationDiagnostics() {
  const queueSize = await getQueuedLocationCount();
  const enabled = await isBackgroundTrackingEnabled();
  const taskManagerAvailable = Platform.OS === 'web' ? false : await TaskManager.isAvailableAsync();
  const started = Platform.OS === 'web' ? false : await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

  return {
    enabled,
    started,
    queueSize,
    taskManagerAvailable,
  };
}

export async function sendForegroundLocationUpdate() {
  if (Platform.OS === 'web') return;

  const session = await getSessionSnapshot();
  if (!session) return;

  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const event = buildQueuedLocationEvent(position.coords, 'foreground', position.timestamp ?? Date.now());
  if (!event) return;

  await appendQueue([event]);
  await flushQueue();
}

export async function startBackgroundTracking(updateFrequencyMinutes = 5) {
  if (Platform.OS === 'web') {
    throw new Error('Arka plan konum takibi web üzerinde desteklenmiyor.');
  }

  const isTaskManagerAvailable = await TaskManager.isAvailableAsync();
  if (!isTaskManagerAvailable) {
    throw new Error('Arka plan görevleri bu çalıştırma modunda kullanılamıyor. Development build gerekir.');
  }

  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (!foregroundPermission.granted) {
    throw new Error('Ön plan konum izni verilmedi.');
  }

  const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  if (!backgroundPermission.granted) {
    throw new Error('Arka plan konum izni verilmedi.');
  }

  const intervalMs = Math.max(updateFrequencyMinutes, 1) * 60_000;
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (!alreadyStarted) {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: intervalMs,
      distanceInterval: 25,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'VibeApp konum koruması aktif',
        notificationBody: 'Canlı konum ve güvenlik uyarıları arka planda güncelleniyor.',
      },
    });
  }

  await AsyncStorage.setItem(BACKGROUND_LOCATION_ENABLED_KEY, '1');
  await sendForegroundLocationUpdate();
}

export async function stopBackgroundTracking() {
  if (Platform.OS !== 'web') {
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (started) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch {
    }
  }

  await AsyncStorage.removeItem(BACKGROUND_LOCATION_ENABLED_KEY);
}

export async function resumeBackgroundTracking(updateFrequencyMinutes = 5) {
  if (!(await isBackgroundTrackingEnabled()) || Platform.OS === 'web') {
    return;
  }

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (!started) {
      await startBackgroundTracking(updateFrequencyMinutes);
      return;
    }
    await syncPendingLocationQueue();
  } catch (error) {
    console.warn('Unable to resume background location tracking:', error);
  }
}
