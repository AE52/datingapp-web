import type { IceServerView } from '@/lib/calls';

export function formatCallDuration(value: number) {
  const minutes = Math.floor(value / 60);
  const remainingSeconds = value % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function resolveCallDisplayName(circleName?: string, peerUserId?: string) {
  if (circleName?.trim()) {
    return circleName.trim();
  }
  if (peerUserId?.trim()) {
    return `Kullanici #${peerUserId.trim()}`;
  }
  return 'Cagri';
}

export function normalizeIceServers(servers: IceServerView[]) {
  return servers
    .map((server) => ({
      urls: server.urls.filter((value) => typeof value === 'string' && value.trim().length > 0),
    }))
    .filter((server) => server.urls.length > 0);
}
