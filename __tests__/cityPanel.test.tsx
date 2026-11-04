/**
 * Панель города: данные поселения и действия мастера.
 * Проверяем то, что видит мастер: строки сведений, список построек, смену
 * владельца через диалог и кнопку улучшения крепости.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import CityPanel from '../src/screens/map/CityPanel';
import type { MapCity } from '../src/screens/map/types';
import type { Player } from '../src/types';

const players: Player[] = [
  { id: 6, name: 'Волоцкий', identificator: 'volockiy', jobs: [], country: { id: 1, name: 'Москва' } },
  { id: 7, name: 'Твердислав', identificator: 'tverdislav', jobs: [], country: { id: 2, name: 'Тверь' } },
];

const city: MapCity = {
  id: 10,
  name: 'Тверь',
  x: 0.35,
  y: 0.44,
  fortress: 2,
  capital: true,
  country: { id: 2, name: 'Тверское княжество' },
  region: {
    id: 20,
    name: 'Тверское княжество',
    country_id: 2,
    country: { id: 2, name: 'Тверское княжество' },
    show_overall_po: 4,
  },
  settlement: {
    id: 10,
    name: 'Тверь',
    settlement_type_id: 4,
    settlement_type: { id: 4, name: 'Столичная земля' },
    region_id: 20,
    income: 15000,
    fortress_level: 2,
    open_gate: false,
    player: { id: 7, name: 'Твердислав', identificator: 'tverdislav', jobs: [] },
    buildings: [
      {
        id: 50,
        building_type_name: 'Кремль',
        building_level_level: 2,
        building_level_name: 'Крепость',
        building_level: { level: 2, building_type: { id: 2, name: 'Кремль' } },
      },
      {
        id: 51,
        building_type_name: 'Рынок',
        building_level_level: 1,
        building_level_name: 'Базар',
        building_level: { level: 1, building_type: { id: 3, name: 'Рынок' } },
      },
    ],
  },
};

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

const texts = (tree: ReactTestRenderer): string[] =>
  tree.root
    .findAllByType(Text)
    .map((node) => collectText(node.props.children).join(''))
    .filter(Boolean);

const press = (tree: ReactTestRenderer, label: string) => {
  // В модальном окне подложка тоже TouchableOpacity и содержит текст всех строк —
  // берём самую короткую подпись, то есть саму кнопку.
  const candidates = tree.root
    .findAllByType(TouchableOpacity)
    .map((node) => ({
      node,
      text: node
        .findAllByType(Text)
        .flatMap((textNode) => collectText(textNode.props.children))
        .join(''),
    }))
    .filter((item) => item.text.includes(label))
    .sort((a, b) => a.text.length - b.text.length);
  if (candidates.length === 0) throw new Error(`Кнопка «${label}» не найдена`);
  act(() => {
    candidates[0].node.props.onPress();
  });
};

const renderPanel = async (patch: Partial<MapCity> = {}): Promise<ReactTestRenderer> => {
  let tree: ReactTestRenderer;
  const props = {
    city: { ...city, ...patch },
    players,
    busy: false,
    error: null,
    side: 'right' as const,
    onClose: jest.fn(),
    onSetOwner: jest.fn(),
    onBuildFortress: jest.fn(),
    onUpgradeFortress: jest.fn(),
  };
  await act(async () => {
    tree = create(<CityPanel {...props} />);
  });
  return tree!;
};

describe('панель города', () => {
  it('показывает название, тип, государство, землю и владельца', async () => {
    const tree = await renderPanel();
    const all = texts(tree).join(' | ');
    expect(all).toContain('Тверь');
    expect(all).toContain('столица');
    expect(all).toContain('крепость 2 ур.');
    expect(all).toContain('Тверское княжество');
    expect(all).toContain('Твердислав');
    expect(all).toContain('15');
    expect(all).toContain('закрыты');
  });

  it('перечисляет постройки с уровнями', async () => {
    const tree = await renderPanel();
    const all = texts(tree).join(' | ');
    expect(all).toContain('Крепость');
    expect(all).toContain('2 ур.');
    expect(all).toContain('Базар');
    expect(all).toContain('1 ур.');
  });

  it('даёт сменить владельца: диалог со списком игроков', async () => {
    const onSetOwner = jest.fn();
    let tree: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <CityPanel
          city={city}
          players={players}
          busy={false}
          side="right"
          onClose={jest.fn()}
          onSetOwner={onSetOwner}
          onBuildFortress={jest.fn()}
          onUpgradeFortress={jest.fn()}
        />,
      );
    });
    press(tree!, 'Сменить владельца');
    const all = texts(tree!).join(' | ');
    expect(all).toContain('Снять владельца');
    expect(all).toContain('Твердислав');
    press(tree!, 'Твердислав');
    expect(onSetOwner).toHaveBeenCalledWith(7);
  });

  it('предлагает улучшение крепости до следующего уровня', async () => {
    const onUpgrade = jest.fn();
    let tree: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <CityPanel
          city={city}
          players={players}
          busy={false}
          side="right"
          onClose={jest.fn()}
          onSetOwner={jest.fn()}
          onBuildFortress={jest.fn()}
          onUpgradeFortress={onUpgrade}
        />,
      );
    });
    press(tree!, 'Улучшить крепость (до 3 ур.)');
    expect(onUpgrade).toHaveBeenCalled();
  });

  it('без крепости предлагает постройку, а на третьем уровне — ничего', async () => {
    const build = jest.fn();
    let tree: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <CityPanel
          city={{ ...city, fortress: 0, settlement: { ...city.settlement, buildings: [] } }}
          players={players}
          busy={false}
          side="right"
          onClose={jest.fn()}
          onSetOwner={jest.fn()}
          onBuildFortress={build}
          onUpgradeFortress={jest.fn()}
        />,
      );
    });
    press(tree!, 'Построить крепость (1 ур.)');
    expect(build).toHaveBeenCalled();

    const maxTree = await renderPanel({ fortress: 3 });
    expect(texts(maxTree).join(' | ')).toContain('Кремль — максимальный уровень');
  });
});
