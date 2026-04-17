import { buildQueuedLocationEvent, dedupeQueuedLocationEvents } from '@/lib/background-location-queue';

describe('background location queue', () => {
  it('builds a queued event when coordinates exist', () => {
    expect(
      buildQueuedLocationEvent(
        { latitude: 41.1, longitude: 29.1, speed: 25, accuracy: 8 },
        'background',
        1000,
        'nonce',
      ),
    ).toEqual({
      latitude: 41.1,
      longitude: 29.1,
      speed: 25,
      accuracy: 8,
      batteryLevel: null,
      clientEventId: 'background-1000-nonce',
      source: 'background',
    });
  });

  it('drops duplicate client events and enforces queue size', () => {
    const events = [
      { latitude: 1, longitude: 1, clientEventId: 'evt-1', source: 'foreground' as const },
      { latitude: 2, longitude: 2, clientEventId: 'evt-1', source: 'foreground' as const },
      { latitude: 3, longitude: 3, clientEventId: 'evt-2', source: 'background' as const },
    ];

    expect(dedupeQueuedLocationEvents(events, 2)).toEqual([
      { latitude: 2, longitude: 2, clientEventId: 'evt-1', source: 'foreground' },
      { latitude: 3, longitude: 3, clientEventId: 'evt-2', source: 'background' },
    ]);
  });
});
