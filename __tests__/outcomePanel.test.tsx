/**
 * Итог боя: блок присоединения региона (`battles/components/OutcomePanel.tsx`).
 *
 * Сборка и тесты хука видят состояние, но не текст и не обработчики панели.
 * Здесь панель рендерится с подставным `logic` и проверяется то, что видит мастер:
 * победитель, выбор страны при союзниках, кнопка передачи региона и результат.
 */
import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
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

const buttonByText = (tree: ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(Text)
        .flatMap(textNode => collectText(textNode.props.children))
        .join('')
        .includes(label),
    );

const press = (tree: ReactTestRenderer, label: string) => {
  const target = buttonByText(tree, label);
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
    // Взятый город и его владелец: по умолчанию блока нет — тесты панели итога
    // про регион его не требуют.
    capturedCity: null,
    // Погибшие отряды и влияние Воеводе: по умолчанию блоков нет — тесты про
    // регион и владельца их не требуют.
    troopsToDestroy: [],
    troopsConfirmed: false,
    troopDeleteBusy: false,
    troopDeleteError: null,
    deletedTroopIds: [],
    confirmTroopDestruction: jest.fn(async () => {}),
    finishBattle: jest.fn(),
    winnerArmies: [],
    defeatedArmies: [],
    voevodaBusy: false,
    voevodaError: null,
    voevodaAwarded: null,
    awardVoevodaInfluence: jest.fn(async () => {}),
    ownerChoices: [],
    cityOwnerBusy: false,
    cityOwnerError: null,
    cityOwnerResult: null,
    removeCityOwner: jest.fn(async () => true),
    assignCityOwner: jest.fn(async () => true),
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

describe('итог боя: владелец взятого города', () => {
  const capturedCity = {
    settlementId: 10,
    name: 'Тверь',
    regionId: 20,
    isCapital: false,
    owner: { id: 9, name: 'Прежний владелец' },
    attackerPlayerIds: [5],
  };

  it('показывает владельца и снимает его по кнопке', () => {
    const logic = makeLogic({ capturedCity, annexation: null });
    const tree = render(logic);

    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Город Тверь захвачен',
        'Владелец: Прежний владелец',
        'Снять владельца',
        'Назначить владельца',
        'Столица государства не взята — регион не переходит.',
      ]),
    );

    press(tree, 'Снять владельца');
    expect(logic.removeCityOwner).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  it('без владельца снимать нечего — кнопка заблокирована', () => {
    const logic = makeLogic({
      capturedCity: { ...capturedCity, owner: null },
      annexation: null,
    });
    const tree = render(logic);

    expect(texts(tree)).toContain('Владелец: нет');
    const button = buttonByText(tree, 'Снять владельца');
    expect(button?.props.disabled).toBe(true);

    act(() => {
      tree.unmount();
    });
  });

  it('в выборе владельца все игроки, нападавшие помечены и идут первыми', () => {
    const logic = makeLogic({
      capturedCity: { ...capturedCity, owner: null },
      annexation: null,
      ownerChoices: [
        { id: 5, name: 'Яромир', countryName: 'Русь', attacked: true },
        { id: 14, name: 'Аким', countryName: 'Великий Новгород', attacked: false },
      ],
    });
    const tree = render(logic);

    // До нажатия списка нет.
    expect(texts(tree)).not.toContain('Новый владелец города');

    press(tree, 'Назначить владельца');

    const shown = texts(tree);
    expect(shown).toEqual(expect.arrayContaining(['Новый владелец города', 'Яромир', 'Аким', 'нападал']));
    // Нападавший выше остальных.
    expect(shown.indexOf('Яромир')).toBeLessThan(shown.indexOf('Аким'));

    press(tree, 'Аким');
    expect(logic.assignCityOwner).toHaveBeenCalledWith(14);

    act(() => {
      tree.unmount();
    });
  });

  it('показывает итог и ошибку смены владельца', () => {
    const removed = render(makeLogic({ capturedCity, annexation: null, cityOwnerResult: 'removed' }));
    expect(texts(removed)).toContain('Владелец города снят.');
    act(() => {
      removed.unmount();
    });

    const failed = render(
      makeLogic({ capturedCity, annexation: null, cityOwnerError: 'нет связи' }),
    );
    expect(texts(failed)).toEqual(expect.arrayContaining(['Ошибка: нет связи']));
    act(() => {
      failed.unmount();
    });
  });

  it('для столицы предупреждает: сначала регион, потом владелец', () => {
    const logic = makeLogic({
      capturedCity: { ...capturedCity, isCapital: true },
      annexation: {
        regionId: 20,
        regionName: 'Тверская земля',
        defendingCountryId: 2,
        defendingCountryName: 'Тверь',
        capitalName: 'Тверь',
        attackerCountries: [{ id: 1, name: 'Русь' }],
        remainingArmyCount: 0,
      },
    });
    const tree = render(logic);

    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Сначала присоедините регион, затем назначайте владельца: при передаче региона другому государству владельцы поселений снимаются.',
      ]),
    );

    act(() => {
      tree.unmount();
    });
  });
});

