import { formatCallDuration, normalizeIceServers, resolveCallDisplayName } from '@/lib/call-utils';

describe('call utils', () => {
  it('formats call duration', () => {
    expect(formatCallDuration(0)).toBe('00:00');
    expect(formatCallDuration(65)).toBe('01:05');
  });

  it('resolves a display name from inputs', () => {
    expect(resolveCallDisplayName('Aile Hatti', '42')).toBe('Aile Hatti');
    expect(resolveCallDisplayName('', '42')).toBe('Kullanici #42');
    expect(resolveCallDisplayName()).toBe('Cagri');
  });

  it('normalizes empty ice server entries', () => {
    expect(normalizeIceServers([{ urls: ['stun:test', ''] }, { urls: [] }])).toEqual([{ urls: ['stun:test'] }]);
  });
});
