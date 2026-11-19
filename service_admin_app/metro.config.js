const { getDefaultConfig } = require('@react-native/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const featureFlagsPath = path.join(
  path.dirname(require.resolve('react-native/package.json')),
  'src',
  'private',
  'featureflags',
  'ReactNativeFeatureFlags.js',
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native/src/private/featureflags/ReactNativeFeatureFlags') {
    return context.resolveRequest(context, featureFlagsPath, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
