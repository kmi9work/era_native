/**
 * Пробник экрана «Сражения»: экран реально рендерится на данных бэкенда и
 * проходит шаги мастера (место → армии → баффы → бой).
 *
 * Ловит то, чего не видит ни сборка, ни тесты правил: пустой экран, потерянные
 * ключи слоя данных, ошибки рендера карточек и переходов. Данные — урезанный
 * ответ живого бэкенда (`/armies.json`, `/countries.json`, `/settlements.json?all=1`,
 * `/regions.json`).
 */
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { queryClient } from '../src/data/queryClient';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
}));

const armies = [
  {
    id: 1,
    name: 'Вологские',
    owner_type: 'Player',
    owner: { id: 6, name: 'Волоцкий' },
    settlement: { id: 1, name: 'Коломна', region_id: 20 },
    troops: [
      { id: 70, troop_type: { id: 3, name: 'Кавалерия' } },
      { id: 71, troop_type: { id: 1, name: 'Пехота' } },
    ],
  },
  {
    id: 2,
    name: 'Тверь',
    owner_type: 'Country',
    owner: { id: 2, name: 'Тверь' },
    settlement: { id: 10, name: 'Тверь', region_id: 20 },
    troops: [
      { id: 80, troop_type: { id: 2, name: 'Тяжелая пехота' } },
      { id: 81, troop_type: { id: 4, name: 'Пушка' } },
    ],
  },
];

const settlements = [
  {
    id: 10,
    name: 'Тверь',
    settlement_type_id: 2,
    settlement_type: { id: 2, name: 'Столица' },
    region_id: 20,
    buildings: [{ id: 1, building_type_name: 'Кремль', building_level_level: 2 }],
  },
];

const regions = [
  { id: 20, name: 'Тверская земля', country_id: 2, country: { id: 2, name: 'Тверь' } },
];

// Все страны игры: Руси в регионах нет, но в выборе места она быть обязана.
const countries = [
  { id: 1, name: 'Русь' },
  { id: 2, name: 'Тверь' },
  { id: 6, name: 'Казанское ханство' },
];

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    getArmies: jest.fn(async () => armies),
    getSettlements: jest.fn(async () => settlements),
    getRegions: jest.fn(async () => regions),
    getCountries: jest.fn(async () => countries),
    deleteArmy: jest.fn(async () => undefined),
    captureRegion: jest.fn(async () => undefined),
  },
}));

import BattlesScreen from '../src/screens/BattlesScreen';

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

const screenTexts = (tree: ReactTestRenderer): string[] =>
  tree.root
    .findAllByType(Text)
    .map(node => collectText(node.props.children).join(''))
    .filter(text => text.length > 0);

const press = (tree: ReactTestRenderer, label: string, last = false) => {
  const touchables = tree.root.findAllByType(TouchableOpacity);
  const withText = touchables
    .map(node => ({
      node,
      text: node
        .findAllByType(Text)
        .flatMap(textNode => collectText(textNode.props.children))
        .join('')
        .trim(),
    }))
    .filter(item => item.text.includes(label));
  const exact = withText.find(item => item.text === label);
  const sorted = withText.sort((a, b) => a.text.length - b.text.length);
  const target = last ? sorted[sorted.length - 1] : exact || sorted[0];

  if (!target) throw new Error(`Кнопка «${label}» не найдена`);
  act(() => {
    target.node.props.onPress();
  });
};

const isDisabled = (tree: ReactTestRenderer, label: string): boolean => {
  const node = tree.root
    .findAllByType(TouchableOpacity)
    .find(item =>
      item
        .findAllByType(Text)
        .flatMap(textNode => collectText(textNode.props.children))
        .join('')
        .includes(label),
    );
  if (!node) throw new Error(`Кнопка «${label}» не найдена`);
  return node.props.disabled === true;
};

const renderScreen = async (): Promise<ReactTestRenderer> => {
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(<BattlesScreen />);
  });
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return tree!;
};

