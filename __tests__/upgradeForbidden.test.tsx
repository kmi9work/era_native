/**
 * Правило «Сельские школы» на экране «Улучшение предприятия» (era_native).
 *
 * Правило игры: улучшать предприятия можно только в государстве, где открыта
 * технология «Сельские школы» (dizdoc). Сервер улучшение не блокирует, поэтому
 * клиент показывает «Запрещено» и предупреждение, но мастер может улучшить
 * предприятие в обход — третий вариант в окне предупреждения.
 *
 * Тест держит три вещи, которые легко сломать незаметно:
 *  1) статус технологии запрашивается для государства ЗЕМЕЛЬ предприятия
 *     (`/technologies.json?country_id=`), а не для текущего государства;
 *  2) при закрытой технологии кнопка подписана «Запрещено» и остаётся нажимаемой;
 *  3) «Всё равно улучшить» действительно отправляет PATCH .../upgrade.
 */
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { queryClient } from '../src/data/queryClient';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { plantId: 1 } }),
}));

jest.mock('../src/services/api', () => {
  // Государство земель предприятия — Москва (id 1).
  const plant = {
    id: 1,
    plant_level_id: 1,
    plant_place_id: 1,
    economic_subject_id: 1,
    economic_subject_type: 'Guild',
    economic_subject: { id: 1, name: 'Забавники' },
    plant_level: {
      level: 1,
      plant_type: {
        id: 5,
        name: 'Делянка',
        plant_category: { id: 1, name: 'Добывающее', is_extractive: true },
      },
      formulas: [],
    },
    plant_place: {
      id: 1,
      name: 'Место',
      region_id: 1,
      region_name: 'Великое Московское княжество',
      region_country_id: 1,
      region_country_name: 'Москва',
    },
  };

  const levels = [
    { id: 1, level: 1, plant_type: { id: 5 }, formulas: [], price: null },
    { id: 2, level: 2, plant_type: { id: 5 }, formulas: [], price: { timber: 5 } },
  ];

  // «Сельские школы» закрыты (is_open 0) — как на живом бэкенде по умолчанию.
  const technologies = [
    { id: 1, name: 'Сельские школы', description: 'Доступ к развитию предприятий', is_open: 0 },
    { id: 4, name: 'Технические училища', description: 'Производство +50%', is_open: 0 },
  ];

  return {
    __esModule: true,
    default: {
      getPlant: jest.fn(async () => plant),
      getCountryTechnologies: jest.fn(async () => technologies),
      getTechnologies: jest.fn(async () => technologies),
      getAllPlantLevels: jest.fn(async () => levels),
      getAllResources: jest.fn(async () => []),
      getGuilds: jest.fn(async () => [{ id: 1, name: 'Забавники' }]),
      upgradePlant: jest.fn(async () => ({ success: true, msg: 'Улучшено' })),
      downgradePlant: jest.fn(async () => ({})),
      getBaseUrl: () => 'http://example.test',
    },
  };
});

import ApiService from '../src/services/api';

const UpgradeConfirmScreen =
  require('../src/screens/PlantWorkshopScreens/UpgradeConfirmScreen').default;

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

const renderScreen = async (): Promise<ReactTestRenderer> => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<UpgradeConfirmScreen />);
  });
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    });
  }
  return tree;
};

/** Кнопка нижней панели по её надписи. */
const findButton = (tree: ReactTestRenderer, label: string) => {
  const button = tree.root.findAllByType(TouchableOpacity).find((node) => {
    const texts = node.findAllByType(Text).map((textNode) => collectText(textNode.props.children).join(''));
    return texts.some((text) => text === label);
  });
  if (!button) {
    throw new Error(`Кнопка «${label}» не найдена`);
  }
  return button;
};

describe('«Сельские школы» и улучшение предприятия', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    queryClient.reset();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    queryClient.reset();
  });

  it('запрашивает статус технологии для государства земель предприятия', async () => {
    const tree = await renderScreen();

    expect(ApiService.getCountryTechnologies).toHaveBeenCalledWith(1, expect.anything());

    await act(async () => {
      tree.unmount();
    });
  });

  it('при закрытой технологии кнопка подписана «Запрещено» и остаётся нажимаемой', async () => {
    const tree = await renderScreen();
    const texts = collectText(tree.toJSON());

    expect(texts).toContain('Запрещено');
    expect(texts).not.toContain('Улучшить');

    const button = findButton(tree, 'Запрещено');
    expect(button.props.disabled).toBe(false);

    await act(async () => {
      tree.unmount();
    });
  });

  it('по нажатию предупреждает и называет технологию и государство', async () => {
    const tree = await renderScreen();

    await act(async () => {
      findButton(tree, 'Запрещено').props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Улучшение запрещено');
    expect(String(message)).toContain('«Сельские школы»');
    expect(String(message)).toContain('«Москва»');
    expect(Array.isArray(buttons)).toBe(true);
    expect(buttons.map((button: { text: string }) => button.text)).toEqual([
      'Отмена',
      'Всё равно улучшить',
    ]);

    await act(async () => {
      tree.unmount();
    });
  });

  it('«Всё равно улучшить» отправляет улучшение на сервер', async () => {
    const tree = await renderScreen();

    await act(async () => {
      findButton(tree, 'Запрещено').props.onPress();
    });
    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const forceUpgrade = buttons.find((button) => button.text === 'Всё равно улучшить');

    await act(async () => {
      forceUpgrade?.onPress?.();
    });

    expect(ApiService.upgradePlant).toHaveBeenCalledWith(1);

    await act(async () => {
      tree.unmount();
    });
  });

  it('при открытой технологии кнопка обычная и предупреждения нет', async () => {
    (ApiService.getCountryTechnologies as jest.Mock).mockResolvedValueOnce([
      { id: 1, name: 'Сельские школы', description: 'Доступ к развитию предприятий', is_open: 1 },
    ]);

    const tree = await renderScreen();
    const texts = collectText(tree.toJSON());

    expect(texts).toContain('Улучшить');
    expect(texts).not.toContain('Запрещено');

    await act(async () => {
      findButton(tree, 'Улучшить').props.onPress();
    });
    expect(alertSpy).not.toHaveBeenCalledWith('Улучшение запрещено', expect.anything(), expect.anything());

    await act(async () => {
      tree.unmount();
    });
  });
});
