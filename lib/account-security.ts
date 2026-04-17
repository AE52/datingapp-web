import { SESSIONS_API_URL } from '@/api';

export type SessionView = {
  id: number;
  deviceLabel?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  trusted: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt: string;
};

export async function listSessions() {
  const response = await fetch(`${SESSIONS_API_URL}/me`);
  if (!response.ok) {
    throw new Error('Oturumlar yüklenemedi.');
  }
  return response.json() as Promise<SessionView[]>;
}

export async function updateSessionTrust(sessionId: number, trusted: boolean) {
  const response = await fetch(`${SESSIONS_API_URL}/${sessionId}/trust`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trusted }),
  });
  if (!response.ok) {
    throw new Error('Oturum güven ayarı güncellenemedi.');
  }
  return response.json() as Promise<SessionView>;
}

export async function revokeSession(sessionId: number) {
  const response = await fetch(`${SESSIONS_API_URL}/${sessionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Oturum iptal edilemedi.');
  }
}

export async function revokeAllSessions() {
  const response = await fetch(`${SESSIONS_API_URL}/revoke-all`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Tum oturumlar iptal edilemedi.');
  }
}
