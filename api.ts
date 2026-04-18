import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PROD_API_ORIGIN = 'https://vibeapi-185-246-113-9.sslip.io';
const DEV_API_PORT = process.env.EXPO_PUBLIC_API_PORT?.trim() || '8080';
const AUTH_SESSION_KEY = 'authSession';
const LEGACY_USER_KEY = 'user';

export type AppUser = {
  id: number;
  username: string;
  email?: string | null;
  admin: boolean;
  profilePicture?: string | null;
  batteryLevel?: number;
  ghostMode?: boolean;
  bubbleEnabled?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  locationVisibility?: 'EXACT' | 'APPROXIMATE' | 'HIDDEN' | 'UNAVAILABLE';
  locationRadiusKm?: number | null;
  locationUpdateFrequency?: number;
  lowBatteryAlertsEnabled?: boolean | null;
};

type AuthSession = {
  token: string;
  refreshToken: string;
  user: AppUser;
  expiresAt: string;
  refreshExpiresAt: string;
};

type ErrorPayload = {
  message?: string;
  error?: string;
};

type FetchExecutor = typeof globalThis.fetch;

const nativeFetch = globalThis.fetch.bind(globalThis);
let sessionCache: AuthSession | null | undefined;
let fetchPatched = false;
let refreshInFlight: Promise<AuthSession | null> | null = null;
const REFRESH_WINDOW_MS = 60_000;

function readWebSessionValue(): string | null {
  if (Platform.OS !== 'web') return null;

  try {
    return globalThis.sessionStorage?.getItem(AUTH_SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeWebSessionValue(value: string) {
  if (Platform.OS !== 'web') return false;

  try {
    globalThis.sessionStorage?.setItem(AUTH_SESSION_KEY, value);
    globalThis.sessionStorage?.removeItem(LEGACY_USER_KEY);
    return true;
  } catch {
    return false;
  }
}

function clearWebSessionValue() {
  if (Platform.OS !== 'web') return false;

  try {
    globalThis.sessionStorage?.removeItem(AUTH_SESSION_KEY);
    globalThis.sessionStorage?.removeItem(LEGACY_USER_KEY);
    return true;
  } catch {
    return false;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLoopbackHost(value: string): boolean {
  return value === 'localhost' || value === '127.0.0.1' || value === '::1';
}

function normalizeHost(value: string): string {
  const trimmed = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (Platform.OS === 'android' && isLoopbackHost(trimmed)) return '10.0.2.2';
  return trimmed;
}

function extractHostname(value?: string | null): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value.includes('://') ? value : `http://${value}`);
    return parsed.hostname ? normalizeHost(parsed.hostname) : null;
  } catch {
    return null;
  }
}

function resolveExpoDevHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.platform?.hostUri,
    Constants.experienceUrl,
    Constants.linkingUri,
  ];

  for (const candidate of candidates) {
    const host = extractHostname(candidate);
    if (host) return host;
  }

  return null;
}

function resolveLocalWebApiOrigin(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const host = extractHostname(window.location.host);
  if (!host) return null;

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  return `${protocol}://${host}:${DEV_API_PORT}`;
}

function resolveApiOrigin(): string {
  const envOrigin = process.env.EXPO_PUBLIC_API_ORIGIN?.trim();
  if (envOrigin) return trimTrailingSlash(envOrigin);

  if (__DEV__) {
    const localWebOrigin = resolveLocalWebApiOrigin();
    if (localWebOrigin) return trimTrailingSlash(localWebOrigin);

    const expoHost = resolveExpoDevHost();
    if (expoHost) return `http://${expoHost}:${DEV_API_PORT}`;

    if (Platform.OS === 'android') return `http://10.0.2.2:${DEV_API_PORT}`;
    if (Platform.OS === 'ios') return `http://127.0.0.1:${DEV_API_PORT}`;
  }

  return PROD_API_ORIGIN;
}

function isApiUrl(url: string): boolean {
  return url.startsWith(API_ORIGIN);
}

function isAuthExemptUrl(url: string): boolean {
  return url.endsWith('/api/users/login')
    || url.endsWith('/api/users/refresh')
    || url.endsWith('/api/users/logout');
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorPayload;
    return payload.message || payload.error || 'İstek başarısız oldu.';
  } catch {
    return 'İstek başarısız oldu.';
  }
}

