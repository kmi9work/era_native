/**
 * Раскладка армий на карте: где рисовать щит каждой армии.
 *
 * Армия в городе стоит ПОД меткой города (решение заказчика), армия в поле — в
 * своей точке (`armies.map_x/map_y`). У полевых армий, которым координаты ни разу
 * не ставили, места в данных нет вовсе: такие рисуются у столицы своего
 * государства со сдвигом по номеру, чтобы не слиплись, и мастер может сразу
 * «Передвинуть» их на нужное место.
 *
 * Подписей у армий нет — только щит.
 */
import type { Army } from '../../types';
import { shieldForArmy, type ArmyShieldInfo } from './armyShields';
import type { MapCity } from './types';

export interface MapArmy {
  army: Army;
  /** Нормализованные координаты точки привязки (центр города или точка в поле). */
  x: number;
  y: number;
  /** Армия стоит в городе → щит рисуется под меткой города. */
  inCity: boolean;
  city: MapCity | null;
  /** Место щита в стопке у города (0..slotCount-1) — армий в городе бывает несколько. */
  slot: number;
  slotCount: number;
  /** Координат нет ни у армии, ни у города: точка выведена приблизительно. */
  approximated: boolean;
  shield: ArmyShieldInfo;
  troopsCount: number;
}

/** Сдвиг «приблизительных» армий у столицы: золотой угол, чтобы не слипались. */
const GOLDEN_ANGLE = 2.39996323;
const APPROX_RADIUS = 0.028;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const buildMapArmies = (armies: Army[], cities: MapCity[]): MapArmy[] => {
  const citiesById = new Map<number, MapCity>();
  cities.forEach(city => citiesById.set(city.id, city));

  const capitals = new Map<number, MapCity>();
  cities.forEach(city => {
    const countryId = city.country?.id;
    if (countryId == null) return;
    if (!capitals.has(countryId) || city.capital) capitals.set(countryId, city);
  });

  const placed = armies.map(army => {
    const city = army.settlement?.id != null ? citiesById.get(army.settlement.id) ?? null : null;

    if (city) {
      return { army, x: city.x, y: city.y, inCity: true, city, approximated: false };
    }
    if (isNumber(army.map_x) && isNumber(army.map_y)) {
      return { army, x: army.map_x, y: army.map_y, inCity: false, city: null, approximated: false };
    }

    const countryId = army.country_id ?? army.owner?.country_id ?? null;
    const capital = countryId != null ? capitals.get(countryId) ?? null : null;
    const baseX = capital?.x ?? 0.5;
    const baseY = capital?.y ?? 0.5;
    const angle = (army.id % 12) * GOLDEN_ANGLE;
    return {
      army,
      x: baseX + Math.cos(angle) * APPROX_RADIUS,
      y: baseY + Math.sin(angle) * APPROX_RADIUS,
      inCity: false,
      city: null,
      approximated: true,
    };
  });

  // Армии в одном городе — стопкой под меткой, поровну влево/вправо от центра.
  const cityGroups = new Map<number, number>();
  placed.forEach(item => {
    if (item.city) cityGroups.set(item.city.id, (cityGroups.get(item.city.id) ?? 0) + 1);
  });
  const cityIndex = new Map<number, number>();

  return placed.map(item => {
    let slot = 0;
    let slotCount = 1;
    if (item.city) {
      const total = cityGroups.get(item.city.id) ?? 1;
      const index = cityIndex.get(item.city.id) ?? 0;
      slot = index;
      slotCount = total;
      cityIndex.set(item.city.id, index + 1);
    }
    return {
      ...item,
      slot,
      slotCount,
      shield: shieldForArmy(item.army),
      troopsCount: item.army.troops?.length ?? 0,
    };
  });
};

/** Нажатие по карте: точка в нормализованных координатах и то, во что попали. */
export interface MapTap {
  /** Нормализованные координаты точки нажатия (0..1 от полотна). */
  x: number;
  y: number;
  /** Город под пальцем (для «передвинуть в город» и создания армии у города). */
  city: MapCity | null;
  /** Щит армии под пальцем — приоритетнее города. */
  army: MapArmy | null;
}
