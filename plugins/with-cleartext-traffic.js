const { createRunOncePlugin, withAndroidManifest } = require('@expo/config-plugins');

function withCleartextTraffic(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];

    if (application?.$) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }

    return modConfig;
  });
}

module.exports = createRunOncePlugin(withCleartextTraffic, 'with-cleartext-traffic', '1.0.0');
