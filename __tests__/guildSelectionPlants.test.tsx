/**
 * «Выбор гильдии»: у каждой гильдии видно, сколько предприятий построено и
 * максимум из настроек игры («Служебное → Настройки» на бэкенде).
 * Максимум достигнут — строка помечена «максимум». Правило мягкое: экран
 * только показывает состояние, строить по-прежнему можно (с согласования мастера).
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../src/context/BarcodeScannerContext', () => ({
  useBarcodeScannerContext: () => ({ addListener: () => () => {} }),
}));

const mockGuilds = [
  { id: 1, name: 'Забавники', plants_count: 3, plants_limit: 5 },
  { id: 7, name: 'Кузнецы', plants_count: 5, plants_limit: 5 },
];

jest.mock('../src/screens/hooks/useGuildManagement', () => ({
  useGuildManagement: () => ({
    state: {
      guilds: mockGuilds,
      selectedGuild: null,
      loading: false,
      refreshing: false,
      isOffline: false,
      isStale: false,
      updatedAt: Date.now(),
      error: undefined,
    },
    loadGuilds: jest.fn(),
    selectGuild: jest.fn(),
    clearSelectedGuild: jest.fn(),
  }),
}));

const GuildSelectionScreen = require('../src/screens/PlantWorkshopScreens/GuildSelectionScreen').default;

const collectText = (node: unknown, out: string[] = []): string[] => {
  if (node === null || node === undefined) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, out));
    return out;
  }
  const children = (node as { children?: unknown }).children;
  if (children) collectText(children, out);
  return out;
};

const textsOf = (tree: ReactTestRenderer): string[] => collectText(tree.toJSON());

describe('GuildSelectionScreen («Выберите гильдию»)', () => {
  it('показывает построенные предприятия и максимум, отмечает достигнутый максимум', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<GuildSelectionScreen />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const text = textsOf(tree).join(' ');

    expect(text).toContain('Забавники');
    expect(text).toContain('Предприятий: 3 из 5');
    expect(text).toContain('Кузнецы');
    expect(text).toContain('Предприятий: 5 из 5');
    expect(text).toContain('максимум');

    await act(async () => {
      tree.unmount();
    });
  });
});
