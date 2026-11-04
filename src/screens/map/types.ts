/**
 * Типы экрана «Карта»: город, сведённый из поселения, земли и государства.
 */
import type { Region, Settlement } from '../../types';

export interface MapCity {
  id: number;
  name: string;
  /** Нормализованные координаты на полотне (0..1). */
  x: number;
  y: number;
  /** Уровень крепости 0..3. */
  fortress: number;
  /** Столица (тип 2 или 4) — на карте рисуется короной. */
  capital: boolean;
  settlement: Settlement;
  region?: Region;
  country?: { id: number; name: string; short_name?: string } | null;
}

/** Состояние вида карты: масштаб и смещение полотна в точках экрана. */
export interface MapViewState {
  scale: number;
  tx: number;
  ty: number;
}
