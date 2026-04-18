type JsonResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

describe('api web session storage', () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  const sessionStorageState = new Map<string, string>();
  let originalPlatformDescriptor: PropertyDescriptor | undefined;

  const sessionStorageMock = {
    getItem: jest.fn((key: string) => sessionStorageState.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      sessionStorageState.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      sessionStorageState.delete(key);
    }),
    clear: jest.fn(() => {
      sessionStorageState.clear();
    }),
  };

  beforeEach(() => {
    jest.resetModules();
    sessionStorageState.clear();
    Object.values(sessionStorageMock).forEach((mockFn) => mockFn.mockClear());

    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: jest.fn(),
    });

    Object.defineProperty(global, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock,
    });
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        location: {
          host: 'datingapp.erenozdemir.com.tr',
          protocol: 'https:',
        },
      },
    });

    const reactNative = require('react-native');
    originalPlatformDescriptor = Object.getOwnPropertyDescriptor(reactNative.Platform, 'OS');
    Object.defineProperty(reactNative.Platform, 'OS', {
      configurable: true,
      get: () => 'web',
    });
  });

  afterEach(() => {
    const reactNative = require('react-native');
    if (originalPlatformDescriptor) {
      Object.defineProperty(reactNative.Platform, 'OS', originalPlatformDescriptor);
    }

    if (originalFetch) {
      Object.defineProperty(global, 'fetch', {
        configurable: true,
        value: originalFetch,
      });
    } else {
      Reflect.deleteProperty(global, 'fetch');
    }

    Reflect.deleteProperty(global, 'sessionStorage');

    if (originalWindow) {
      Object.defineProperty(global, 'window', {
        configurable: true,
        value: originalWindow,
      });
    } else {
      Reflect.deleteProperty(global, 'window');
    }
  });

  it('persists the auth session in browser sessionStorage on web', async () => {
    const loginPayload = {
      token: 'token-1',
      refreshToken: 'refresh-1',
      user: { id: 7, username: 'demo', admin: false },
      expiresAt: '2099-01-01T00:00:00Z',
      refreshExpiresAt: '2099-02-01T00:00:00Z',
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => loginPayload,
    } satisfies JsonResponse);

    const api = require('@/api') as typeof import('@/api');
    const user = await api.login('Demo@Example.com', 'secret');
    const snapshot = await api.getSessionSnapshot(false);

    expect(user).toEqual(loginPayload.user);
    expect(snapshot).toEqual(loginPayload);
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('authSession', JSON.stringify(loginPayload));
    expect(sessionStorageMock.getItem('authSession')).toBe(JSON.stringify(loginPayload));
  });

  it('clears the browser session storage on logout', async () => {
    const loginPayload = {
      token: 'token-2',
      refreshToken: 'refresh-2',
      user: { id: 9, username: 'demo', admin: false },
      expiresAt: '2099-01-01T00:00:00Z',
      refreshExpiresAt: '2099-02-01T00:00:00Z',
    };
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => loginPayload,
      } satisfies JsonResponse)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } satisfies JsonResponse);

    const api = require('@/api') as typeof import('@/api');
    await api.login('demo@example.com', 'secret');
    await api.logout();

    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('authSession');
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('user');
    expect(sessionStorageMock.getItem('authSession')).toBeNull();
  });
});
