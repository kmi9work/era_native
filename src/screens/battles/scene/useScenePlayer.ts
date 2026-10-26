/**
 * Проигрыватель сцены боя — единственный владелец времени на шаге «Бой».
 *
 * Работает по шагам из `scene/events.ts`: показывает шаг, ждёт его длительность,
 * переходит к следующему, в конце вызывает `onComplete` ровно один раз.
 * Ускорения показа нет: единственное управление временем — «Пропустить».
 * Ни `requestAnimationFrame`, ни `setInterval`: шаги на `setTimeout`, поэтому
 * сцена проверяется тестами через `advanceTimersByTime`.
 *
 * Почему один владелец: раньше потери применялись отдельным таймером в
 * `useBattleLogic`, а карточки анимировались своими — два источника времени
 * давали плавающий рассинхрон фазы и картинки.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SceneStep } from './events';

export interface ScenePlayerOptions {
  /** Вызывается один раз, когда последний шаг проигран или сцену пропустили. */
  onComplete?: () => void;
}

export interface ScenePlayer {
  steps: SceneStep[];
  /** Текущий шаг: -1 — сцена не начата, steps.length — завершена. */
  index: number;
  active: SceneStep | null;
  /** Шаги, которые уже случились (включая активный). */
  applied: SceneStep[];
  isPlaying: boolean;
  finished: boolean;
  start: (steps: SceneStep[]) => void;
  skip: () => void;
  reset: () => void;
}

export function useScenePlayer(options: ScenePlayerOptions = {}): ScenePlayer {
  const [steps, setSteps] = useState<SceneStep[]>([]);
  const [index, setIndex] = useState(-1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runRef = useRef(0);
  const doneRef = useRef(false);
  const stepsRef = useRef<SceneStep[]>([]);
  const completeRef = useRef<ScenePlayerOptions['onComplete']>(options.onComplete);
  completeRef.current = options.onComplete;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearTimer();
    completeRef.current?.();
  }, [clearTimer]);

  const schedule = useCallback(
    (list: SceneStep[], from: number, run: number) => {
      const step = list[from];
      if (!step) return;
      const duration = Math.max(40, Math.round(step.duration));
      timerRef.current = setTimeout(() => {
        if (runRef.current !== run) return;
        const next = from + 1;
        setIndex(next);
        if (next < list.length) {
          schedule(list, next, run);
        } else {
          finish();
        }
      }, duration);
    },
    [finish],
  );

  const start = useCallback(
    (next: SceneStep[]) => {
      runRef.current += 1;
      const run = runRef.current;
      clearTimer();
      doneRef.current = false;
      stepsRef.current = next;
      setSteps(next);
      if (next.length === 0) {
        setIndex(0);
        finish();
        return;
      }
      setIndex(0);
      schedule(next, 0, run);
    },
    [clearTimer, finish, schedule],
  );

  const skip = useCallback(() => {
    runRef.current += 1;
    clearTimer();
    setIndex(stepsRef.current.length);
    finish();
  }, [clearTimer, finish]);

  const reset = useCallback(() => {
    runRef.current += 1;
    clearTimer();
    doneRef.current = false;
    stepsRef.current = [];
    setSteps([]);
    setIndex(-1);
  }, [clearTimer]);

  const applied = useMemo(
    () => (index < 0 ? [] : steps.slice(0, Math.min(index + 1, steps.length))),
    [index, steps],
  );

  return {
    steps,
    index,
    active: index >= 0 && index < steps.length ? steps[index] : null,
    applied,
    isPlaying: index >= 0 && index < steps.length,
    finished: steps.length > 0 && index >= steps.length,
    start,
    skip,
    reset,
  };
}
