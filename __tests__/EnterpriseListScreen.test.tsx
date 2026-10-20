/**
 * Регрессия по разделу «Предприятия гильдии» (планшет, шильдик «нет связи»).
 *
 * Пока экран подписывался на ключ `guild:<id>:plants`, а данные запрашивались хуком с ключом
 * `guild:none:plants`, запрос за предприятиями не уходил вовсе: список показывал «У гильдии пока
 * нет предприятий», а refetch-on-focus попадал в ключ без зарегистрированного fetcher — в записи
 * оставалась ошибка kind 'network', и шильдик свежести показывал «нет связи» при рабочем соединении.
 *
 * Тест держит связку: id гильдии из параметров маршрута → ключ слоя → запрос → свежесть на экране.
 * useFocusEffect подменяется на useEffect: в тестовой среде нет навигатора.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { queryKeys } from '../src/data/keys';
import { queryClient } from '../src/data/queryClient';

let mockRouteParams: { guildId: number; guildName: string } = {
  guildId: 12,
  guildName: 'Тестовая гильдия',
};

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    getGuildPlants: jest.fn(async () => [
      {
        id: 5,
        plant_level_id: 1,
        plant_place_id: 1,
        economic_subject_id: 1,
        economic_subject_type: 'Guild',
        plant_level: { level: 2, plant_type: { id: 3, name: 'Лесопилка' } },
        plant_place: { name: 'Место', region_name: 'Регион' },
      },
    ]),
    getGuilds: jest.fn(async () => []),
    deletePlant: jest.fn(async () => ({})),
    getBaseUrl: () => 'http://example.test',
  },
}));

const EnterpriseListScreen = require('../src/screens/PlantWorkshopScreens/EnterpriseListScreen').default;
const PlantList = require('../src/screens/components/PlantList').default;
const ApiService = require('../src/services/api').default;

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

const renderScreen = async (): Promise<ReactTestRenderer> => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<EnterpriseListScreen />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return tree;
};

describe('EnterpriseListScreen («Предприятия гильдии»)', () => {
  beforeEach(() => {
    queryClient.reset();
    jest.clearAllMocks();
    mockRouteParams = { guildId: 12, guildName: 'Тестовая гильдия' };
  });

  afterEach(() => {
    queryClient.reset();
  });

  it('грузит предприятия гильдии по id из параметров маршрута и показывает свежесть', async () => {
    const tree = await renderScreen();

    expect(ApiService.getGuildPlants).toHaveBeenCalledWith(12, expect.anything());
    const entry = queryClient.getEntry(queryKeys.guildPlants(12));
    expect(entry?.error).toBeUndefined();
    expect(entry?.data).toHaveLength(1);

    const texts = textsOf(tree);
    expect(texts).toContain('Лесопилка');
    expect(texts).not.toContain('У гильдии пока нет предприятий');
    expect(texts).not.toContain('нет связи');
    expect(texts.some((text) => text.startsWith('обновлено'))).toBe(true);

    await act(async () => {
      tree.unmount();
    });
  });

  it('при смене гильдии грузит предприятия новой гильдии', async () => {
    const tree = await renderScreen();

    mockRouteParams = { guildId: 7, guildName: 'Другая гильдия' };
    await act(async () => {
      tree.update(<EnterpriseListScreen />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(ApiService.getGuildPlants).toHaveBeenCalledWith(7, expect.anything());
    expect(queryClient.getEntry(queryKeys.guildPlants(7))?.updatedAt).toBeGreaterThan(0);

    await act(async () => {
      tree.unmount();
    });
  });

  it('pull-to-refresh перечитывает предприятия гильдии', async () => {
    const tree = await renderScreen();
    expect(ApiService.getGuildPlants).toHaveBeenCalledTimes(1);

    const list = tree.root.findByType(PlantList);
    await act(async () => {
      await list.props.onRefresh();
    });

    expect(ApiService.getGuildPlants).toHaveBeenCalledTimes(2);
    expect(ApiService.getGuildPlants).toHaveBeenLastCalledWith(12, expect.anything());

    await act(async () => {
      tree.unmount();
    });
  });
});
