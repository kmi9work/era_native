/**
 * Экран «Карта»: рендер на данных бэкенда.
 *
 * Ловит то, чего не видят тесты правил: пустой экран, потерянные ключи слоя
 * данных, падение меток при отсутствии координат. Данные — ответ живого
 * `GET /settlements.json?all=1` и `GET /regions.json` (урезанный).
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { queryClient } from '../src/data/queryClient';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
}));

const settlements = [
  {
    id: 10,
    name: 'Тверь',
    settlement_type_id: 4,
    settlement_type: { id: 4, name: 'Столичная земля' },
    region_id: 20,
    income: 15000,
    map_x: 0.350399,
    map_y: 0.444984,
    fortress_level: 2,
    open_gate: false,
    buildings: [
      { id: 50, building_level_name: 'Крепость', building_level_level: 2 },
    ],
  },
  {
    id: 11,
    name: 'Кашин',
    settlement_type_id: 1,
    settlement_type: { id: 1, name: 'Город' },
    region_id: 20,
    income: 5000,
    map_x: 0.41,
    map_y: 0.47,
    fortress_level: 0,
    open_gate: true,
    buildings: [],
  },
  {
    // Город без координат: на карте его быть не должно
    id: 12,
    name: 'Бездольск',
    settlement_type_id: 1,
    settlement_type: { id: 1, name: 'Город' },
    region_id: 20,
    income: 5000,
    map_x: null,
    map_y: null,
    fortress_level: 0,
    buildings: [],
  },
];

const regions = [
  {
    id: 20,
    name: 'Тверское княжество',
    country_id: 2,
    country: { id: 2, name: 'Тверское княжество' },
    show_overall_po: 3,
  },
  {
    // Отрицательный порядок — число рисуется красным (проверяем в тесте экрана)
    id: 21,
    name: 'Нижегородская земля',
    country_id: 2,
    country: { id: 2, name: 'Тверское княжество' },
    show_overall_po: -5,
  },
];

// Данные для моков держим ВНУТРИ фабрики: jest.mock поднимается выше
// объявлений файла, и внешние const в момент вызова ещё не инициализированы.
jest.mock('../src/services/api', () => {
  const armies = [
    {
      id: 1,
      name: 'Рюрикович',
      owner_type: 'Player',
      owner: { id: 2, name: 'Рюрикович', family: { id: 1, name: 'Рюриковичи' } },
      country_id: 1,
      country: { id: 1, name: 'Москва', short_name: 'Москва' },
      settlement: { id: 10, name: 'Тверь', map_x: 0.350399, map_y: 0.444984 },
      troops: [{ id: 1, troop_type: { id: 1, name: 'Пехота' } }],
    },
    {
      id: 2,
      name: 'Казань',
      owner_type: 'Country',
      owner: { id: 6, name: 'Казанское ханство' },
      country_id: 6,
      country: { id: 6, name: 'Казанское ханство', short_name: 'Казань' },
      settlement: null,
      map_x: 0.7,
      map_y: 0.5,
      troops: [],
    },
  ];
  const troopTypes = [
    { id: 1, name: 'Пехота', params: { buy_cost: [{ identificator: 'meat', count: 50 }] } },
  ];
  const resources = [{ identificator: 'meat', name: 'Мясо' }];
  const countries = [{ id: 1, name: 'Москва', short_name: 'Москва' }];

  return {
    __esModule: true,
    default: {
      getSettlements: jest.fn(async () => settlements),
      getRegions: jest.fn(async () => regions),
      getPlayers: jest.fn(async () => []),
      setSettlementOwner: jest.fn(async () => undefined),
      buildSettlementBuilding: jest.fn(async () => undefined),
      upgradeBuilding: jest.fn(async () => undefined),
      getArmies: jest.fn(async () => armies),
      getTroopTypes: jest.fn(async () => troopTypes),
      getAllResources: jest.fn(async () => resources),
      getCountries: jest.fn(async () => countries),
    },
  };
});

import MapScreen from '../src/screens/MapScreen';
import CityMarker from '../src/screens/map/CityMarker';
import ArmyShield from '../src/screens/map/ArmyShield';
import LandPoLabel from '../src/screens/map/LandPoLabel';
import { MAP_COLORS } from '../src/screens/map/mapStyle';

const collectText = (node: any, acc: string[] = []): string[] => {
  if (node == null) return acc;
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, acc));
    return acc;
  }
  if (node.children) collectText(node.children, acc);
  return acc;
};

const screenTexts = (tree: ReactTestRenderer): string[] =>
  tree.root
    .findAllByType(Text)
    .map((node) => collectText(node.props.children).join(''))
    .filter(Boolean);

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

beforeEach(() => {
  queryClient.reset();
});

describe('экран «Карта»', () => {
  it('рисует шапку, легенду и только размещённые города', async () => {
    const tree = await renderScreen();
    const all = screenTexts(tree).join(' | ');
    expect(all).toContain('Карта');
    expect(all).toContain('Крепость');
    expect(all).toContain('без крепости');
    expect(all).toContain('корона — столица, башня — город');

    const markers = tree.root.findAllByType(CityMarker);
    expect(markers).toHaveLength(2);
    // Город без координат на карту не попадает: ровно две метки — Тверь и Кашин
    expect(markers.map((marker) => marker.props.x).sort((a, b) => a - b)).toEqual([350.399, 410]);
    act(() => tree.unmount());
  });

  it('показывает столицу короной, а город — башней', async () => {
    const tree = await renderScreen();
    const markers = tree.root.findAllByType(CityMarker);
    const capital = markers.find((marker) => marker.props.capital);
    const town = markers.find((marker) => !marker.props.capital);
    expect(capital).toBeTruthy();
    expect(town).toBeTruthy();
    act(() => tree.unmount());
  });

  it('рисует щит каждой армии: в городе — под меткой, в поле — в своей точке', async () => {
    const tree = await renderScreen();
    const shields = tree.root.findAllByType(ArmyShield);
    expect(shields).toHaveLength(2);

    // Армия в Твери: щит ниже метки города (y больше, x тот же)
    const inCity = shields.find((shield) => Math.abs(shield.props.x - 350.399) < 1);
    expect(inCity).toBeTruthy();
    expect(inCity!.props.y).toBeGreaterThan(444.984);

    // Полевая армия стоит ровно в map_x/map_y
    const field = shields.find((shield) => Math.abs(shield.props.x - 700) < 1);
    expect(field).toBeTruthy();
    expect(field!.props.y).toBeCloseTo(500);

    // Легенда объясняет щиты; подписей у армий нет
    const all = screenTexts(tree).join(' | ');
    expect(all).toContain('Армии');
    expect(all).toContain('враг');
    expect(all).toContain('бунт');
    act(() => tree.unmount());
  });

  it('пишет общественный порядок земли у названия и выключается галочкой', async () => {
    const tree = await renderScreen();
    const labels = tree.root.findAllByType(LandPoLabel);
    // Земли с подписью на полотне и с ОП в ответе сервера: Тверская и Нижегородская
    expect(labels.map(label => label.props.value).sort((a, b) => a - b)).toEqual([-5, 3]);

    const all = screenTexts(tree).join(' | ');
    expect(all).toContain('(3)');
    expect(all).toContain('(-5)');

    // Цвет: отрицательный — красный, ноль и выше — зелёный
    const colorOf = (value: number) => {
      const label = labels.find(node => node.props.value === value)!;
      const style = label.findAllByType(Text)[0].props.style;
      const flat = (Array.isArray(style) ? style.flat(Infinity) : [style]) as Array<{
        color?: string;
      }>;
      return flat.filter(item => item && item.color).pop()?.color;
    };
    expect(colorOf(3)).toBe(MAP_COLORS.poPositive);
    expect(colorOf(-5)).toBe(MAP_COLORS.poNegative);

    const toggle = tree.root
      .findAllByType(TouchableOpacity)
      .find(node => node.props.accessibilityLabel === 'Показывать общественный порядок земель');
    expect(toggle).toBeTruthy();
    expect(toggle!.props.accessibilityState).toEqual({ checked: true });

    act(() => toggle!.props.onPress());
    expect(tree.root.findAllByType(LandPoLabel)).toHaveLength(0);
    expect(screenTexts(tree).join(' | ')).not.toContain('(3)');
    act(() => tree.unmount());
  });
});
