module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Пакеты React Native и React Navigation поставляются как ESM и должны пройти через Babel.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|@react-native-community|@react-navigation|react-native|react-native-.*)/)',
  ],
};
