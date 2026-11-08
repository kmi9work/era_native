/**
 * Набор отрядов: шаг выбора сразу считает ОБЩУЮ цену (решение заказчика —
 * «максимально просто, в один клик»), шаг подтверждения её повторяет, и только
 * подтверждение отдаёт список отрядов на бэкенд.
 *
 * Цены — те же, что в `db/seeds/4_armies.rb` (`TroopType#params.buy_cost`).
 */
import React from 'react';
import { Image, Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import RecruitSheet from '../src/screens/map/RecruitSheet';
import TroopCost from '../src/screens/map/TroopCost';
import type { MapArmy } from '../src/screens/map/armyLayout';
import type { TroopType } from '../src/types';

const troopTypes: TroopType[] = [
  { id: 1, name: 'Пехота', params: { buy_cost: [{ identificator: 'meat', count: 50 }] } },
  {
    id: 2,
    name: 'Тяжелая пехота',
    params: { buy_cost: [{ identificator: 'metal', count: 20 }, { identificator: 'meat', count: 70 }] },
  },
  {
    id: 3,
    name: 'Кавалерия',
    params: { buy_cost: [{ identificator: 'weapon', count: 5 }, { identificator: 'horses', count: 30 }] },
  },
  { id: 4, name: 'Пушка', params: { buy_cost: [{ identificator: 'tools', count: 30 }] } },
];

const resources = [
  { identificator: 'meat', name: 'Мясо' },
  { identificator: 'metal', name: 'Металл' },
  { identificator: 'weapon', name: 'Оружие' },
  { identificator: 'horses', name: 'Лошади' },
  { identificator: 'tools', name: 'Инструменты' },
];

const makeArmy = (troops: Array<{ id: number; name: string }>): MapArmy =>
  ({
    army: {
      id: 7,
      name: 'Рюрикович',
      troops: troops.map((troop, index) => ({
        id: index + 1,
        troop_type: { id: 1, name: troop.name },
      })),
    },
    x: 0.5,
    y: 0.5,
    inCity: false,
    city: null,
    slot: 0,
    slotCount: 1,
    approximated: false,
    shield: { source: 1 as never, kind: 'family', label: 'родовой щит' },
    troopsCount: troops.length,
  }) as MapArmy;

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

const texts = (tree: ReactTestRenderer): string =>
  tree.root
    .findAllByType(Text)
    .map(node => collectText(node.props.children).join(''))
    .filter(Boolean)
    .join(' | ');

const press = (tree: ReactTestRenderer, label: string) => {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label);
  if (!button) throw new Error(`нет кнопки ${label}`);
  act(() => button.props.onPress());
};

/**
 * Цена на экране — значки ресурсов: у каждого числа своя картинка бэкенда
 * `/images/resources/<identificator>.png`. Возвращаем пары «ресурс: количество»
 * и имена файлов значков ОБЩЕЙ цены (последний TroopCost в дереве).
 */
const summaryCost = (tree: ReactTestRenderer) => {
  const all = tree.root.findAllByType(TroopCost);
  const summary = all[all.length - 1];
  if (!summary) throw new Error('нет блока «Общая цена»');
  const parts = (summary.props.parts as Array<{ name: string; count: number }>).map(
    part => `${part.name}: ${part.count}`,
  );
  const icons = summary
    .findAllByType(Image)
    .map(node => String(node.props.source.uri).split('/').pop());
  return { parts, icons };
};

const render = async (item: MapArmy, onConfirm = jest.fn()): Promise<ReactTestRenderer> => {
  let tree: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <RecruitSheet
        visible
        item={item}
        troopTypes={troopTypes}
        resources={resources}
        busy={false}
        error={null}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );
  });
  return tree!;
};

describe('набор отрядов', () => {
  it('считает общую цену с первого нажатия и рисует её значками ресурсов', async () => {
    const tree = await render(makeArmy([]));
    expect(texts(tree)).toContain('Общая цена');
    // Пока ничего не выбрано — пустая цена, а не «0 мяса»
    expect(summaryCost(tree).parts).toEqual([]);
    expect(texts(tree)).toContain('—');

    press(tree, 'Добавить Тяжелая пехота');
    expect(summaryCost(tree).parts).toEqual(['Металл: 20', 'Мясо: 70']);
    expect(summaryCost(tree).icons).toEqual(['metal.png', 'meat.png']);

    press(tree, 'Добавить Пехота');
    expect(summaryCost(tree).parts).toEqual(['Металл: 20', 'Мясо: 120']);

    press(tree, 'Добавить Кавалерия');
    expect(summaryCost(tree).parts).toEqual([
      'Металл: 20',
      'Мясо: 120',
      'Оружие: 5',
      'Лошади: 30',
    ]);
    expect(summaryCost(tree).icons).toEqual(['metal.png', 'meat.png', 'weapon.png', 'horses.png']);
    // Текстовая цена («20 Металл + …») больше не рисуется
    expect(texts(tree)).not.toContain('20 Металл');
    act(() => tree.unmount());
  });

  it('отдаёт отряды на бэкенд только после подтверждения', async () => {
    const onConfirm = jest.fn();
    const tree = await render(makeArmy([]), onConfirm);

    press(tree, 'Добавить Пехота');
    press(tree, 'Добавить Пушка');
    expect(onConfirm).not.toHaveBeenCalled();

    const confirm = tree.root
      .findAllByType(TouchableOpacity)
      .find(node =>
        node
          .findAllByType(Text)
          .some(label => collectText(label.props.children).join('').includes('Набрать')),
      );
    expect(confirm).toBeTruthy();
    act(() => confirm!.props.onPress());

    const submit = tree.root
      .findAllByType(TouchableOpacity)
      .find(node =>
        node
          .findAllByType(Text)
          .some(label => collectText(label.props.children).join('').includes('Подтвердить набор')),
      );
    expect(submit).toBeTruthy();
    act(() => submit!.props.onPress());
    expect(onConfirm).toHaveBeenCalledWith([1, 4]);
    act(() => tree.unmount());
  });

  it('не даёт взять четвёртый обычный отряд и вторую пушку', async () => {
    // В армии уже три обычных отряда и пушка — свободных мест нет
    const tree = await render(
      makeArmy([
        { id: 1, name: 'Пехота' },
        { id: 2, name: 'Пехота' },
        { id: 3, name: 'Кавалерия' },
        { id: 4, name: 'Пушка' },
      ]),
    );
    expect(texts(tree)).toContain('Свободно: 0 обычных · 0 пушка');
    expect(texts(tree)).toContain('мест нет');
    act(() => tree.unmount());
  });
});
