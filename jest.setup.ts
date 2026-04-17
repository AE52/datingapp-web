import '@testing-library/jest-native/extend-expect';
import { jest } from '@jest/globals';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-constants', () => ({
  expoConfig: {
    name: 'VibeApp',
    version: '1.0.0',
    android: { versionCode: 1 },
    ios: { buildNumber: '1' },
    extra: {
      enableDemoLoginHints: false,
    },
  },
  platform: {},
  experienceUrl: null,
  linkingUri: null,
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
}));