describe('экран «Сражения»', () => {
  beforeEach(() => {
    queryClient.reset();
  });

  it('проходит шаги: город → армии → баффы → бой', async () => {
    const tree = await renderScreen();

    expect(screenTexts(tree)).toEqual(expect.arrayContaining(['Сражения', 'В поле', 'За город']));

    press(tree, 'За город');
    // Страны берутся из /countries.json: в регионах только Тверь, а Русь и Казанское
    // ханство всё равно должны быть в списке.
    expect(screenTexts(tree)).toEqual(expect.arrayContaining(['Русь', 'Тверь', 'Казанское ханство']));

    press(tree, 'Тверь');
    expect(screenTexts(tree)).toEqual(expect.arrayContaining(['Столица · есть крепость']));

    press(tree, 'Столица · есть крепость');
    expect(screenTexts(tree)).toEqual(
      expect.arrayContaining(['Крепость: 2 уровень', 'Столица государства']),
    );

    press(tree, 'К армиям');
    expect(screenTexts(tree)).toEqual(
      expect.arrayContaining(['Атакующие армии', 'Защищающиеся армии']),
    );
    // За городом защитник уже есть: гарнизон города с одной пехотой.
    expect(screenTexts(tree)).toEqual(
      expect.arrayContaining(['Гарнизон (Тверь)', 'Пехота (город)']),
    );
    // Защитник есть, нападающего нет — дальше не пускаем.
    expect(isDisabled(tree, 'К баффам')).toBe(true);

    // Добавляем атакующую армию из списка: в списке нажимаем строку с названием
    // армии (нажатие «+» попало бы в первую строку списка).
    press(tree, 'Выбрать армию (2)');
    press(tree, 'Вологские');
    expect(screenTexts(tree)).toEqual(expect.arrayContaining(['Вологские', 'Волоцкий · Атакующие']));
    // Бой «один город против одной армии» возможен без выбора защищающейся армии.
    expect(isDisabled(tree, 'К баффам')).toBe(false);

    press(tree, 'Выбрать армию (1)', true);
    press(tree, 'Тверь', true);
    expect(screenTexts(tree)).toEqual(expect.arrayContaining(['Тверь · Защищающиеся']));

    press(tree, 'К баффам');
    expect(screenTexts(tree)).toContain('Баффы и дебаффы армий');

    press(tree, 'Начать бой');
    expect(screenTexts(tree)).toEqual(expect.arrayContaining(['Раунд 1', 'Атакующие', 'Защищающиеся']));

    // Город добавил пехоту защищающимся: на сцене фишка с подписью «Пехота (город)».
    expect(screenTexts(tree)).toContain('Пехота (город)');
    // Сцена вместо таблицы: фишка пушки помечена как не участвующая в бросках.
    const tokenLabels = tree.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => String(node.props.accessibilityLabel));
    expect(
      tokenLabels.some(label => label.includes('Пушка') && label.includes('не участвует в бою')),
    ).toBe(true);
    // Управление боем: один жест на раунд, состав и скорость показа.
    expect(screenTexts(tree)).toEqual(
      expect.arrayContaining(['Ход', 'Состав', 'x1', 'x2']),
    );

    // Бой идёт на весь экран: шапка экрана «Сражения» на этом шаге скрыта,
    // иначе сцена висела бы под синей полосой вместо всего экрана.
    expect(screenTexts(tree)).not.toContain('Сражения');

    // Вернуться к баффам можно из табло — шапки, где была стрелка, больше нет.
    const backToBuffs = tree.root
      .findAll(node => node.props?.accessibilityLabel === 'Вернуться к баффам')
      .find(node => typeof node.props?.onPress === 'function');
    expect(backToBuffs).toBeTruthy();
    act(() => {
      backToBuffs!.props.onPress();
    });
    expect(screenTexts(tree)).toContain('Баффы и дебаффы армий');
    expect(screenTexts(tree)).toContain('Сражения');

    act(() => {
      tree.unmount();
    });
  });
});
