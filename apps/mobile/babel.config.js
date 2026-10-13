module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required by react-native-reanimated v4 (and react-native-worklets).
      // Must be listed last. Without this, worklet-based animations —
      // including Reanimated's `entering`/`exiting` layout animations like
      // FadeInDown/FadeInUp — silently fail to compile, leaving the
      // animated views stuck at their invisible pre-animation state.
      'react-native-worklets/plugin',
    ],
  };
};
