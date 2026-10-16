/* eslint-env jest */
/**
 * Настройка тестового окружения Jest.
 *
 * Приложение использует нативные модули (gesture-handler, AsyncStorage, screens,
 * safe-area, камера). В Node их нет, поэтому подключаем штатные jest-моки библиотек —
 * иначе __tests__/App.test.tsx падает на инициализации нативных модулей.
 */
require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
