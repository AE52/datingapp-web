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
      'expo-secure-store',
      './plugins/with-cleartext-traffic',
    ]),
  };
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...withOptionalCleartextPlugin({
    ...config,
    plugins: uniquePlugins([
      ...(config.plugins ?? []),
      'expo-secure-store',
    ]),
  }),
}) as ExpoConfig;
