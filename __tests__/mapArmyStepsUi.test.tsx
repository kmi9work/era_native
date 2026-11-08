/**
 * Шаги армии на экране «Карта»: панель армии, лист «сколько шагов» и
 * предупреждение мастеру, когда шаги кончились.
 *
 * Проверяется весь путь пальцем: тап по щиту → панель с остатком шагов →
 * «Передвинуть» → тап по городу → кнопки 1..максимум → перемещение уходит ОДНИМ
 * запросом вместе с потраченными шагами. Отдельно — армия без шагов: мастер
 * получает предупреждение, но ход всё равно возможен.
 */
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { queryClient } from '../src/data/queryClient';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
}));

const settlements = [
  {
    id: 10,
    name: 'Тверь',
    settlement_type_id: 2,
    region_id: 20,
    income: 15000,
    map_x: 0.35,
    map_y: 0.45,
    fortress_level: 2,
    buildings: [],
  },
];

const regions = [
  { id: 20, name: 'Тверская земля', country_id: 1, country: { id: 1, name: 'Москва' }, show_overall_po: 0 },
];

// Моки держим внутри фабрики: jest.mock поднимается выше объявлений файла.
jest.mock('../src/services/api', () => {
  const armies = [
    {
      id: 1,
      name: 'Рюрикович',
      owner_type: 'Player',
      owner: { id: 2, name: 'Рюрикович', family: { id: 1, name: 'Рюриковичи' } },
      country_id: 1,
      country: { id: 1, name: 'Москва', short_name: 'Москва' },
      settlement: null,
      map_x: 0.7,
      map_y: 0.5,
      // Кавалерия + консервирование: 14 + 4 = 18, потрачено 8
      steps_max: 18,
      steps_spent: 8,
      params: { steps_spent: 8 },
      troops: [{ id: 1, troop_type: { id: 3, name: 'Кавалерия' } }],
    },
    {
      id: 2,
      name: 'Казань',
      owner_type: 'Country',
      owner: { id: 6, name: 'Казанское ханство' },
      country_id: 6,
      country: { id: 6, name: 'Казанское ханство', short_name: 'Казань' },
      settlement: { id: 10, name: 'Тверь', map_x: 0.35, map_y: 0.45 },
      // Шаги кончились: остаток 0
      steps_max: 7,
      steps_spent: 7,
      troops: [{ id: 2, troop_type: { id: 2, name: 'Тяжелая пехота' } }],
    },
  ];
  const troopTypes = [{ id: 3, name: 'Кавалерия', params: { buy_cost: [] } }];
  const resources = [{ identificator: 'meat', name: 'Мясо' }];
  const countries = [{ id: 1, name: 'Москва', short_name: 'Москва' }];

  return {
    __esModule: true,
    default: {
      getSettlements: jest.fn(async () => settlements),
      getRegions: jest.fn(async () => regions),
      getPlayers: jest.fn(async () => []),
      getArmies: jest.fn(async () => armies),
      getTroopTypes: jest.fn(async () => troopTypes),
      getAllResources: jest.fn(async () => resources),
      getCountries: jest.fn(async () => countries),
      moveArmy: jest.fn(async () => armies[0]),
    },
  };
});

import ApiService from '../src/services/api';
import MapScreen from '../src/screens/MapScreen';
import MapCanvas from '../src/screens/map/MapCanvas';
import { clearBattlePlan, setBattlePlan } from '../src/screens/map/battlePlanStore';

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

const screenText = (tree: ReactTestRenderer): string =>
  tree.root
    .findAllByType(Text)
    .map(node => collectText(node.props.children).join(''))
    .join(' | ');

const renderScreen = async (): Promise<ReactTestRenderer> => {
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(<MapScreen />);
  });
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return tree!;
};

/** Тап по карте через настоящее полотно: берём объекты из его же пропсов. */
const tapCanvas = async (
  tree: ReactTestRenderer,
  pick: (canvas: any) => { city?: any; army?: any; x: number; y: number },
) => {
  const canvas = tree.root.findByType(MapCanvas);
  const target = pick(canvas.props);
  await act(async () => {
    canvas.props.onTap({ ...target, city: target.city ?? null, army: target.army ?? null });
  });
};

/**
 * Снять дерево и дождаться фоновых обновлений слоя данных: запросы, запущенные
 * нажатием, живут дольше теста и без ожидания «догоняют» следующий тест
 * (react-test-renderer отдаёт «Can't access .root on unmounted test renderer»).
 */
