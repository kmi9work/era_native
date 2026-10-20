module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-worklets-core/plugin',
    // Должен идти последним: worklets-плагин Reanimated 4 обрабатывает
    // useAnimatedStyle/useSharedValue и не терпит других worklet-плагинов после себя.
    'react-native-worklets/plugin',
  ],
};