function normalizeRequestError(error: unknown, url: string): Error {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error(`API yanıt vermedi. Zaman aşımı: ${url}`);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network request failed')
      || message.includes('failed to fetch')
      || message.includes('load failed')
    ) {
      return new Error(
        `API'ye ulaşılamadı. Denenen adres: ${API_ORIGIN}. Backend'in çalıştığını ve cihazın bu adrese erişebildiğini doğrula.`,
      );
    }

    return error;
  }

  return new Error(`İstek başarısız oldu: ${url}`);
}

async function loadSession(): Promise<AuthSession | null> {
  if (sessionCache !== undefined) return sessionCache;

  const raw = await readSessionPayload();
  if (!raw) {
    sessionCache = null;
    await AsyncStorage.removeItem(LEGACY_USER_KEY);
    return null;
  }

  try {
    sessionCache = JSON.parse(raw) as AuthSession;
    return sessionCache;
  } catch {
    sessionCache = null;
    await clearSessionStorage();
    return null;
  }
}

async function persistSession(session: AuthSession | null) {
  sessionCache = session;
  if (!session) {
    await clearSessionStorage();
    return;
  }

  await writeSessionPayload(JSON.stringify(session));
  await AsyncStorage.removeItem(LEGACY_USER_KEY);
}

async function readSessionPayload(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const webValue = readWebSessionValue();
    if (webValue) return webValue;
    return AsyncStorage.getItem(AUTH_SESSION_KEY);
  }

  try {
    const secureValue = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
    if (secureValue) return secureValue;
  } catch {}

  const fallbackValue = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  if (fallbackValue) {
    try {
      await SecureStore.setItemAsync(AUTH_SESSION_KEY, fallbackValue);
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    } catch {}
  }
  return fallbackValue;
}

async function writeSessionPayload(value: string) {
  if (Platform.OS === 'web') {
    if (writeWebSessionValue(value)) {
      await AsyncStorage.multiRemove([AUTH_SESSION_KEY, LEGACY_USER_KEY]);
      return;
    }
    await AsyncStorage.setItem(AUTH_SESSION_KEY, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(AUTH_SESSION_KEY, value);
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    await AsyncStorage.setItem(AUTH_SESSION_KEY, value);
  }
}

async function clearSessionStorage() {
  if (Platform.OS === 'web') {
    clearWebSessionValue();
  } else {
    try {
      await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    } catch {}
  }
  await AsyncStorage.multiRemove([AUTH_SESSION_KEY, LEGACY_USER_KEY]);
}

function isSessionExpired(expiresAt: string): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
}

function shouldRefreshSession(session: AuthSession): boolean {
  const expiresAtMs = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAtMs)) return true;
  return expiresAtMs - Date.now() <= REFRESH_WINDOW_MS;
}

async function refreshSession(currentSession: AuthSession): Promise<AuthSession | null> {
  if (isSessionExpired(currentSession.refreshExpiresAt)) {
    await persistSession(null);
    return null;
  }

  const response = await requestWithTimeout(
    `${API_BASE_URL}/refresh`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
    },
    5000,
    nativeFetch,
  );

  if (!response.ok) {
    await persistSession(null);
    return null;
  }

  const payload = await response.json() as AuthSession;
  const nextSession = {
    token: payload.token,
    refreshToken: payload.refreshToken,
    user: payload.user,
    expiresAt: payload.expiresAt,
    refreshExpiresAt: payload.refreshExpiresAt,
  };
  await persistSession(nextSession);
  return nextSession;
}

