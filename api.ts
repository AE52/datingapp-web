import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PROD_API_ORIGIN = 'https://api.datingapp.erenozdemir.com.tr';
const DEFAULT_DEV_HOST = '192.168.1.106';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveApiOrigin(): string {
  const envOrigin = process.env.EXPO_PUBLIC_API_ORIGIN?.trim();
  if (envOrigin) return trimTrailingSlash(envOrigin);
  if (Platform.OS === 'web') return PROD_API_ORIGIN;
  return `http://${DEFAULT_DEV_HOST}:8080`;
}

export const API_BASE_URL = `${resolveApiOrigin()}/api/users`;
export const API_ORIGIN = resolveApiOrigin();
export const NOTIFICATIONS_API_URL = `${API_ORIGIN}/api/notifications`;
export const EMERGENCY_CONTACTS_API_URL = `${API_ORIGIN}/api/emergency-contacts`;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStoredUser() {
  const saved = await AsyncStorage.getItem('user');
  if (!saved) return null;

  const parsed = JSON.parse(saved);
  if (!parsed?.email) return parsed;

  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: parsed.email }),
    });

    if (!response.ok) {
      await AsyncStorage.removeItem('user');
      return null;
    }

    const freshUser = await response.json();
    await AsyncStorage.setItem('user', JSON.stringify(freshUser));
    return freshUser;
  } catch {
    return parsed;
  }
}

export { fetchWithTimeout };
