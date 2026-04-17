import type { ConfigContext, ExpoConfig } from 'expo/config';

function uniquePlugins(plugins: NonNullable<ExpoConfig['plugins']>): NonNullable<ExpoConfig['plugins']> {
  return plugins.filter((plugin, index, all) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return all.findIndex((candidate) => {
      const candidateName = Array.isArray(candidate) ? candidate[0] : candidate;
      return candidateName === pluginName;
    }) === index;
  });
}

function shouldAllowCleartextTraffic(): boolean {
  const configuredOrigin = process.env.EXPO_PUBLIC_API_ORIGIN?.trim();

  if (!configuredOrigin) {
    return process.env.NODE_ENV !== 'production';
  }

  return configuredOrigin.startsWith('http://');
}

function withOptionalCleartextPlugin(config: Partial<ExpoConfig>): Partial<ExpoConfig> {
  if (!shouldAllowCleartextTraffic()) {
    return config;
  }

  return {
    ...config,
    plugins: uniquePlugins([
      ...(config.plugins ?? []),
      [
        'expo-location',
        {
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true,
          locationWhenInUsePermission: 'Yakindaki kisileri ve yer bildirimlerini gosterebilmek icin konum kullanilir.',
          locationAlwaysAndWhenInUsePermission: 'Arka planda guvenlik ve varis bildirimleri icin konum kullanilir.',
        },
      ],
      'expo-secure-store',
      'expo-notifications',
      'expo-asset',
      'expo-audio',
      'expo-video',
      './plugins/with-cleartext-traffic',
    ]),
  };
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...withOptionalCleartextPlugin({
    ...config,
    extra: {
      ...config.extra,
      enableDemoLoginHints: process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGIN === 'true',
    },
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSCameraUsageDescription: 'Sesli ve goruntulu aramalar icin kameraya erisim gerekir.',
        NSMicrophoneUsageDescription: 'Sesli ve goruntulu aramalar icin mikrofona erisim gerekir.',
      },
    },
    android: {
      ...config.android,
      permissions: Array.from(
        new Set([
          ...(config.android?.permissions ?? []),
          'CAMERA',
          'RECORD_AUDIO',
          'MODIFY_AUDIO_SETTINGS',
          'FOREGROUND_SERVICE',
          'FOREGROUND_SERVICE_MICROPHONE',
          'FOREGROUND_SERVICE_MEDIA_PROJECTION',
        ]),
      ),
    },
    plugins: uniquePlugins([
      ...(config.plugins ?? []),
      'expo-dev-client',
      [
        'expo-location',
        {
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true,
          locationWhenInUsePermission: 'Yakindaki kisileri ve yer bildirimlerini gosterebilmek icin konum kullanilir.',
          locationAlwaysAndWhenInUsePermission: 'Arka planda guvenlik ve varis bildirimleri icin konum kullanilir.',
        },
      ],
      'expo-secure-store',
      'expo-notifications',
      'expo-asset',
      'expo-audio',
      'expo-video',
      '@config-plugins/react-native-webrtc',
    ]),
  }),
}) as ExpoConfig;
