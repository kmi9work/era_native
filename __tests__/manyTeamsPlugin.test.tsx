/**
 * Плагин many_teams в era_native (п. 6 и п. 8).
 *
 * Проверяется то, что видит мастер на экране цеха: надпись «Обработка добычи и
 * переработки предприятий ТОЛЬКО в программе» и яркая отметка «добыча
 * запрещена» со списком предприятий. Данные приходят с бэкенда
 * (`GET /many_teams/guilds/:id/workshop`), клиент их не пересчитывает.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
}));

const workshop = {
  notice: 'Обработка добычи и переработки предприятий ТОЛЬКО в программе',
  guild: { id: 1, name: 'Забавники' },
  countries: [],
  plants: [
    { plant_id: 10, plant_name: 'Соляная варница', extractive: true, extraction_forbidden: true },
    { plant_id: 11, plant_name: 'Рыбный промысел', extractive: true, extraction_forbidden: true },
    { plant_id: 12, plant_name: 'Кузница', extractive: false, extraction_forbidden: false },
  ],
  forbidden_plant_ids: [10, 11],
  embargoes: [],
};

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(async () => workshop) },
}));

import ApiService from '../src/services/api';
import ManyTeamsOverlay from '../src/plugins/game-plugins/many_teams/components/ManyTeamsOverlay';

const collectText = (node: any, acc: string[] = []): string[] => {
  if (node == null) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, acc));
    return acc;
  }
  if (node.children) collectText(node.children, acc);
  return acc;
};

const renderOverlay = async (): Promise<ReactTestRenderer> => {
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(<ManyTeamsOverlay guildIds={[1]} />);
  });
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    });
  }
  return tree!;
};

describe('плагин many_teams', () => {
  it('показывает надпись для мастеров и отметку «добыча запрещена»', async () => {
    const tree = await renderOverlay();
    const text = collectText(tree.toJSON()).join(' | ');

    expect(ApiService.get).toHaveBeenCalledWith('/many_teams/guilds/1/workshop', expect.anything());

    // п. 8 — надпись для мастеров
    expect(text).toContain('ТОЛЬКО в программе');

    // п. 6 — яркая отметка с названиями предприятий, где добыча запрещена
    expect(text).toContain('ДОБЫЧА ЗАПРЕЩЕНА');
    expect(text).toContain('Забавники');
    expect(text).toContain('Соляная варница');
    expect(text).toContain('Рыбный промысел');

    // предприятие без запрета в отметку не попадает
    expect(text).not.toContain('Кузница');

    // Размонтируем: хук опрашивает бэкенд, иначе остаётся живой таймер.
    await act(async () => {
      tree.unmount();
    });
  });

  it('без запретов показывает только надпись для мастеров', async () => {
    (ApiService.get as jest.Mock).mockResolvedValueOnce({
      ...workshop,
      plants: workshop.plants.map((plant) => ({ ...plant, extraction_forbidden: false })),
      forbidden_plant_ids: [],
    });

    const tree = await renderOverlay();
    const text = collectText(tree.toJSON()).join(' | ');

    expect(text).toContain('ТОЛЬКО в программе');
    expect(text).not.toContain('ДОБЫЧА ЗАПРЕЩЕНА');

    await act(async () => {
      tree.unmount();
    });
  });
});
