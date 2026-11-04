/**
 * Оформление экрана «Карта»: цвета, размеры, правила вида маркера.
 *
 * Маркеры — плоские круги цвета крепости с белой башней (город) или короной
 * (столица). Правила и обоснование — eraofchange/docs/map/TZ-karta.md, § 4.4/§ 4.6.
 */
import type { Settlement } from '../../types';

/** Логический размер полотна карты: координаты map_x/map_y умножаются на него. */
export const MAP_BASE_SIZE = 1000;

/** Цвета маркеров по уровню крепости: 0 нет, 1 форт, 2 крепость, 3 кремль. */
export const FORTRESS_COLORS = ['#1f1f1f', '#8b5a2b', '#2f6fb5', '#b3382c'];

/** Подписи для легенды и панели. */
export const FORTRESS_NAMES = ['без крепости', 'форт', 'крепость', 'кремль'];

/** Маркер на экране: не мельче 20 dp и не крупнее 34 dp (растёт с зумом). */
export const MARKER_MIN_DP = 20;
export const MARKER_MAX_DP = 34;

/** Подпись города: экранный кегль и границы. */
export const LABEL_MIN_DP = 9;
export const LABEL_MAX_DP = 11;
/** Во сколько раз кегль исходника увеличиваем на экране (до потолка LABEL_MAX_DP). */
export const LABEL_SCALE_FACTOR = 1.5;
/** Подписи с кеглем исходника ниже этого прячутся на мелком зуме (LOD). */
export const LABEL_ALWAYS_FONT = 30;
/** Во сколько раз относительно «вписана» показываются все подписи. */
export const LABEL_ALL_ZOOM = 1.35;

export const MAP_COLORS = {
  /** Фон вокруг карты (тёмное дерево/пергамент). */
  background: '#17140f',
  /** Панель и кнопки. */
  surface: '#241f18',
  surfaceRaised: '#2e281f',
  border: '#4a4033',
  text: '#f3e9d6',
  textMuted: '#b7a98f',
  accent: '#c9a227',
  /** Цвет подписи города на карте (как на печатной карте) и её ореол. */
  label: '#241c12',
  labelHalo: 'rgba(248,241,226,0.85)',
  /** Полупрозрачная подложка шапки. */
  header: 'rgba(23,20,15,0.82)',
};

/** Уровень крепости поселения (0..3). */
export const fortressLevelOf = (settlement: Settlement): number => {
  const level = Number(settlement.fortress_level ?? 0);
  return Number.isFinite(level) ? Math.min(3, Math.max(0, level)) : 0;
};

/** Столица — тип 2 «Столица» или 4 «Столичная земля» (решение заказчика). */
export const isCapitalSettlement = (settlement: Settlement): boolean =>
  settlement.settlement_type_id === 2 || settlement.settlement_type_id === 4;

/** Цвет маркера по уровню крепости. */
export const markerColor = (level: number): string => FORTRESS_COLORS[level] || FORTRESS_COLORS[0];

/** Подпись уровня крепости для панели и легенды. */
export const fortressLabel = (level: number): string =>
  level > 0 ? `${FORTRESS_NAMES[level]} ${level} ур.` : FORTRESS_NAMES[0];
