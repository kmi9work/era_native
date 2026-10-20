/**
 * Итог боя: блок присоединения региона (`battles/components/OutcomePanel.tsx`).
 *
 * Сборка и тесты хука видят состояние, но не текст и не обработчики панели.
 * Здесь панель рендерится с подставным `logic` и проверяется то, что видит мастер:
 * победитель, выбор страны при союзниках, кнопка передачи региона и результат.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import OutcomePanel from '../src/screens/battles/components/OutcomePanel';
import type { BattleLogic } from '../src/screens/hooks/useBattleLogic';

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

const texts = (tree: ReactTestRenderer): string[] =>
  tree.root
    .findAllByType(Text)
    .map(node => collectText(node.props.children).join(''))
    .filter(Boolean);

const press = (tree: ReactTestRenderer, label: string) => {
  const target = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(Text)
        .flatMap(textNode => collectText(textNode.props.children))
        .join('')
        .includes(label),
    );
  if (!target) throw new Error(`Кнопка «${label}» не найдена`);
  act(() => {
    target.props.onPress();
  });
};

const makeLogic = (overrides: Record<string, any> = {}): BattleLogic => {
  const base: any = {
    outcome: 'defenders_destroyed',
    outcomeConfirmed: true,
    armiesToDestroy: [],
    deletedArmyIds: [],
    deleteError: null,
    busy: false,
    cityCaptureNote: null,
    annexation: {
      regionId: 20,
      regionName: 'Тверская земля',
      defendingCountryId: 2,
      defendingCountryName: 'Тверь',
      capitalName: 'Тверь',
      attackerCountries: [{ id: 1, name: 'Русь' }],
      remainingArmyCount: 0,
    },
    annexationChoice: null,
    annexationTarget: 1,
    annexationResult: null,
    annexationDone: false,
    annexationBusy: false,
    annexationError: null,
    confirmAnnexation: jest.fn(async () => 1),
    setAnnexationChoice: jest.fn(),
    countryName: (id: number | null) => ({ 1: 'Русь', 6: 'Казанское ханство' }[id as 1] || '—'),
    resetAll: jest.fn(),
    goBack: jest.fn(),
  };
  return { ...base, ...overrides } as BattleLogic;
};

const render = (logic: BattleLogic): ReactTestRenderer => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(<OutcomePanel logic={logic} />);
  });
  return tree!;
};

describe('итог боя: присоединение региона', () => {
  it('одного победителя показывает без выбора и передаёт регион по кнопке', () => {
    const logic = makeLogic();
    const tree = render(logic);

    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Столица Тверь взята',
        'Государство Тверь. Регион Тверская земля можно присоединить к победителю.',
        'Победитель: Русь',
        'Присоединить регион',
      ]),
    );
    // Чипов выбора нет: победитель один.
    expect(texts(tree)).not.toContain('Казанское ханство');

    press(tree, 'Присоединить регион');
    expect(logic.confirmAnnexation).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  it('при союзниках требует выбрать страну и показывает чипы', () => {
    const logic = makeLogic({
      annexationTarget: null,
      annexation: {
        regionId: 20,
        regionName: 'Тверская земля',
        defendingCountryId: 2,
        defendingCountryName: 'Тверь',
        capitalName: 'Тверь',
        attackerCountries: [
          { id: 1, name: 'Русь' },
          { id: 6, name: 'Казанское ханство' },
        ],
        remainingArmyCount: 2,
      },
    });
    const tree = render(logic);

    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Воевали союзники — выберите, кому присоединить регион:',
        'У государства осталось армий: 2. По правилам это оккупация — присоединение региона подтверждает мастер.',
      ]),
    );

    // Пока страна не выбрана, кнопка не работает.
    const button = tree.root
      .findAllByType(TouchableOpacity)
      .find(node =>
        node
          .findAllByType(Text)
          .flatMap(textNode => collectText(textNode.props.children))
          .join('')
          .includes('Присоединить регион'),
      );
    expect(button?.props.disabled).toBe(true);

    press(tree, 'Казанское ханство');
    expect(logic.setAnnexationChoice).toHaveBeenCalledWith(6);

    act(() => {
      tree.unmount();
    });
  });

  it('после передачи показывает новое государство региона', () => {
    // Состояние как после успешного вызова: регион уже перезапрошен и принадлежит
    // победителю, поэтому `annexation` пересчитался в null, а итог берётся из снимка.
    const logic = makeLogic({
      annexation: null,
      annexationDone: true,
      annexationResult: { regionName: 'Тверская земля', countryId: 1, countryName: 'Русь' },
    });
    const tree = render(logic);

    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Регион передан',
        'Регион Тверская земля присоединён. Новое государство: Русь.',
      ]),
    );
    // Кнопки повторной передачи нет.
    expect(texts(tree)).not.toContain('Присоединить регион');
    // И нет противоречивой строки «регион передаётся в веб-админке».
    expect(texts(tree).join(' | ')).not.toContain('в веб-админке');

    act(() => {
      tree.unmount();
    });
  });

  it('ошибку бэкенда показывает в блоке и оставляет кнопку', () => {
    const logic = makeLogic({ annexationError: 'нет связи' });
    const tree = render(logic);

    expect(texts(tree)).toEqual(expect.arrayContaining(['Ошибка: нет связи', 'Присоединить регион']));

    act(() => {
      tree.unmount();
    });
  });
});
