/**
 * Настройки: выбор «кто я» на планшете.
 *
 * Сборка видит только импорты — здесь проверяется то, что видит мастер: список
 * пользователей с должностями, отметка выбранного и сохранение выбора, по
 * которому потом приходят персональные уведомления.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../src/services/api';
import SettingsScreen from '../src/screens/SettingsScreen';
import { UserProvider } from '../src/context/UserContext';
import { queryClient } from '../src/data/queryClient';
import { UserSettings } from '../src/services/UserSettings';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

// Шапка настроек рисует индикатор сканера, а он требует BarcodeScannerProvider
// (нативный модуль) — в этом тесте проверяется только блок «Кто я».
jest.mock('../src/components/ScannerStatusBadge', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    getUsers: jest.fn(),
    getNotifications: jest.fn(),
    acknowledgeNotification: jest.fn(),
  },
}));

const getUsers = ApiService.getUsers as jest.Mock;

const collectText = (node: any, acc: string[] = []): string[] => {
  if (node == null) return acc;
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach(child => collectText(child, acc));
    return acc;
  }
  if (node.children) collectText(node.children, acc);
  return acc;
};

const texts = (tree: ReactTestRenderer): string[] =>
  tree.root
    .findAllByType(Text)
    .map(node => collectText(node.props.children).join(''))
    .filter(Boolean);

const flush = () => act(async () => {
  await new Promise<void>((resolve) => setImmediate(() => resolve()));
  await new Promise<void>((resolve) => setImmediate(() => resolve()));
});

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.reset();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.clearAllTimers();
});

describe('настройки: кто я', () => {
  it('перечисляет мастеров с должностями и без выбора говорит, что уведомлений не будет', async () => {
    getUsers.mockResolvedValue([
      { id: 2, name: 'Мастер', job: 'Сражения' },
      { id: 7, name: 'Мастер', job: 'Экономика' },
    ]);

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <UserProvider>
          <SettingsScreen />
        </UserProvider>,
      );
    });
    await flush();

    const screenTexts = texts(tree).join(' | ');
    expect(screenTexts).toContain('Кто я');
    expect(screenTexts).toContain('Мастер не выбран — уведомления приходить не будут');
    expect(screenTexts).toContain('Сражения');
    expect(screenTexts).toContain('Экономика');

    act(() => tree.unmount());
  });

  it('выбранного мастера запоминает на устройстве', async () => {
    getUsers.mockResolvedValue([{ id: 7, name: 'Мастер', job: 'Экономика' }]);

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <UserProvider>
          <SettingsScreen />
        </UserProvider>,
      );
    });
    await flush();

    const row = tree.root
      .findAllByType(TouchableOpacity)
      .find(node =>
        node
          .findAllByType(Text)
          .map(textNode => collectText(textNode.props.children).join(''))
          .join(' ')
          .includes('Экономика'),
      );
    expect(row).toBeDefined();

    await act(async () => {
      row?.props.onPress();
    });
    await flush();

    const stored = await UserSettings.getUser();
    expect(stored).toEqual({ id: 7, name: 'Мастер', job: 'Экономика' });
    expect(texts(tree).join(' | ')).toContain('Уведомления приходят: Мастер (Экономика)');

    act(() => tree.unmount());
  });
});
