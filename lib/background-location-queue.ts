export type QueuedLocationEvent = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  accuracy?: number | null;
  batteryLevel?: number | null;
  clientEventId: string;
  source: 'foreground' | 'background';
};

export function dedupeQueuedLocationEvents(events: QueuedLocationEvent[], maxQueueSize: number) {
  const byId = new Map<string, QueuedLocationEvent>();
  for (const event of events) {
    byId.set(event.clientEventId, event);
  }
  return Array.from(byId.values()).slice(-maxQueueSize);
}

export function buildQueuedLocationEvent(
  coords: { latitude?: number; longitude?: number; speed?: number | null; accuracy?: number | null },
  source: 'foreground' | 'background',
  timestamp = Date.now(),
  nonce = Math.random().toString(36).slice(2, 10),
): QueuedLocationEvent | null {
  if (typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return null;
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed: typeof coords.speed === 'number' ? coords.speed : null,
    accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : null,
    batteryLevel: null,
    clientEventId: `${source}-${timestamp}-${nonce}`,
    source,
  };
}
