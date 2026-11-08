/**
 * Символ отряда для панели армии и набора: имя типа с бэкенда → картинка.
 * Те же четыре PNG, что на экране «Сражения» (assets/detachments).
 */
import type { ImageSourcePropType } from 'react-native';
import { TROOP_IMAGE } from '../battles/troopImages';

export type TroopIconKind = 'infantry' | 'heavy_infantry' | 'cavalry' | 'cannon';

/** Тип отряда по названию с бэкенда («Тяжелая пехота», «Кавалерия», «Пушка»). */
export const troopKindByName = (name?: string | null): TroopIconKind => {
  const value = (name ?? '').toLowerCase();
  if (value.includes('пушк') || value.includes('осадн')) return 'cannon';
  if (value.includes('кавал') || value.includes('конниц') || value.includes('конн')) return 'cavalry';
  if (value.includes('тяж')) return 'heavy_infantry';
  return 'infantry';
};

export const troopImage = (name?: string | null): ImageSourcePropType =>
  TROOP_IMAGE[troopKindByName(name)];

/** Пушка — отдельный слот сверх трёх обычных отрядов (Army::CANNON_SLOTS). */
export const isCannonTroop = (name?: string | null): boolean => troopKindByName(name) === 'cannon';
