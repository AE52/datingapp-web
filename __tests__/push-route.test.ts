import { jest } from '@jest/globals';

jest.mock('@/api', () => ({
  PUSH_DEVICES_API_URL: 'http://localhost:8080/api/push/devices',
}));

import { resolveNotificationRoute } from '@/lib/push';

describe('resolveNotificationRoute', () => {
  it('routes call invites to the call screen', () => {
    expect(
      resolveNotificationRoute({
        type: 'CALL_INVITE',
        callId: 'call-1',
        mode: 'video',
        callerId: '7',
      }),
    ).toEqual({
      pathname: '/(tabs)/call',
      params: {
        callId: 'call-1',
        type: 'video',
        peerUserId: '7',
        incoming: '1',
      },
    });
  });

  it('falls back to the tabs shell', () => {
    expect(resolveNotificationRoute({ type: 'CHECK_IN' })).toEqual({ pathname: '/(tabs)' });
  });
});
