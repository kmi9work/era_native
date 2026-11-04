/**
 * Экран «Карта»: рендер на данных бэкенда.
 *
 * Ловит то, чего не видят тесты правил: пустой экран, потерянные ключи слоя
 * данных, падение меток при отсутствии координат. Данные — ответ живого
 * `GET /settlements.json?all=1` и `GET /regions.json` (урезанный).
 */
import React from 'react';
import { Text } from 'react-native';
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
];

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    getSettlements: jest.fn(async () => settlements),
    getRegions: jest.fn(async () => regions),
    getPlayers: jest.fn(async () => []),
    setSettlementOwner: jest.fn(async () => undefined),
    buildSettlementBuilding: jest.fn(async () => undefined),
    upgradeBuilding: jest.fn(async () => undefined),
  },
}));

import MapScreen from '../src/screens/MapScreen';
import CityMarker from '../src/screens/map/CityMarker';

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
});
