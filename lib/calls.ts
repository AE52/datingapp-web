import { buildWebSocketUrl, CALLS_API_URL, getAccessToken } from '@/api';

export type IceServerView = {
  urls: string[];
};

export type CallSessionView = {
  callId: string;
  mode: 'voice' | 'video';
  callerId: number;
  calleeId: number;
  websocketUrl: string;
};

export async function createCallSession(callerId: number, calleeId: number, mode: 'voice' | 'video') {
  const response = await fetch(CALLS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callerId, calleeId, mode }),
  });

  if (!response.ok) {
    throw new Error('Arama baslatilamadi.');
  }

  return response.json() as Promise<CallSessionView>;
}

export async function fetchIceServers() {
  const response = await fetch(`${CALLS_API_URL}/ice-servers`);
  if (!response.ok) {
    throw new Error('ICE sunuculari yuklenemedi.');
  }
  return response.json() as Promise<IceServerView[]>;
}

export async function buildCallWebSocketUrl(callId: string, userId: number) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Arama oturumu icin kimlik dogrulamasi yok.');
  }

  return buildWebSocketUrl('/ws/calls', {
    callId,
    userId,
    token,
  });
}
