/**
 * Плагин many_teams в era_native (п. 0-8).
 *
 * Проверяется то, что видит мастер: надпись «Обработка добычи и переработки
 * предприятий ТОЛЬКО в программе», яркая отметка «строительство и работа
 * запрещены» со списком предприятий, плашка запрета на экране «Улучшение
 * предприятия» и предупреждение о запрете на месте строительства. Данные
 * приходят с бэкенда, клиент их не пересчитывает.
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
    {
      plant_id: 10,
      plant_name: 'Соляная варница',
      extractive: true,
      country_name: 'Москва',
      work_forbidden: true,
    },
    {
      plant_id: 11,
      plant_name: 'Рыбный промысел',
      extractive: true,
      country_name: 'Москва',
      work_forbidden: true,
    },
    {
      plant_id: 12,
      plant_name: 'Кузница',
      extractive: false,
      country_name: 'Великий Новгород',
      work_forbidden: false,
    },
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
import PlantWorkNotice from '../src/plugins/game-plugins/many_teams/components/PlantWorkNotice';
import PlaceBuildNotice from '../src/screens/components/PlaceBuildNotice';

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

const renderWithData = async (element: React.ReactElement): Promise<ReactTestRenderer> => {
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    });
  }
  return tree!;
};

const renderOverlay = (): Promise<ReactTestRenderer> => renderWithData(<ManyTeamsOverlay guildIds={[1]} />);

describe('плагин many_teams', () => {
  it('показывает надпись для мастеров и отметку «строительство и работа запрещены»', async () => {
    const tree = await renderOverlay();
    const text = collectText(tree.toJSON()).join(' | ');

    expect(ApiService.get).toHaveBeenCalledWith('/many_teams/guilds/1/workshop', expect.anything());

    // п. 8 — надпись для мастеров
    expect(text).toContain('ТОЛЬКО в программе');

    // п. 6 — яркая отметка с названиями предприятий, где запрещены стройка и работа
    expect(text).toContain('СТРОИТЕЛЬСТВО И РАБОТА ЗАПРЕЩЕНЫ');
    expect(text).toContain('Забавники');
    expect(text).toContain('Соляная варница');
    expect(text).toContain('Рыбный промысел');

    // предприятие без запрета в отметку не попадает
    expect(text).not.toContain('Кузница');

    await act(async () => {
      tree.unmount();
    });
  });

  it('без запретов показывает только надпись для мастеров', async () => {
    (ApiService.get as jest.Mock).mockResolvedValueOnce({
      ...workshop,
      plants: workshop.plants.map((plant) => ({ ...plant, work_forbidden: false })),
      forbidden_plant_ids: [],
    });

    const tree = await renderOverlay();
    const text = collectText(tree.toJSON()).join(' | ');

    expect(text).toContain('ТОЛЬКО в программе');
    expect(text).not.toContain('СТРОИТЕЛЬСТВО И РАБОТА ЗАПРЕЩЕНЫ');

    await act(async () => {
      tree.unmount();
    });
  });

  it('п. 5: на «Улучшении предприятия» плашка называет государство запрета', async () => {
    const tree = await renderWithData(
      <PlantWorkNotice plant={{ id: 10, economic_subject_type: 'Guild', economic_subject_id: 1 }} />,
    );
    const text = collectText(tree.toJSON()).join(' | ');

    expect(text).toContain('РАБОТА И СТРОИТЕЛЬСТВО ЗАПРЕЩЕНЫ');
    expect(text).toContain('Москва');
    expect(text).toContain('решение принимает ведущий');

    await act(async () => {
      tree.unmount();
    });
  });

  it('п. 5: для предприятия без запрета плашки нет', async () => {
    const tree = await renderWithData(
      <PlantWorkNotice plant={{ id: 12, economic_subject_type: 'Guild', economic_subject_id: 1 }} />,
    );

    expect(collectText(tree.toJSON()).join(' | ')).not.toContain('ЗАПРЕЩЕНЫ');

    await act(async () => {
      tree.unmount();
    });
  });
});

describe('предупреждение о запрете строительства (п. 4)', () => {
  const renderNotice = (element: React.ReactElement) => renderWithData(element);

  it('называет государство, если бэкенд прислал country_name', async () => {
    const tree = await renderNotice(
      <PlaceBuildNotice place={{ allowed: false, country_name: 'Москва' }} guildName="Забавники" />,
    );
    const text = collectText(tree.toJSON()).join(' | ');

    expect(text).toContain('Москва');
    expect(text).toContain('Забавники');
    expect(text).toContain('построить можно');

    await act(async () => {
      tree.unmount();
    });
  });

  it('в базовой игре (без country_name) не упоминает Русь', async () => {
    const tree = await renderNotice(<PlaceBuildNotice place={{ allowed: false }} />);
    const text = collectText(tree.toJSON()).join(' | ');

    expect(text).toContain('запрещено правилами');
    expect(text).not.toContain('Руси');

    await act(async () => {
      tree.unmount();
    });
  });

  it('для разрешённого места ничего не рисует', async () => {
    const tree = await renderNotice(<PlaceBuildNotice place={{ allowed: true, country_name: 'Москва' }} />);

    expect(tree.toJSON()).toBeNull();

    await act(async () => {
      tree.unmount();
    });
  });
});