const unmount = async (tree: ReactTestRenderer) => {
  await act(async () => {
    tree.unmount();
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

/**
 * Нажатие кнопки с ожиданием: обработчики ходят в API и меняют состояние после
 * `await`, поэтому синхронный `act` оставил бы обновление за его пределами.
 */
const pressLabel = async (tree: ReactTestRenderer, label: string) => {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label);
  if (!button) throw new Error(`кнопка с подписью «${label}» не найдена`);
  await act(async () => {
    await button.props.onPress();
  });
};

beforeEach(() => {
  queryClient.reset();
  clearBattlePlan();
  jest.clearAllMocks();
});

describe('шаги армии на карте', () => {
  it('панель армии показывает остаток шагов и предупреждение при нуле', async () => {
    const tree = await renderScreen();

    // Армия «Казань» стоит в Твери и уже потратила все шаги
    await tapCanvas(tree, canvas => ({
      army: canvas.armies.find((item: any) => item.army.id === 2),
      x: 350,
      y: 450,
    }));

    const screen = screenText(tree);
    expect(screen).toContain('осталось 0 из 7');
    expect(screen).toContain('Шаги закончились: по правилам армия не может ходить');

    await unmount(tree);
  });

  it('перемещение спрашивает шаги кнопками 1..максимум и уходит одним запросом', async () => {
    const tree = await renderScreen();

    await tapCanvas(tree, canvas => ({
      army: canvas.armies.find((item: any) => item.army.id === 1),
      x: 700,
      y: 500,
    }));
    expect(screenText(tree)).toContain('осталось 10 из 18');

    await pressLabel(tree, 'Передвинуть');

    // Место выбрано — лист шагов, армия ещё не двигалась
    await tapCanvas(tree, canvas => ({
      city: canvas.cities[0],
      x: 350,
      y: 450,
    }));

    const sheet = screenText(tree);
    expect(sheet).toContain('Куда: город Тверь');
    expect(sheet).toContain('Шагов в году: 18 · потрачено: 8 · осталось: 10');
    expect(sheet).toContain('Сколько шагов потратит армия?');
    // Кнопки от 1 до максимума: 18 штук
    const choices = tree.root
      .findAllByType(TouchableOpacity)
      .filter(node => node.props.accessibilityLabel?.startsWith('Потратить шагов:'));
    expect(choices).toHaveLength(18);
    expect(ApiService.moveArmy).not.toHaveBeenCalled();

    await pressLabel(tree, 'Потратить шагов: 4');

    await act(async () => {
      await Promise.resolve();
    });

    // Один запрос: novo положение + списанные шаги (8 + 4 = 12)
    expect(ApiService.moveArmy).toHaveBeenCalledTimes(1);
    expect(ApiService.moveArmy).toHaveBeenCalledWith(1, {
      settlement_id: 10,
      map_x: null,
      map_y: null,
      steps_spent: 12,
    });

    await unmount(tree);
  });

  it('при старте сражений армии сходятся к точке: атака слева, защита справа, шаги в ноль', async () => {
    const tree = await renderScreen();

    await act(async () => {
      setBattlePlan([
        {
          key: 'city:10',
          kind: 'city',
          cityId: 10,
          armyId: null,
          title: 'Тверь',
          attackerIds: [1],
          defenderIds: [2],
        },
      ]);
    });
    expect(screenText(tree)).toContain('Сражения на карте: 1');

    await pressLabel(tree, 'Начать сражения');

    // Тверь стоит в (0.35, 0.45): атакующий уходит влево, защитник — вправо.
    const calls = (ApiService.moveArmy as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    const byArmy = new Map(calls.map(call => [call[0], call[1]]));
    expect(byArmy.get(1)).toEqual(expect.objectContaining({ settlement_id: null, steps_spent: 18 }));
    expect(byArmy.get(2)).toEqual(expect.objectContaining({ settlement_id: null, steps_spent: 7 }));
    expect((byArmy.get(1) as any).map_x).toBeCloseTo(0.295, 5);
    expect((byArmy.get(2) as any).map_x).toBeCloseTo(0.405, 5);
    expect((byArmy.get(1) as any).map_y).toBeCloseTo(0.45, 5);
    expect((byArmy.get(2) as any).map_y).toBeCloseTo(0.45, 5);

    // После расстановки открывается стол мастера
    expect(mockNavigate).toHaveBeenCalledWith('Battles');

    await unmount(tree);
  });

  it('армию без шагов мастер всё равно может передвинуть — после предупреждения', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const tree = await renderScreen();

    await tapCanvas(tree, canvas => ({
      army: canvas.armies.find((item: any) => item.army.id === 2),
      x: 350,
      y: 450,
    }));
    await pressLabel(tree, 'Передвинуть');

    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Шаги закончились');
    expect(String(message)).toContain('потрачено 7 из 7 шагов');
    // Вторая кнопка предупреждения — «всё равно передвинуть», ход не запрещён
    expect(buttons?.map(button => button.text)).toEqual(['Отмена', 'Всё равно передвинуть']);
    act(() => buttons?.[1].onPress?.());
    expect(screenText(tree)).toContain('Куда передвинуть армию');

    // «Отмена» в листе шагов ничего не меняет на бэкенде
    await tapCanvas(tree, canvas => ({ city: canvas.cities[0], x: 350, y: 450 }));
    expect(screenText(tree)).toContain('У армии закончились шаги');
    await pressLabel(tree, 'Отменить перемещение');
    expect(ApiService.moveArmy).not.toHaveBeenCalled();
    expect(screenText(tree)).not.toContain('Сколько шагов потратит армия?');

    alert.mockRestore();
    await unmount(tree);
  });
});
