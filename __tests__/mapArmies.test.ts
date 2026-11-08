/**
 * Армии на карте: выбор щита (родовой / государственный / враг / бунт) и
 * раскладка щитов (город, поле, стопка у города, приблизительная точка).
 *
 * Правило заказчика: щиты врагов — сплошной оранжевый, бунта — сплошной чёрный,
 * остальным достаётся родовой или государственный щит из PSD.
 */
import { buildMapArmies } from '../src/screens/map/armyLayout';
import { isRebelArmy, shieldForArmy } from '../src/screens/map/armyShields';
import { groupTroops } from '../src/screens/map/ArmyPanel';
import type { Army, Settlement } from '../src/types';
import type { MapCity } from '../src/screens/map/types';

const army = (patch: Partial<Army>): Army => ({
  id: 1,
  name: 'Армия',
  ...patch,
});

const city = (patch: Partial<MapCity> & { id: number; name: string; x: number; y: number }): MapCity =>
  ({
    fortress: 0,
    capital: false,
    settlement: { id: patch.id, name: patch.name } as Settlement,
    ...patch,
  }) as MapCity;

const MOSCOW = { id: 1, name: 'Москва', short_name: 'Москва' };
const KAZAN = { id: 6, name: 'Казанское ханство', short_name: 'Казань' };

describe('щит армии', () => {
  it('бунт — по типу игрока и по имени «Дух народного бунта»', () => {
    const byType = army({
      owner: { id: 10, name: 'Кто-то', player_type: { id: 4, name: 'Дух народного бунта' } },
    });
    const byName = army({ owner: { id: 11, name: 'Дух народного бунта' } });
    expect(isRebelArmy(byType)).toBe(true);
    expect(isRebelArmy(byName)).toBe(true);
    expect(shieldForArmy(byType).kind).toBe('rebel');
    expect(shieldForArmy(byName).kind).toBe('rebel');
  });

  it('родовой щит — по фамилии и по имени боярина', () => {
    const byFamily = army({ owner: { id: 1, name: 'Кто угодно', family: { id: 5, name: 'Молодые' } } });
    const byName = army({ owner: { id: 2, name: 'Волоцкий' } });
    expect(shieldForArmy(byFamily).kind).toBe('family');
    expect(shieldForArmy(byName).kind).toBe('family');
  });

  it('государственный щит — Москва и Новгород, если рода нет', () => {
    const moscow = army({ country: MOSCOW, owner: { id: 3, name: 'Неизвестный род' } });
    const novgorod = army({
      country: { id: 12, name: 'Великий Новгород', short_name: 'Новгород' },
      owner: { id: 4, name: 'Лошинский' },
    });
    expect(shieldForArmy(moscow).kind).toBe('state');
    expect(shieldForArmy(novgorod).kind).toBe('state');
  });

  it('враг — армия чужого государства', () => {
    const enemy = army({
      country: KAZAN,
      owner_type: 'Country',
      owner: { id: 6, name: 'Казанское ханство' },
    });
    expect(shieldForArmy(enemy).kind).toBe('enemy');
  });
});

describe('раскладка щитов', () => {
  const cities = [
    city({ id: 1, name: 'Москва', x: 0.4, y: 0.4, capital: true, country: MOSCOW }),
    city({ id: 2, name: 'Арзамас', x: 0.6, y: 0.6 }),
  ];

  it('армия в городе стоит в координатах города, две армии — стопкой', () => {
    const result = buildMapArmies(
      [
        army({ id: 1, settlement: { id: 1, name: 'Москва' } }),
        army({ id: 2, settlement: { id: 1, name: 'Москва' } }),
      ],
      cities,
    );
    expect(result).toHaveLength(2);
    expect(result[0].inCity).toBe(true);
    expect(result[0].x).toBeCloseTo(0.4);
    expect(result[0].y).toBeCloseTo(0.4);
    expect(result.map(item => [item.slot, item.slotCount])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it('полевая армия стоит в своих координатах', () => {
    const [item] = buildMapArmies([army({ id: 3, map_x: 0.25, map_y: 0.75 })], cities);
    expect(item.inCity).toBe(false);
    expect(item.approximated).toBe(false);
    expect(item.x).toBeCloseTo(0.25);
    expect(item.y).toBeCloseTo(0.75);
  });

  it('армия без координат рисуется у столицы своего государства', () => {
    const [item] = buildMapArmies(
      [army({ id: 4, country_id: MOSCOW.id, country: MOSCOW })],
      cities,
    );
    expect(item.approximated).toBe(true);
    expect(Math.hypot(item.x - 0.4, item.y - 0.4)).toBeLessThan(0.03);
    expect(item.x === 0.4 && item.y === 0.4).toBe(false);
  });

  it('считает отряды и берёт щит из владельца', () => {
    const [item] = buildMapArmies(
      [
        army({
          id: 5,
          owner: { id: 1, name: 'Рюрикович', family: { id: 1, name: 'Рюриковичи' } },
          troops: [
            { id: 1, troop_type: { id: 1, name: 'Пехота' } },
            { id: 2, troop_type: { id: 4, name: 'Пушка' } },
          ],
        }),
      ],
      cities,
    );
    expect(item.troopsCount).toBe(2);
    expect(item.shield.kind).toBe('family');
  });
});

describe('состав армии в панели', () => {
  it('группирует по типу: пехота первой, пушка последней', () => {
    const groups = groupTroops([
      { id: 1, troop_type: { id: 4, name: 'Пушка' } },
      { id: 2, troop_type: { id: 1, name: 'Пехота' } },
      { id: 3, troop_type: { id: 1, name: 'Пехота' } },
    ]);
    expect(groups).toEqual([
      { name: 'Пехота', count: 2, cannon: false },
      { name: 'Пушка', count: 1, cannon: true },
    ]);
  });

  it('пустой состав не ломает панель', () => {
    expect(groupTroops(undefined)).toEqual([]);
  });
});
