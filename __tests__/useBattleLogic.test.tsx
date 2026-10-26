/**
 * Тесты сценария боя (`src/screens/hooks/useBattleLogic.ts`).
 *
 * Проверяется то, что нельзя увидеть сборкой: последовательность шагов,
 * одновременные броски обеих сторон, авто-выбор потерь, бонус крепости,
 * бонус мастера, отступление и подтверждение уничтожения армий.
 * Данные бэкенда подменяются хуками слоя, кубик — детерминированным rng.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

var mockData: {
  armies: any[];
  settlements: any[];
  regions: any[];
  countries: any[];
  players: any[];
} = {
  armies: [],
  settlements: [],
  regions: [],
  countries: [],
  players: [],
};

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    deleteArmy: jest.fn(() => Promise.resolve()),
    captureRegion: jest.fn(() => Promise.resolve()),
    setSettlementOwner: jest.fn(() => Promise.resolve()),
    getPlayers: jest.fn(),
    getArmies: jest.fn(),
    getSettlements: jest.fn(),
    getRegions: jest.fn(),
  },
}));

jest.mock('../src/data/hooks/useArmies', () => ({
  useArmies: () => ({
    data: mockData.armies,
    error: undefined,
    isLoading: false,
    isFetching: false,
    isStale: false,
    updatedAt: Date.now(),
    isOffline: false,
    refetch: async () => {},
  }),
}));

jest.mock('../src/data/hooks/useCountries', () => ({
  useAllCountries: () => ({
    data: mockData.countries,
    error: undefined,
    isLoading: false,
    isFetching: false,
    isStale: false,
    updatedAt: Date.now(),
    isOffline: false,
    refetch: async () => {},
  }),
}));

jest.mock('../src/data/hooks/usePlayers', () => ({
  usePlayers: () => ({
    data: mockData.players,
    error: undefined,
    isLoading: false,
    isFetching: false,
    isStale: false,
    updatedAt: Date.now(),
    isOffline: false,
    refetch: async () => {},
  }),
}));

jest.mock('../src/data/hooks/useSettlements', () => ({
  useSettlements: () => ({
    data: mockData.settlements,
    error: undefined,
    isLoading: false,
    isFetching: false,
    isStale: false,
    updatedAt: Date.now(),
    isOffline: false,
    refetch: async () => {},
  }),
  useRegions: () => ({
    data: mockData.regions,
    error: undefined,
    isLoading: false,
    isFetching: false,
    isStale: false,
    updatedAt: Date.now(),
    isOffline: false,
    refetch: async () => {},
  }),
}));

import ApiService from '../src/services/api';
import { useBattleLogic, type BattleLogic } from '../src/screens/hooks/useBattleLogic';

const renderHook = (hook: () => BattleLogic) => {
  const result: { current: BattleLogic } = { current: undefined as unknown as BattleLogic };
  const Component = () => {
    result.current = hook();
    return null;
  };

  let tree: ReactTestRenderer;
  act(() => {
    tree = create(<Component />);
  });

  return {
    get current() {
      return result.current;
    },
    unmount: () => act(() => tree.unmount()),
  };
};

const army = (id: number, name: string, ownerId: number, ownerName: string, kinds: string[]) => ({
  id,
  name,
  owner_type: 'Country',
  owner: { id: ownerId, name: ownerName },
  troops: kinds.map((kind, index) => ({
    id: id * 100 + index,
    troop_type: { id: 1, name: kind },
  })),
});

const citySettlement = {
  id: 10,
  name: 'Тверь',
  settlement_type_id: 2,
  settlement_type: { id: 2, name: 'Столица' },
  region_id: 20,
  buildings: [{ id: 1, building_type_name: 'Кремль', building_level_level: 2 }],
};

const playerOwnedArmy = (
  id: number,
  name: string,
  playerId: number,
  playerName: string,
  kinds: string[],
) => ({
  ...army(id, name, playerId, playerName, kinds),
  owner_type: 'Player',
  owner: { id: playerId, name: playerName, country_id: 1 },
});

/** Городской бой за столицу с одним нападающим: гарнизон гибнет, город взят. */
const winCityBattle = (hook: { readonly current: BattleLogic }, settlementId = 10) => {
  act(() => hook.current.setPlaceKind('city'));
  act(() => hook.current.selectCountry(2));
  act(() => hook.current.selectSettlement(settlementId));
  act(() => hook.current.goNext());
  act(() => hook.current.addArmy(mockData.armies[0], 'attacker'));
  act(() => hook.current.goNext());
  act(() => hook.current.goNext());

  const dice = [0.99, 0, 0.99];
  act(() => hook.current.setRng(() => dice.shift() ?? 0.99));
  act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
  act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  act(() => hook.current.confirmCasualties());
  act(() => {
    jest.advanceTimersByTime(4000);
  });
};

