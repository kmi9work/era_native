/**
 * Панель сражений и карточка «на чьей стороне» — интерфейс набора атак с карты.
 *
 * Проверяется то, что мастер видит и нажимает: строки точек, неактивная кнопка
 * «Начать сражения» при неполном бое с объяснением, удаление точки, а в карточке —
 * куда перенесли армию, что уже набрано и какая кнопка какую сторону отдаёт.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AttackSideSheet from '../src/screens/map/AttackSideSheet';
import BattlePlanPanel from '../src/screens/map/BattlePlanPanel';
import { type PlannedBattle, cityTarget, armyTarget } from '../src/screens/map/battlePlan';

const moscowBattle: PlannedBattle = {
  key: 'city:10',
  kind: 'city',
  cityId: 10,
  armyId: null,
  title: 'Москва',
  attackerIds: [1, 2],
  defenderIds: [3, 4, 5],
};

const novgorodBattle: PlannedBattle = {
  key: 'city:11',
  kind: 'city',
  cityId: 11,
  armyId: null,
  title: 'Новгород',
  attackerIds: [6],
  defenderIds: [],
};

/** Текст поддерева: внутри одного Text дети склеиваются без разделителя. */
const collectText = (node: ReactTestRenderer['root'] | any): string =>
  node
    .findAllByType(Text)
    .map((textNode: any) => {
      const children = textNode.props.children;
      const list = Array.isArray(children) ? children : [children];
      return list
        .map((child: unknown) =>
          typeof child === 'string' || typeof child === 'number' ? String(child) : '',
        )
        .join('');
    })
    .join(' | ');

const texts = (tree: ReactTestRenderer): string => collectText(tree.root);

const buttons = (tree: ReactTestRenderer) => tree.root.findAllByType(TouchableOpacity);

const buttonByText = (tree: ReactTestRenderer, label: string) =>
  buttons(tree).find(node => collectText(node).includes(label));

const pressByText = (tree: ReactTestRenderer, label: string) => {
  const button = buttonByText(tree, label);
  if (!button) throw new Error(`кнопка «${label}» не найдена`);
  act(() => button.props.onPress());
};

describe('панель сражений на карте', () => {
  it('перечисляет точки и включает «Начать сражения», когда бои полные', () => {
    const onStart = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <BattlePlanPanel
          plan={[moscowBattle]}
          bottom={16}
          onStart={onStart}
          onClear={jest.fn()}
          onRemove={jest.fn()}
        />,
      );
    });

    const screen = texts(tree);
    expect(screen).toContain('Сражения на карте: 1');
    expect(screen).toContain('армий: 5');
    expect(screen).toContain('Москва');
    expect(screen).toContain('2 в атаку, 3 в защиту');
    expect(screen).not.toContain('не хватает стороны');

    pressByText(tree, 'Начать сражения');
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('не даёт начать, пока в бою нет защищающихся, и говорит почему', () => {
    const onStart = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <BattlePlanPanel
          plan={[moscowBattle, novgorodBattle]}
          bottom={16}
          onStart={onStart}
          onClear={jest.fn()}
          onRemove={jest.fn()}
        />,
      );
    });

    const screen = texts(tree);
    expect(screen).toContain('не хватает стороны');
    expect(screen).toContain('«Новгород»: не хватает защищающихся');

    const start = buttonByText(tree, 'Начать сражения');
    expect(start?.props.disabled).toBe(true);
    // Неактивная кнопка не имеет обработчика: даже нативный «клик» по ней
    // не запустит неполный план.
    expect(start?.props.onPress).toBeUndefined();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('убирает точку и очищает весь план', () => {
    const onRemove = jest.fn();
    const onClear = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <BattlePlanPanel
          plan={[moscowBattle, novgorodBattle]}
          bottom={16}
          onStart={jest.fn()}
          onClear={onClear}
          onRemove={onRemove}
        />,
      );
    });

    const remove = buttons(tree).find(node => node.props.accessibilityLabel?.includes('Убрать сражение'));
    act(() => remove?.props.onPress());
    expect(onRemove).toHaveBeenCalledWith('city:10');

    pressByText(tree, 'Очистить');
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('карточка «на чьей стороне»', () => {
  it('показывает цель, набранное и отдаёт сторону в onPick', () => {
    const onPick = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <AttackSideSheet
          visible
          armyName="Рязань"
          target={cityTarget({ id: 10, name: 'Москва' })}
          current={moscowBattle}
          assignedTo={null}
          onPick={onPick}
          onCancel={jest.fn()}
        />,
      );
    });

    const screen = texts(tree);
    expect(screen).toContain('Армия «Рязань»');
    expect(screen).toContain('Куда: Москва');
    expect(screen).toContain('Уже набрано: 2 в атаку, 3 в защиту');
    expect(screen).toContain('На чьей стороне эта армия?');

    pressByText(tree, 'Нападение');
    pressByText(tree, 'Защита');
    expect(onPick.mock.calls).toEqual([['attacker'], ['defender']]);
  });

  it('предупреждает, что армию перенесут из другого сражения', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <AttackSideSheet
          visible
          armyName="Казань"
          target={armyTarget({ id: 7, name: 'Тверь' })}
          current={null}
          assignedTo={{ title: 'Москва', side: 'defender' }}
          onPick={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
    });

    const screen = texts(tree);
    expect(screen).toContain('Куда: Армия «Тверь»');
    expect(screen).toContain('Сейчас армия в сражении за «Москва» (защита)');
    // Атакованная армия встаёт в защиту — мастер об этом знает заранее.
    expect(screen).toContain('Атакованная армия встанет в защиту');
  });
});
