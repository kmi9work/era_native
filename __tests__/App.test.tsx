/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  jest.useFakeTimers();
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  // Обязательно размонтируем и снимаем таймеры анимаций навигации:
  // без этого колбэки срабатывают уже после завершения тестового окружения
  // и Jest падает с «Cannot read properties of undefined (reading 'clearInteractionHandle')».
  await ReactTestRenderer.act(() => {
    tree?.unmount();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
});