describe('итог боя: погибшие отряды и влияние Воеводе', () => {
  const fallen = [
    { troopId: 101, kind: 'infantry', name: 'Пехота', armyName: 'Рюрикович', armyUid: 'army1', armyId: 1 },
    { troopId: 102, kind: 'cavalry', name: 'Конница', armyName: 'Рюрикович', armyUid: 'army1', armyId: 1 },
  ];

  it('перечисляет погибшие отряды и уничтожает их только по подтверждению', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const logic = makeLogic({ outcome: 'attackers_destroyed', annexation: null, troopsToDestroy: fallen });
    const tree = render(logic);

    const shown = texts(tree).join(' | ');
    expect(shown).toContain('Погибшие отряды');
    expect(shown).toContain('Пехота — армия Рюрикович');
    expect(shown).toContain('Конница — армия Рюрикович');
    expect(shown).toContain('Уничтожить отряды (2)');

    // До подтверждения на бэкенд ничего не уходит.
    expect(logic.confirmTroopDestruction).not.toHaveBeenCalled();

    press(tree, 'Уничтожить отряды (2)');
    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const confirm = buttons.find(button => button.text === 'Уничтожить');
    expect(confirm).toBeTruthy();
    confirm?.onPress?.();
    expect(logic.confirmTroopDestruction).toHaveBeenCalledTimes(1);

    alertSpy.mockRestore();
    act(() => {
      tree.unmount();
    });
  });

  it('после уничтожения показывает число удалённых отрядов', () => {
    const logic = makeLogic({
      outcome: 'attackers_destroyed',
      annexation: null,
      troopsToDestroy: fallen,
      troopsConfirmed: true,
      deletedTroopIds: [101, 102],
    });
    const tree = render(logic);

    expect(texts(tree)).toContain('Уничтожено отрядов на бэкенде: 2');
    expect(texts(tree)).not.toContain('Уничтожить отряды (2)');

    act(() => {
      tree.unmount();
    });
  });

  it('влияние Воеводе: кнопка, ошибка «воеводы нет» и начисленный список', () => {
    const winnerArmies = [{ uid: 'army1', armyId: 1, name: 'Рюрикович', ownerName: 'Волоцкий' }];
    const defeatedArmies = [{ uid: 'army2', armyId: 2, name: 'Тверская дружина', ownerName: 'Тверской' }];

    const waitingLogic = makeLogic({ annexation: null, winnerArmies, defeatedArmies });
    const waiting = render(waitingLogic);
    expect(texts(waiting).join(' | ')).toContain('Влияние Воеводе за победу');
    expect(texts(waiting).join(' | ')).toContain('Рюрикович (Волоцкий)');
    // Разбитые армии показываются мастеру: за каждую идёт +4 победителю и −1 проигравшему.
    expect(texts(waiting).join(' | ')).toContain('Разбитые армии: Тверская дружина (Тверской)');
    press(waiting, 'Начислить влияние Воеводе');
    expect(waitingLogic.awardVoevodaInfluence).toHaveBeenCalledTimes(1);
    act(() => {
      waiting.unmount();
    });

    const nobody = render(makeLogic({ annexation: null, voevodaAwarded: [] }));
    expect(texts(nobody).join(' | ')).toContain(
      'Влияние не начислено: разбитых армий на бэкенде нет — гарнизон города армией не считается.',
    );
    act(() => {
      nobody.unmount();
    });

    const awarded = render(
      makeLogic({
        annexation: null,
        voevodaAwarded: [{ id: 6, name: 'Волоцкий', value: 4 }],
      }),
    );
    expect(texts(awarded)).toContain('Начислено: Волоцкий (+4)');
    act(() => {
      awarded.unmount();
    });
  });

  it('защищающиеся оставили город: передача владельца есть, регион не присоединяется', () => {
    const logic = makeLogic({
      outcome: 'defenders_retreated',
      annexation: null,
      capturedCity: {
        settlementId: 10,
        name: 'Тверь',
        regionId: 20,
        isCapital: true,
        owner: { id: 9, name: 'Прежний владелец' },
        attackerPlayerIds: [5],
      },
    });
    const tree = render(logic);

    const shown = texts(tree);
    expect(shown).toContain('Защищающиеся отступили');
    expect(shown).toEqual(
      expect.arrayContaining([
        'Город Тверь захвачен',
        'Снять владельца',
        'Назначить владельца',
        'Защищающиеся оставили город: регион остаётся за прежним государством — присоединение региона оформляется в веб-админке.',
      ]),
    );
    expect(shown).not.toContain('Присоединить регион');

    act(() => {
      tree.unmount();
    });
  });
});
