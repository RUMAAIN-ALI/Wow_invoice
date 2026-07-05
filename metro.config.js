const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve and bundle .wasm files (required by expo-sqlite web)
config.resolver.assetExts.push('wasm');

module.exports = config;