const setupFieldBattle = (hook: { readonly current: BattleLogic }) => {
  act(() => hook.current.setPlaceKind('field'));
  act(() => hook.current.goNext());
  act(() => hook.current.addArmy(mockData.armies[0], 'attacker'));
  act(() => hook.current.addArmy(mockData.armies[1], 'defender'));
  act(() => hook.current.goNext());
  act(() => hook.current.goNext());
};

describe('useBattleLogic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockData = {
      regions: [{ id: 20, name: 'Тверская земля', country_id: 2, country: { id: 2, name: 'Тверь' } }],
      countries: [
        { id: 1, name: 'Русь' },
        { id: 2, name: 'Тверь' },
        { id: 6, name: 'Казанское ханство' },
      ],
      settlements: [citySettlement],
      players: [],
      armies: [
        army(1, 'Нападающие', 1, 'Русь', ['Пехота', 'Пехота']),
        army(2, 'Защитники', 2, 'Тверь', ['Пехота']),
      ],
    };
    (ApiService.deleteArmy as jest.Mock).mockClear();
    (ApiService.captureRegion as jest.Mock).mockClear();
    (ApiService.setSettlementOwner as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('в городском бою защитником сразу стоит гарнизон города', () => {
    const hook = renderHook(() => useBattleLogic());

    act(() => hook.current.setPlaceKind('city'));
    act(() => hook.current.selectCountry(2));
    act(() => hook.current.selectSettlement(10));
    act(() => hook.current.goNext());

    expect(hook.current.step).toBe('armies');
    // Город защищается сам: одна пехота уже в защищающихся, выбирать армию не нужно.
    expect(hook.current.defenders).toHaveLength(1);
    expect(hook.current.defenders[0].isGarrison).toBe(true);
    expect(hook.current.defenders[0].name).toBe('Гарнизон (Тверь)');
    expect(hook.current.defenders[0].armyId).toBeNull();
    expect(hook.current.defenders[0].troops).toHaveLength(1);
    expect(hook.current.defenders[0].troops[0].source).toBe('city');
    expect(hook.current.battleReady).toBe(false);

    act(() => hook.current.addArmy(mockData.armies[0], 'attacker'));
    expect(hook.current.battleReady).toBe(true);

    hook.unmount();
  });

  it('ведёт бой по шагам и подтверждает уничтожение разбитых армий', async () => {
    const hook = renderHook(() => useBattleLogic());

    act(() => hook.current.setPlaceKind('city'));
    expect(hook.current.placeReady).toBe(false);
    act(() => hook.current.selectCountry(2));
    act(() => hook.current.selectSettlement(10));
    expect(hook.current.placeReady).toBe(true);
    expect(hook.current.fortressLevel).toBe(2);
    expect(hook.current.isCapital).toBe(true);

    act(() => hook.current.goNext());
    expect(hook.current.step).toBe('armies');
    // Бой за один город с одной армией: защищается только гарнизон.
    act(() => hook.current.addArmy(mockData.armies[0], 'attacker'));
    act(() => hook.current.goNext());
    expect(hook.current.step).toBe('buffs');
    expect(hook.current.cannonWarning).not.toBeNull();

    act(() => hook.current.goNext());
    expect(hook.current.step).toBe('battle');

    // Гарнизон города — это и есть городская пехота, второй раз она не добавляется.
    expect(hook.current.defenders[0].troops).toHaveLength(1);
    expect(hook.current.defenders[0].troops[0].source).toBe('city');
    // Гарнизону пехоту от города не дублируем, поэтому у него один отряд.
    expect(hook.current.defenders[0].isGarrison).toBe(true);

    // Кубики падают с шагом 140 мс внутри армии:
    // атакующий #1 (6), гарнизон (4 + 1 от крепости = 5 — попадание), атакующий #2 (6).
    const dice = [0.99, 0.5, 0.99];
    act(() => hook.current.setRng(() => dice.shift() ?? 0.99));

    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(hook.current.phase).toBe('casualties');
    expect(hook.current.hits).toEqual({ attacker: 2, defender: 1 });

    // Авто-выбор: гарнизон погибает целиком, у атакующих — 1 самый слабый.
    expect(hook.current.victims.defender).toHaveLength(1);
    expect(hook.current.victims.attacker).toHaveLength(1);
    expect(hook.current.victimsReady).toBe(true);

    act(() => hook.current.confirmCasualties());
    // Потери применяются не сразу: сначала сцена проигрывает удары и смерти.
    expect(hook.current.phase).toBe('playing');
    expect(hook.current.scene.steps.length).toBeGreaterThanOrEqual(3);
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(hook.current.phase).toBe('finished');
    expect(hook.current.outcome).toBe('defenders_destroyed');
    expect(hook.current.attackers[0].troops).toHaveLength(1);
    expect(hook.current.defenders[0].troops).toHaveLength(0);

    // Столица взята — регион предлагается присоединить, хотя у Твери ещё есть армия
    // на бэкенде: экран только сообщает об этом («по правилам это оккупация»).
    expect(hook.current.annexation?.regionId).toBe(20);
    expect(hook.current.annexation?.regionName).toBe('Тверская земля');
    expect(hook.current.annexation?.remainingArmyCount).toBe(1);
    // Взятый город описан отдельным блоком панели итога.
    expect(hook.current.capturedCity?.settlementId).toBe(10);
    expect(hook.current.capturedCity?.isCapital).toBe(true);

    // У гарнизона нет армии на бэкенде — удалять нечего.
    expect(hook.current.armiesToDestroy.map(item => item.armyId)).toEqual([null]);

    await act(async () => {
      await hook.current.confirmOutcome();
    });
    expect(ApiService.deleteArmy).not.toHaveBeenCalled();
    expect(hook.current.deletedArmyIds).toEqual([]);

    hook.unmount();
  });

  it('частичные потери защитников уводят бой в отступление', () => {
    const hook = renderHook(() => useBattleLogic());

    act(() => hook.current.setPlaceKind('city'));
    act(() => hook.current.selectCountry(2));
    act(() => hook.current.selectSettlement(10));
    act(() => hook.current.goNext());
    act(() => hook.current.addArmy(mockData.armies[0], 'attacker'));
    act(() => hook.current.addArmy(mockData.armies[1], 'defender'));
    act(() => hook.current.goNext());
    act(() => hook.current.goNext());

    // 5 отрядов: атакующие (2) и защитники — гарнизон (1) и армия (2).
    // Порядок бросков: атакующий #1, гарнизон, армия #1, затем атакующий #2, армия #2.
    // Атакующие попадают дважды, защитники промахиваются.
    const dice = [0.99, 0, 0, 0.99, 0];
    act(() => hook.current.setRng(() => dice.shift() ?? 0));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[1].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(hook.current.hits).toEqual({ attacker: 2, defender: 0 });
    act(() => hook.current.confirmCasualties());
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    // 3 отряда защитников против 2 попаданий: бой не закончен, армии могут отступать.
    expect(hook.current.phase).toBe('retreat');
    expect(hook.current.outcome).toBeNull();
    expect(hook.current.defenders.reduce((sum, army) => sum + army.troops.length, 0)).toBe(1);
    expect(hook.current.attackers[0].troops).toHaveLength(2);

    hook.unmount();
  });

  it('взятие столицы предлагает присоединить регион и передаёт его победителю', async () => {
    // У Твери не осталось армий на бэкенде — в списке только нападающие.
    mockData.armies = [army(1, 'Нападающие', 1, 'Русь', ['Пехота', 'Пехота'])];
    const hook = renderHook(() => useBattleLogic());

    act(() => hook.current.setPlaceKind('city'));
    act(() => hook.current.selectCountry(2));
    act(() => hook.current.selectSettlement(10));
    act(() => hook.current.goNext());
    act(() => hook.current.addArmy(mockData.armies[0], 'attacker'));
    act(() => hook.current.goNext());
    act(() => hook.current.goNext());

    const dice = [0.99, 0, 0.99];
    act(() => hook.current.setRng(() => dice.shift() ?? 0.99));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    act(() => hook.current.confirmCasualties());
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(hook.current.outcome).toBe('defenders_destroyed');
    expect(hook.current.annexation?.defendingCountryName).toBe('Тверь');
    expect(hook.current.annexation?.capitalName).toBe('Тверь');
    // Регион берётся у взятой столицы, а не у страны целиком.
    expect(hook.current.annexation?.regionId).toBe(20);
    expect(hook.current.annexation?.regionName).toBe('Тверская земля');
    expect(hook.current.annexation?.attackerCountries).toEqual([{ id: 1, name: 'Русь' }]);
    // Победитель один — страну-получателя мастер не выбирает.
    expect(hook.current.annexationTarget).toBe(1);

    await act(async () => {
      await hook.current.confirmAnnexation();
    });
    // Тот же вызов, что делает веб-админка: регион 20 → государство 1, войной.
    expect(ApiService.captureRegion).toHaveBeenCalledWith(20, 1, true);
    expect(hook.current.annexationDone).toBe(true);
    // Итог хранится снимком: после перезапроса регионов регион уже чужой и
    // annexation пересчитается, а текст «кому передан» должен остаться.
    expect(hook.current.annexationResult).toEqual({
      regionName: 'Тверская земля',
      countryId: 1,
      countryName: 'Русь',
    });
    expect(hook.current.annexationError).toBeNull();

    // Повторное нажатие кнопки не отправляет второй запрос.
    await act(async () => {
      await hook.current.confirmAnnexation();
    });
    expect(ApiService.captureRegion).toHaveBeenCalledTimes(1);

    hook.unmount();
  });

  it('если воевали союзники, регион уходит выбранной стране', async () => {
    // Союзники: Русь (пехота) и Казанское ханство (пушка — в бросках не участвует).
    mockData.armies = [
      army(1, 'Нападающие', 1, 'Русь', ['Пехота', 'Пехота']),
      army(3, 'Казанцы', 6, 'Казанское ханство', ['Пушка']),
    ];
    const hook = renderHook(() => useBattleLogic());

    act(() => hook.current.setPlaceKind('city'));
    act(() => hook.current.selectCountry(2));
    act(() => hook.current.selectSettlement(10));
    act(() => hook.current.goNext());
    act(() => hook.current.addArmy(mockData.armies[0], 'attacker'));
    act(() => hook.current.addArmy(mockData.armies[1], 'attacker'));
    act(() => hook.current.goNext());
    act(() => hook.current.goNext());

    const dice = [0.99, 0, 0.99];
    act(() => hook.current.setRng(() => dice.shift() ?? 0.99));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => hook.current.confirmCasualties());
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(hook.current.outcome).toBe('defenders_destroyed');
    expect(hook.current.annexation?.attackerCountries).toEqual([
      { id: 1, name: 'Русь' },
      { id: 6, name: 'Казанское ханство' },
    ]);
    // Пока страна не выбрана, передавать регион некому.
    expect(hook.current.annexationTarget).toBeNull();
    await act(async () => {
      await hook.current.confirmAnnexation();
    });
    expect(ApiService.captureRegion).not.toHaveBeenCalled();

    act(() => hook.current.setAnnexationChoice(6));
    expect(hook.current.annexationTarget).toBe(6);
    await act(async () => {
      await hook.current.confirmAnnexation();
    });
    expect(ApiService.captureRegion).toHaveBeenCalledWith(20, 6, true);
    expect(hook.current.annexationDone).toBe(true);

    hook.unmount();
  });

  it('ошибка бэкенда при присоединении региона не закрывает предложение', async () => {
    mockData.armies = [army(1, 'Нападающие', 1, 'Русь', ['Пехота', 'Пехота'])];
    (ApiService.captureRegion as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const hook = renderHook(() => useBattleLogic());

    act(() => hook.current.setPlaceKind('city'));
    act(() => hook.current.selectCountry(2));
    act(() => hook.current.selectSettlement(10));
    act(() => hook.current.goNext());
    act(() => hook.current.addArmy(mockData.armies[0], 'attacker'));
    act(() => hook.current.goNext());
    act(() => hook.current.goNext());

    const dice = [0.99, 0, 0.99];
    act(() => hook.current.setRng(() => dice.shift() ?? 0.99));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => hook.current.confirmCasualties());
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    await act(async () => {
      await hook.current.confirmAnnexation();
    });
    expect(hook.current.annexationDone).toBe(false);
    expect(hook.current.annexationError).toBeTruthy();
    // Кнопка остаётся: мастер может повторить передачу региона.
    expect(hook.current.annexationTarget).toBe(1);

    hook.unmount();
  });

  it('взятый город: владельца можно снять', async () => {
    // У города есть владелец-игрок, у нападающей армии — свой игрок-командир.
    mockData.settlements = [{ ...citySettlement, player: { id: 9, name: 'Прежний владелец' } }];
    mockData.players = [
      { id: 5, name: 'Яромир', country_id: 1, country: { id: 1, name: 'Русь' } },
      { id: 9, name: 'Прежний владелец', country_id: 1, country: { id: 1, name: 'Русь' } },
    ];
    mockData.armies = [playerOwnedArmy(3, 'Дружина', 5, 'Яромир', ['Пехота', 'Пехота'])];
    const hook = renderHook(() => useBattleLogic());
    winCityBattle(hook);

    expect(hook.current.capturedCity?.owner).toEqual({ id: 9, name: 'Прежний владелец' });
    // Нападавший идёт первым, хотя по алфавиту он последний.
    expect(hook.current.ownerChoices.map(item => item.id)).toEqual([5, 9]);
    expect(hook.current.ownerChoices[0].attacked).toBe(true);

    await act(async () => {
      await hook.current.removeCityOwner();
    });
    expect(ApiService.setSettlementOwner).toHaveBeenCalledWith(10, null);
    expect(hook.current.cityOwnerResult).toBe('removed');
    expect(hook.current.cityOwnerError).toBeNull();

    hook.unmount();
  });

  it('взятый город: владельцем можно назначить любого игрока', async () => {
    mockData.settlements = [{ ...citySettlement, player: null }];
    mockData.players = [
      { id: 5, name: 'Яромир', country_id: 1, country: { id: 1, name: 'Русь' } },
      { id: 14, name: 'Аким', country_id: 12, country: { id: 12, name: 'Великий Новгород' } },
    ];
    mockData.armies = [playerOwnedArmy(3, 'Дружина', 5, 'Яромир', ['Пехота', 'Пехота'])];
    const hook = renderHook(() => useBattleLogic());
    winCityBattle(hook);

    expect(hook.current.capturedCity?.owner).toBeNull();
    // Любой игрок игры, не только нападавшие: новгородский купец тоже в списке.
    expect(hook.current.ownerChoices.map(item => item.id)).toEqual([5, 14]);
    expect(hook.current.ownerChoices.find(item => item.id === 14)?.attacked).toBe(false);
    // Без владельца снимать нечего, но назначать можно.
    await act(async () => {
      await hook.current.assignCityOwner(14);
    });
    expect(ApiService.setSettlementOwner).toHaveBeenCalledWith(10, 14);
    expect(hook.current.cityOwnerResult).toBe('assigned');

    hook.unmount();
  });

  it('ошибка смены владельца не закрывает панель города', async () => {
    mockData.armies = [army(1, 'Нападающие', 1, 'Русь', ['Пехота', 'Пехота'])];
    (ApiService.setSettlementOwner as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const hook = renderHook(() => useBattleLogic());
    winCityBattle(hook);

    expect(hook.current.capturedCity).not.toBeNull();
    await act(async () => {
      await hook.current.assignCityOwner(5);
    });
    expect(hook.current.cityOwnerResult).toBeNull();
    expect(hook.current.cityOwnerError).toBeTruthy();
    expect(hook.current.capturedCity).not.toBeNull();

    hook.unmount();
  });

  it('взятый город не столицы: владельцы есть, присоединения региона нет', async () => {
    mockData.settlements = [
      {
        id: 11,
        name: 'Коломна',
        settlement_type_id: 1,
        settlement_type: { id: 1, name: 'Город' },
        region_id: 20,
        buildings: [],
        player: { id: 9, name: 'Прежний владелец' },
      },
    ];
    mockData.armies = [army(1, 'Нападающие', 1, 'Русь', ['Пехота', 'Пехота'])];
    const hook = renderHook(() => useBattleLogic());
    winCityBattle(hook, 11);

    expect(hook.current.capturedCity?.settlementId).toBe(11);
    expect(hook.current.capturedCity?.isCapital).toBe(false);
    expect(hook.current.annexation).toBeNull();

    hook.unmount();
  });

  it('уничтожение армии на бэкенде: разбитые нападающие удаляются по подтверждению', async () => {
    const hook = renderHook(() => useBattleLogic());
    act(() => hook.current.setPlaceKind('field'));
    act(() => hook.current.goNext());
    // Атакующий — армия с одним отрядом, защитник — с двумя.
    act(() => hook.current.addArmy(mockData.armies[1], 'attacker'));
    act(() => hook.current.addArmy(mockData.armies[0], 'defender'));
    act(() => hook.current.goNext());
    act(() => hook.current.goNext());

    const dice = [0, 0.99, 0];
    act(() => hook.current.setRng(() => dice.shift() ?? 0));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(hook.current.hits).toEqual({ attacker: 0, defender: 1 });
    act(() => hook.current.confirmCasualties());
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(hook.current.outcome).toBe('attackers_destroyed');
    // Город не взят — блока города и владельцев нет.
    expect(hook.current.capturedCity).toBeNull();
    expect(hook.current.armiesToDestroy.map(item => item.armyId)).toEqual([2]);

    await act(async () => {
      await hook.current.confirmOutcome();
    });
    expect(ApiService.deleteArmy).toHaveBeenCalledWith(2);
    expect(hook.current.deletedArmyIds).toEqual([2]);

    hook.unmount();
  });

  it('метку потери можно снять и поставить обратно, даже когда попаданий у сторон разное число', () => {
    // Защитники попали трижды, нападающие — один раз: у атакующих обязаны
    // погибнуть 3 отряда, у защищающихся 1. Раньше предел меток брался по
    // «своим» попаданиям (hits.attacker = 1), поэтому после снятия метки
    // нужное число было уже не набрать.
    mockData.armies = [
      army(1, 'Нападающие', 1, 'Русь', ['Пехота', 'Пехота', 'Пехота']),
      army(2, 'Защитники', 2, 'Тверь', ['Пехота', 'Пехота', 'Пехота']),
    ];
    const hook = renderHook(() => useBattleLogic());
    setupFieldBattle(hook);

    // Броски: у нападающих 6,1,1 (одно попадание), у защитников 6,6,6 (три).
    // Армии бросают по очереди: кубики обеих сторон идут вперемешку по времени.
    const attackerDice = [0.99, 0, 0];
    act(() => hook.current.setRng(() => attackerDice.shift() ?? 0.99));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => hook.current.setRng(() => 0.99));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(hook.current.phase).toBe('casualties');
    expect(hook.current.hits).toEqual({ attacker: 1, defender: 3 });
    expect(hook.current.incomingHits).toEqual({ attacker: 3, defender: 1 });
    expect(hook.current.lossLimit('attacker')).toBe(3);
    expect(hook.current.lossLimit('defender')).toBe(1);
    expect(hook.current.victims.attacker).toHaveLength(3);
    expect(hook.current.victimsReady).toBe(true);

    const target = hook.current.victims.attacker[0];

    // Сняли метку — подтверждение потерь недоступно.
    act(() => hook.current.toggleVictim('attacker', target));
    expect(hook.current.victims.attacker).toHaveLength(2);
    expect(hook.current.victims.attacker).not.toContain(target);
    expect(hook.current.victimsReady).toBe(false);

    // Поставили обратно — выбор снова полный.
    act(() => hook.current.toggleVictim('attacker', target));
    expect(hook.current.victims.attacker).toHaveLength(3);
    expect(hook.current.victims.attacker).toContain(target);
    expect(hook.current.victimsReady).toBe(true);

    // Четвёртой метки быть не может: предел — три погибших отряда.
    const extra = hook.current.victims.attacker[0];
    act(() => hook.current.toggleVictim('attacker', extra));
    act(() => hook.current.toggleVictim('attacker', extra));
    expect(hook.current.victims.attacker).toHaveLength(3);
    expect(hook.current.victimsReady).toBe(true);

    hook.unmount();
  });

  it('предел меток — попадания противника, но не больше живых отрядов стороны', () => {
    // У защитников один отряд, а нападающие попали трижды: отметить можно один,
    // и снятую метку разрешено вернуть (по «своим» попаданиям защитников 0).
    mockData.armies = [
      army(1, 'Нападающие', 1, 'Русь', ['Пехота', 'Пехота', 'Пехота']),
      army(2, 'Защитники', 2, 'Тверь', ['Пехота']),
    ];
    const hook = renderHook(() => useBattleLogic());
    setupFieldBattle(hook);

    // Нападающие бросают 6,6,6 (три попадания), защитник — 4 (промах).
    act(() => hook.current.setRng(() => 0.99));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => hook.current.setRng(() => 0.5));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(hook.current.hits).toEqual({ attacker: 3, defender: 0 });
    expect(hook.current.incomingHits.defender).toBe(3);
    expect(hook.current.lossLimit('defender')).toBe(1);
    expect(hook.current.lossLimit('attacker')).toBe(0);
    expect(hook.current.victims.defender).toHaveLength(1);

    const victim = hook.current.victims.defender[0];
    act(() => hook.current.toggleVictim('defender', victim));
    expect(hook.current.victims.defender).toHaveLength(0);
    expect(hook.current.victimsReady).toBe(false);

    act(() => hook.current.toggleVictim('defender', victim));
    expect(hook.current.victims.defender).toEqual([victim]);
    expect(hook.current.victimsReady).toBe(true);

    // У атакующих попаданий не было — метка не ставится вовсе.
    const attackerTroop = hook.current.attackers[0].troops[0].uid;
    act(() => hook.current.toggleVictim('attacker', attackerTroop));
    expect(hook.current.victims.attacker).toHaveLength(0);
    expect(hook.current.victimsReady).toBe(true);

    hook.unmount();
  });

  it('при промахах обеих сторон начинается отступление, бросок 4–6 уводит армию', () => {
    const hook = renderHook(() => useBattleLogic());
    setupFieldBattle(hook);

    act(() => hook.current.setRng(() => 0));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(hook.current.phase).toBe('retreat');
    expect(hook.current.hits).toEqual({ attacker: 0, defender: 0 });

    act(() => hook.current.setRng(() => 0.6)); // 0.6 → грань 4
    act(() => hook.current.retreatArmy(hook.current.attackers[0].uid));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(hook.current.attackers[0].retreatRoll).toBe(4);
    expect(hook.current.attackers[0].retreated).toBe(true);

    act(() => hook.current.nextRound());
    expect(hook.current.phase).toBe('finished');
    expect(hook.current.outcome).toBe('attackers_retreated');
    expect(hook.current.armiesToDestroy).toEqual([]);

    hook.unmount();
  });

  it('бонус мастера поднимает значение кубика до попадания', () => {
    const hook = renderHook(() => useBattleLogic());
    setupFieldBattle(hook);

    act(() => hook.current.changeBonus(hook.current.attackers[0].uid, 1));
    // Пехота с бонусом +1 попадает на 4 (4 + 1 = 5).
    act(() => hook.current.setRng(() => 0.5));
    act(() => hook.current.rollArmy(hook.current.attackers[0].uid));
    act(() => hook.current.rollArmy(hook.current.defenders[0].uid));
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(hook.current.hits.attacker).toBe(2);
    expect(hook.current.phase).toBe('casualties');

    hook.unmount();
  });

  it('«Ход» бросает все отряды обеих сторон и доводит раунд до потерь', () => {
    const hook = renderHook(() => useBattleLogic());
    setupFieldBattle(hook);

    // Пехота попадает на 5–6: все броски по 6 — бьют обе стороны.
    act(() => hook.current.setRng(() => 0.99));
    expect(hook.current.canRollAll).toBe(true);

    act(() => hook.current.rollAll());
    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(hook.current.phase).toBe('casualties');
    expect(hook.current.hits.attacker).toBeGreaterThan(0);
    expect(hook.current.hits.defender).toBeGreaterThan(0);
    // Все кубики легли — повторная волна не нужна.
    expect(hook.current.canRollAll).toBe(false);

    hook.unmount();
  });
});
