/**
 * Очередь сражений, набранных на карте (`useBattleLogic({ plan })`).
 *
 * Проверяется то, чего не видит ни экран, ни сборка: сражение с карты раскрывается
 * сразу на шаге «Армии» с правильными сторонами, в городском бою на месте стоит
 * гарнизон, «Следующее сражение» переключает очередь, а пропавшая на бэкенде
 * армия не роняет бой — мастер видит предупреждение.
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
    deleteTroop: jest.fn(() => Promise.resolve()),
    awardBattleVictory: jest.fn(() => Promise.resolve({ success: true, awarded: [] })),
    reportBattle: jest.fn(() => Promise.resolve()),
    captureRegion: jest.fn(() => Promise.resolve()),
    setSettlementOwner: jest.fn(() => Promise.resolve()),
    getPlayers: jest.fn(),
    getArmies: jest.fn(),
    getSettlements: jest.fn(),
    getRegions: jest.fn(),
  },
}));

const queryStub = () => ({
  error: undefined,
  isLoading: false,
  isFetching: false,
  isStale: false,
  updatedAt: Date.now(),
  isOffline: false,
  refetch: async () => {},
});

jest.mock('../src/data/hooks/useArmies', () => ({
  useArmies: () => ({ data: mockData.armies, ...queryStub() }),
}));

jest.mock('../src/data/hooks/useCountries', () => ({
  useAllCountries: () => ({ data: mockData.countries, ...queryStub() }),
}));

jest.mock('../src/data/hooks/usePlayers', () => ({
  usePlayers: () => ({ data: mockData.players, ...queryStub() }),
}));

jest.mock('../src/data/hooks/useSettlements', () => ({
  useSettlements: () => ({ data: mockData.settlements, ...queryStub() }),
  useRegions: () => ({ data: mockData.regions, ...queryStub() }),
}));

import { useBattleLogic, type BattleLogic } from '../src/screens/hooks/useBattleLogic';
import type { PlannedBattle } from '../src/screens/map/battlePlan';
import {
  clearBattlePlan,
  getBattlePlan,
  setBattlePlan,
} from '../src/screens/map/battlePlanStore';

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

const army = (id: number, name: string, countryId: number, kinds: string[]) => ({
  id,
  name,
  owner_type: 'Country',
  owner: { id: countryId, name: `Страна ${countryId}` },
  country_id: countryId,
  country: { id: countryId, name: `Страна ${countryId}` },
  settlement: null,
  map_x: 0.5,
  map_y: 0.5,
  troops: kinds.map((kind, index) => ({
    id: id * 100 + index,
    troop_type: { id: 1, name: kind },
  })),
});

const cityBattle: PlannedBattle = {
  key: 'city:10',
  kind: 'city',
  cityId: 10,
  armyId: null,
  title: 'Тверь',
  attackerIds: [1],
  defenderIds: [2],
};

const fieldBattle: PlannedBattle = {
  key: 'army:3',
  kind: 'army',
  cityId: null,
  armyId: 3,
  title: 'Армия «Казань»',
  attackerIds: [4],
  defenderIds: [3],
};

beforeEach(() => {
  clearBattlePlan();
  mockData = {
    armies: [
      army(1, 'Москва', 1, ['Пехота']),
      army(2, 'Тверь', 2, ['Пехота']),
      army(3, 'Казань', 6, ['Конница']),
      army(4, 'Рязань', 3, ['Пехота', 'Пушка']),
    ],
    settlements: [
      {
        id: 10,
        name: 'Тверь',
        settlement_type_id: 2,
        settlement_type: { id: 2, name: 'Столица' },
        region_id: 20,
        buildings: [{ id: 1, building_type_name: 'Кремль', building_level_level: 2 }],
      },
    ],
    regions: [
      { id: 20, name: 'Тверское княжество', country_id: 2, country: { id: 2, name: 'Тверское княжество' } },
    ],
    countries: [
      { id: 1, name: 'Москва' },
      { id: 2, name: 'Тверское княжество' },
      { id: 3, name: 'Рязанское княжество' },
      { id: 6, name: 'Казанское ханство' },
    ],
    players: [],
  };
});

describe('очередь сражений с карты', () => {
  it('городской бой раскрывается на шаге «Армии» с гарнизоном и сторонами', () => {
    const hook = renderHook(() => useBattleLogic({ plan: [cityBattle] }));

    expect(hook.current.step).toBe('armies');
    expect(hook.current.placeKind).toBe('city');
    expect(hook.current.placeTitle).toBe('За город Тверь');
    expect(hook.current.queuePosition).toBe(1);
    expect(hook.current.queueTotal).toBe(1);
    expect(hook.current.hasNextBattle).toBe(false);

    // Гарнизон города стоит в защите всегда, плюс армия, набранная мастером.
    expect(hook.current.defenders.map(item => item.name)).toEqual(['Гарнизон (Тверь)', 'Тверь']);
    expect(hook.current.attackers.map(item => item.armyId)).toEqual([1]);
    expect(hook.current.battleReady).toBe(true);
    expect(hook.current.queueNotice).toBeNull();

    // Последнее сражение забрали в работу — план на карте очищен.
    expect(getBattlePlan()).toEqual([]);

    hook.unmount();
  });

  it('«следующее сражение» переключает очередь на полевой бой без гарнизона', () => {
    setBattlePlan([cityBattle, fieldBattle]);
    const hook = renderHook(() => useBattleLogic({ plan: getBattlePlan() }));

    // План скопирован в очередь; в хранилище он ещё целиком — если мастер уйдёт
    // на карту посреди очереди, набор сражений не потеряется.
    expect(hook.current.queueTotal).toBe(2);
    expect(getBattlePlan()).toEqual([cityBattle, fieldBattle]);

    act(() => hook.current.nextQueuedBattle());

    expect(hook.current.step).toBe('armies');
    expect(hook.current.placeKind).toBe('field');
    expect(hook.current.queuePosition).toBe(2);
    expect(hook.current.hasNextBattle).toBe(false);
    expect(hook.current.defenders.map(item => item.armyId)).toEqual([3]);
    expect(hook.current.attackers.map(item => item.armyId)).toEqual([4]);
    // Гарнизона в поле нет.
    expect(hook.current.battleArmies.some(item => item.isGarrison)).toBe(false);
    expect(getBattlePlan()).toEqual([]);

    hook.unmount();
  });

  it('армии, которой уже нет на бэкенде, бой не мешает', () => {
    const broken: PlannedBattle = { ...fieldBattle, attackerIds: [4, 99] };
    const hook = renderHook(() => useBattleLogic({ plan: [broken] }));

    expect(hook.current.step).toBe('armies');
    expect(hook.current.attackers.map(item => item.armyId)).toEqual([4]);
    expect(hook.current.queueNotice).toContain('99');

    hook.unmount();
  });

  it('без плана экран работает как раньше: ручной шаг «Место»', () => {
    const hook = renderHook(() => useBattleLogic());

    expect(hook.current.step).toBe('place');
    expect(hook.current.hasQueuedBattles).toBe(false);
    expect(hook.current.battleArmies).toEqual([]);

    hook.unmount();
  });
});
