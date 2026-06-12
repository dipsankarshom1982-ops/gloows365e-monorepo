const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Shim assert v2 — its internal/errors dependency can't be resolved by Metro on Windows
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  assert: path.resolve(__dirname, 'shims/assert.js'),
};

module.exports = config;
