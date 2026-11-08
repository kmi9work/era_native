/**
 * Хранилище плана сражений, набранного на карте.
 *
 * План нужен ДВУМ экранам: «Карта» его набирает и показывает, «Сражения»
 * проигрывает по нему бои. Поэтому состояние живёт вне React-дерева (как
 * `queryClient`), а экраны подписываются через `useBattlePlan`.
 *
 * Готовый план «Сражения» забирают ОДИН раз при открытии (`getBattlePlan`):
 * дальше очередь боёв живёт в `useBattleLogic` и не должна меняться под руками.
 */
import { useSyncExternalStore } from 'react';
import type { PlannedBattle } from './battlePlan';

let plan: PlannedBattle[] = [];
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): PlannedBattle[] => plan;

export const getBattlePlan = (): PlannedBattle[] => plan;

export const setBattlePlan = (next: PlannedBattle[]): void => {
  plan = next;
  emit();
};

export const clearBattlePlan = (): void => {
  if (plan.length === 0) return;
  setBattlePlan([]);
};

/** Подписка экрана на план: перерисовка при каждом изменении. */
export const useBattlePlan = (): PlannedBattle[] =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
