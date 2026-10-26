/**
 * Сценарий раунда боя: правила уже посчитали попадания и потери, здесь из них
 * собирается ПОСЛЕДОВАТЕЛЬНОСТЬ шагов для показа игрокам.
 *
 * Модуль намеренно чистый (ни React, ни запросов, ни таймеров): шаги — данные,
 * их проигрывает `useScenePlayer`, рисует `board/*`. Благодаря этому раунд можно
 * промотать, проиграть заново и проверить тестом без устройства.
 *
 * Смысл шагов:
 *  - impact — бьющий отряд делает выпад, жертва вспыхивает, летит «−1»;
 *  - death  — жертва уезжает и гаснет;
 *  - round_end — плашка «Раунд N» с итогом.
 *
 * Пары «удар → смерть» собираются по числу попаданий: попадание убивает отряд
 * (см. `battleRules.isHit`), поэтому попаданий ровно столько же, сколько потерь
 * у противоположной стороны, и каждая потеря получает своего «бьющего».
 */
import type { TroopKind } from '../../../services/battleRules';
import type { BattleSide } from '../../hooks/useBattleLogic';

/** Базовые длительности шагов, мс. Делит на скорость проигрыватель. */
export const SCENE_DURATION = {
  impact: 340,
  death: 460,
  roundEnd: 620,
} as const;

/** Отряд в снапшоте раунда: всё, что нужно сцене и её текстам. */
export interface SceneTroop {
  uid: string;
  side: BattleSide;
  armyUid: string;
  armyName: string;
  troopName: string;
  kind: TroopKind;
  /** Эффективное значение кубика (бросок + модификатор армии + крепость). */
  value: number | null;
  hit: boolean;
}

interface SceneStepBase {
  id: string;
  at: number;
  duration: number;
  text: string;
}

export interface SceneImpactStep extends SceneStepBase {
  kind: 'impact';
  side: BattleSide;
  /** Бьющий отряд; null, если пары не нашлось (попаданий больше, чем отрядов). */
  strikerUid: string | null;
  strikerName: string | null;
  victimUid: string;
  victimName: string;
  value: number | null;
}

export interface SceneDeathStep extends SceneStepBase {
  kind: 'death';
  side: BattleSide;
  victimUid: string;
  victimName: string;
}

export interface SceneRoundEndStep extends SceneStepBase {
  kind: 'round_end';
  round: number;
}

export type SceneStep = SceneImpactStep | SceneDeathStep | SceneRoundEndStep;

/** Шаг без вычисленного `at` — то, что отдают сборщики. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type SceneStepDraft = DistributiveOmit<SceneStep, 'at'>;

export interface RoundSnapshot {
  round: number;
  attackers: SceneTroop[];
  defenders: SceneTroop[];
  hits: { attacker: number; defender: number };
  /** uid погибших отрядов по стороне жертвы (уже подтверждено мастером). */
  victims: { attacker: string[]; defender: string[] };
}

export interface RoundScene {
  steps: SceneStep[];
  totalDuration: number;
}

const sideTroops = (snapshot: RoundSnapshot, side: BattleSide): SceneTroop[] =>
  side === 'attacker' ? snapshot.attackers : snapshot.defenders;

const opposite = (side: BattleSide): BattleSide =>
  side === 'attacker' ? 'defender' : 'attacker';

/** «Попадание» без бьющего (попаданий больше, чем живых отрядов). */
const orphanImpactText = (victim: SceneTroop, value: number | null): string =>
  `Попадание${value === null ? '' : ` ${value}`} — ${victim.troopName} (${victim.armyName})`;

export const buildRoundScene = (snapshot: RoundSnapshot): RoundScene => {
  const steps: SceneStep[] = [];
  let at = 0;

  const push = (step: SceneStepDraft) => {
    steps.push({ ...step, at } as SceneStep);
    at += step.duration;
  };

  /**
   * Порядок показа: по одной потере с каждой стороны по очереди — так игрок
   * видит одновременный бой, а не «сначала все бьют, потом все умирают».
   * Внутри стороны — порядок попаданий (отряды идут в порядке карточек).
   */
  const victimSides: BattleSide[] = ['defender', 'attacker'];
  const maxVictims = Math.max(
    snapshot.victims.attacker.length,
    snapshot.victims.defender.length,
  );

  for (let index = 0; index < maxVictims; index += 1) {
    victimSides.forEach(victimSide => {
      const victimUid = snapshot.victims[victimSide][index];
      if (!victimUid) return;

      const victim = sideTroops(snapshot, victimSide).find(troop => troop.uid === victimUid);
      if (!victim) return;

      const strikerSide = opposite(victimSide);
      const strikers = sideTroops(snapshot, strikerSide).filter(troop => troop.hit);
      const striker = strikers[index] || null;

      push({
        id: `r${snapshot.round}-impact-${victimSide}-${index}`,
        kind: 'impact',
        duration: SCENE_DURATION.impact,
        side: strikerSide,
        strikerUid: striker?.uid ?? null,
        strikerName: striker ? `${striker.troopName} (${striker.armyName})` : null,
        victimUid: victim.uid,
        victimName: `${victim.troopName} (${victim.armyName})`,
        value: striker ? striker.value : null,
        text: striker
          ? `${striker.troopName} — ${striker.armyName}: ${striker.value ?? '—'} — попадание`
          : orphanImpactText(victim, null),
      });

      push({
        id: `r${snapshot.round}-death-${victimSide}-${index}`,
        kind: 'death',
        duration: SCENE_DURATION.death,
        side: victimSide,
        victimUid: victim.uid,
        victimName: victim.troopName,
        // Названия армий сами содержат скобки («Гарнизон (Сарай-Берке)»), а
        // «отряд уничтожен» не спорит с родом названия отряда.
        text: `${victim.troopName} — ${victim.armyName}: отряд уничтожен`,
      });
    });
  }

  const losses = snapshot.victims.attacker.length + snapshot.victims.defender.length;
  push({
    id: `r${snapshot.round}-end`,
    kind: 'round_end',
    duration: SCENE_DURATION.roundEnd,
    round: snapshot.round,
    text:
      losses === 0
        ? `Раунд ${snapshot.round}: попаданий нет`
        : `Раунд ${snapshot.round}: попадания ${snapshot.hits.attacker} — ${snapshot.hits.defender}, потери ${snapshot.victims.attacker.length} — ${snapshot.victims.defender.length}`,
  });

  return { steps, totalDuration: at };
};
