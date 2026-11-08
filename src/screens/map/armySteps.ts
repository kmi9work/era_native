/**
 * Шаги перемещения армии за год (правила заказчика).
 *
 * Само правило считает СЕРВЕР (`Army#steps_max`): база 7, с открытым
 * «Консервированием» 14, поправки по составу (тяжёлая пехота −1, кавалерия +2,
 * только кавалерия ещё +2, пушка −2). Клиент расчёт не повторяет — иначе две
 * копии правила разъедутся; он берёт из ответа `steps_max`/`steps_spent` и
 * работает только с остатком.
 *
 * Поля приходят в `/armies.json` (партиал `armies/_army.json.jbuilder`). На
 * бэкенде без этих полей блок шагов просто не показывается — экран не врёт
 * выдуманными числами.
 */
import type { Army } from '../../types';

export interface ArmySteps {
  /** Сколько шагов положено в этом году. */
  max: number;
  /** Сколько уже потрачено. */
  spent: number;
  /** Сколько осталось (0 — армия не может ходить, мастер может всё равно передвинуть). */
  left: number;
}

/** Шаги армии или `null`, если сервер их не отдал. */
export const armySteps = (army: Army | null | undefined): ArmySteps | null => {
  if (!army) return null;
  const max = Number(army.steps_max);
  if (!Number.isFinite(max) || max <= 0) return null;

  const params = (army.params ?? {}) as Record<string, unknown>;
  const raw = army.steps_spent ?? params.steps_spent ?? 0;
  const spent = Math.min(Math.max(Math.floor(Number(raw) || 0), 0), max);
  return { max, spent, left: Math.max(0, max - spent) };
};

/**
 * Сколько будет потрачено после хода на `spend` шагов. Больше максимума не
 * накопить: армия, которая ходит «сверх правила», просто считается вышедшей из
 * года (сервер точно так же ограничивает значение).
 */
export const stepsAfterSpend = (steps: ArmySteps, spend: number): number =>
  Math.min(steps.max, steps.spent + Math.max(0, Math.floor(spend)));

/** Подпись для панели армии: «осталось 4 из 7». */
export const stepsSummary = (steps: ArmySteps): string =>
  `осталось ${steps.left} из ${steps.max}`;

/** Варианты для кнопок «сколько шагов»: от 1 до максимума. */
export const stepChoices = (steps: ArmySteps): number[] =>
  Array.from({ length: steps.max }, (_, index) => index + 1);