async function ensureFreshSession(forceRefresh = false): Promise<AuthSession | null> {
  const session = await loadSession();
  if (!session) return null;

  if (!forceRefresh && !shouldRefreshSession(session)) {
    return session;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const latestSession = await loadSession();
      if (!latestSession) return null;
      if (!forceRefresh && !shouldRefreshSession(latestSession)) {
        return latestSession;
      }
      try {
        return await refreshSession(latestSession);
      } catch {
        await persistSession(null);
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

function patchGlobalFetch() {
  if (fetchPatched) return;
  fetchPatched = true;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (isApiUrl(url) && !isAuthExemptUrl(url) && !headers.has('Authorization')) {
      const session = await ensureFreshSession();
      if (session?.token) {
        headers.set('Authorization', `Bearer ${session.token}`);
      }
    }

    let response = await nativeFetch(input, { ...init, headers });
    if (response.status === 401 && isApiUrl(url) && !isAuthExemptUrl(url) && headers.get('X-Session-Retry') !== '1') {
      const refreshedSession = await ensureFreshSession(true);
      if (refreshedSession?.token) {
        headers.set('Authorization', `Bearer ${refreshedSession.token}`);
        headers.set('X-Session-Retry', '1');
        response = await nativeFetch(input, { ...init, headers });
      }
    }

    if (response.status === 401 && isApiUrl(url) && !isAuthExemptUrl(url)) {
      await persistSession(null);
    }
    return response;
  }) as typeof globalThis.fetch;
}

async function requestWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000,
  executor: FetchExecutor = globalThis.fetch,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await executor(url, { ...options, signal: controller.signal });
  } catch (error) {
    throw normalizeRequestError(error, url);
  } finally {
    clearTimeout(timeout);
  }
}

export const API_ORIGIN = resolveApiOrigin();
export const API_BASE_URL = `${API_ORIGIN}/api/users`;
export const CIRCLES_API_URL = `${API_ORIGIN}/api/circles`;
export const CHAT_API_URL = `${API_ORIGIN}/api/chat`;
export const CALLS_API_URL = `${API_ORIGIN}/api/calls`;
export const LOCATIONS_API_URL = `${API_ORIGIN}/api/locations`;
export const MEDIA_API_URL = `${API_ORIGIN}/api/media`;
export const NOTIFICATIONS_API_URL = `${API_ORIGIN}/api/notifications`;
export const PUSH_DEVICES_API_URL = `${API_ORIGIN}/api/push/devices`;
export const SESSIONS_API_URL = `${API_ORIGIN}/api/sessions`;
export const EMERGENCY_CONTACTS_API_URL = `${API_ORIGIN}/api/emergency-contacts`;
export const MEDICAL_PROFILE_API_URL = `${API_ORIGIN}/api/medical-profile`;

patchGlobalFetch();

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
  return requestWithTimeout(url, options, timeoutMs);
}

export async function login(email: string, password: string): Promise<AppUser> {
  const response = await requestWithTimeout(
    `${API_BASE_URL}/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    },
    5000,
    nativeFetch,
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = await response.json() as AuthSession;
  await persistSession({
    token: payload.token,
    refreshToken: payload.refreshToken,
    user: payload.user,
    expiresAt: payload.expiresAt,
    refreshExpiresAt: payload.refreshExpiresAt,
  });
  return payload.user;
}

export async function logout() {
  const session = await loadSession();
  try {
    if (session?.refreshToken) {
      await requestWithTimeout(
        `${API_BASE_URL}/logout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        },
        3000,
        nativeFetch,
      );
    }
  } catch {
  } finally {
    await persistSession(null);
  }
}

export async function replaceStoredUser(user: AppUser) {
  const session = await loadSession();
  if (!session) return;
  await persistSession({ ...session, user });
}

export async function getSessionSnapshot(refresh = true): Promise<AuthSession | null> {
  return refresh ? ensureFreshSession() : loadSession();
}

export async function getAccessToken(): Promise<string | null> {
  return (await ensureFreshSession())?.token ?? null;
}

export async function getStoredUser(refresh = true): Promise<AppUser | null> {
  const session = await (refresh ? ensureFreshSession() : loadSession());
  if (!session) return null;
  if (!refresh) return session.user;

  try {
    const response = await requestWithTimeout(`${API_BASE_URL}/me`, {}, 5000);
    if (response.ok) {
      const user = await response.json() as AppUser;
      await persistSession({ ...session, user });
      return user;
    }
    if (response.status === 401) {
      await persistSession(null);
      return null;
    }
  } catch {
    return session.user;
  }

  return session.user;
}

export function buildWebSocketUrl(path: string, params: Record<string, string | number | null | undefined> = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const socketProtocol = API_ORIGIN.startsWith('https://') ? 'wss://' : 'ws://';
  const socketOrigin = API_ORIGIN.replace(/^https?:\/\//, socketProtocol);
  const url = new URL(`${socketOrigin}${normalizedPath}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && `${value}`.trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}
