/**
 * Тесты сцены боя: сборка шагов раунда, раскладка фишек и проигрыватель.
 *
 * Всё это — чистые функции и один таймер, поэтому проверяется без устройства:
 * порядок «удар → смерть», длительности, раскладка на узком и широком экране,
 * переполнение, скорость показа и «Пропустить».
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  buildRoundScene,
  SCENE_DURATION,
  sceneDuration,
  type RoundSnapshot,
  type SceneStep,
} from '../src/screens/battles/scene/events';
import { computeBoardLayout } from '../src/screens/battles/board/layout';
import {
  useScenePlayer,
  type ScenePlayer,
} from '../src/screens/battles/scene/useScenePlayer';

const troop = (
  uid: string,
  side: 'attacker' | 'defender',
  name: string,
  value: number,
  hit: boolean,
) => ({
  uid,
  side,
  armyUid: `${side}-army`,
  armyName: side === 'attacker' ? 'Вологские' : 'Тверь',
  troopName: name,
  kind: 'infantry' as const,
  value,
  hit,
});

const snapshot = (overrides: Partial<RoundSnapshot> = {}): RoundSnapshot => ({
  round: 2,
  attackers: [troop('a1', 'attacker', 'Конница', 5, true)],
  defenders: [troop('d1', 'defender', 'Пехота', 3, false)],
  hits: { attacker: 1, defender: 0 },
  victims: { attacker: [], defender: ['d1'] },
  ...overrides,
});

describe('сцена раунда', () => {
  it('собирает пары «удар → смерть» и завершает раунд', () => {
    const scene = buildRoundScene(snapshot());

    expect(scene.steps.map(step => step.kind)).toEqual(['impact', 'death', 'round_end']);
    const [impact, death, end] = scene.steps;

    expect(impact.kind === 'impact' && impact.strikerUid).toBe('a1');
    expect(impact.text).toContain('Конница');
    expect(impact.text).toContain('попадание');
    expect(impact.at).toBe(0);

    expect(death.text).toContain('Пехота');
    expect(death.text).toContain('уничтожен');
    expect(death.at).toBe(SCENE_DURATION.impact);

    expect(end.kind === 'round_end' && end.round).toBe(2);
    expect(scene.totalDuration).toBe(
      SCENE_DURATION.impact + SCENE_DURATION.death + SCENE_DURATION.roundEnd,
    );
  });

  it('чередует стороны: по одной потере с каждой стороны подряд', () => {
    const scene = buildRoundScene(
      snapshot({
        hits: { attacker: 1, defender: 1 },
        attackers: [troop('a1', 'attacker', 'Конница', 6, true)],
        defenders: [troop('d1', 'defender', 'Пехота', 5, true)],
        victims: { attacker: ['a1'], defender: ['d1'] },
      }),
    );

    expect(scene.steps.map(step => step.kind)).toEqual([
      'impact',
      'death',
      'impact',
      'death',
      'round_end',
    ]);
    // Первой показывается потеря защищающихся — её бьёт атакующий.
    const first = scene.steps[0];
    expect(first.kind === 'impact' && first.side).toBe('attacker');
    const third = scene.steps[2];
    expect(third.kind === 'impact' && third.side).toBe('defender');
  });

  it('без потерь остаётся только итог раунда', () => {
    const scene = buildRoundScene(
      snapshot({
        hits: { attacker: 0, defender: 0 },
        defenders: [troop('d1', 'defender', 'Пехота', 1, false)],
        victims: { attacker: [], defender: [] },
      }),
    );

    expect(scene.steps).toHaveLength(1);
    expect(scene.steps[0].text).toContain('попаданий нет');
  });

  it('скорость сокращает длительность сцены', () => {
    const scene = buildRoundScene(snapshot());
    expect(sceneDuration(scene, 1)).toBe(scene.totalDuration);
    expect(sceneDuration(scene, 2)).toBe(Math.round(scene.totalDuration / 2));
  });
});

describe('раскладка сцены', () => {
  const attackers = ['a1', 'a2', 'a3'];
  const defenders = ['d1', 'd2', 'd3'];

  it('ставит стороны по разные стороны центра и внутри экрана', () => {
    const layout = computeBoardLayout({
      width: 390,
      height: 780,
      attackers,
      defenders,
    });

    expect(layout.boxes).toHaveLength(6);
    expect(layout.overflow).toEqual({ attacker: 0, defender: 0 });

    layout.boxes.forEach(box => {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.size).toBeLessThanOrEqual(390);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.size).toBeLessThanOrEqual(780);
    });

    const attackerBoxes = layout.boxes.filter(box => box.side === 'attacker');
    const defenderBoxes = layout.boxes.filter(box => box.side === 'defender');
    // Передний ряд атакующих — ближе к центру: ниже всех в своей полосе.
    attackerBoxes.forEach(box => {
      expect(box.y + box.size).toBeLessThanOrEqual(layout.bands.center.top);
    });
    // Защищающиеся начинаются ниже центральной полосы.
    defenderBoxes.forEach(box => {
      expect(box.y).toBeGreaterThanOrEqual(layout.bands.center.top + layout.bands.center.height);
    });
  });

  it('на планшете не сужает фишки', () => {
    const many = Array.from({ length: 8 }, (_, index) => `t${index}`);
    const layout = computeBoardLayout({
      width: 1024,
      height: 768,
      attackers: many,
      defenders: many,
    });
    expect(layout.tokenSize).toBe(64);
    expect(layout.perRow).toBeGreaterThanOrEqual(8);
    expect(layout.overflow).toEqual({ attacker: 0, defender: 0 });
  });

  it('на узком экране с большими армиями сообщает переполнение', () => {
    const many = Array.from({ length: 30 }, (_, index) => `u${index}`);
    const layout = computeBoardLayout({
      width: 300,
      height: 420,
      attackers: many,
      defenders: many,
      minToken: 34,
    });

    expect(layout.tokenSize).toBeLessThanOrEqual(64);
    expect(layout.overflow.attacker).toBeGreaterThan(0);
    expect(layout.overflow.defender).toBeGreaterThan(0);
    // Показаны только те, кто влез: остальные уходят в счётчик «+N».
    expect(layout.boxes.length).toBeLessThan(60);
  });

  it('крепость добавляет стену и сдвигает защищающихся вниз', () => {
    const withWall = computeBoardLayout({
      width: 390,
      height: 780,
      attackers,
      defenders,
      fortressLevel: 2,
    });
    const withoutWall = computeBoardLayout({ width: 390, height: 780, attackers, defenders });

    expect(withWall.wall).not.toBeNull();
    expect(withoutWall.wall).toBeNull();
    const defenderTop = (layout: typeof withWall) =>
      Math.min(...layout.boxes.filter(box => box.side === 'defender').map(box => box.y));
    expect(defenderTop(withWall)).toBeGreaterThan(defenderTop(withoutWall));
  });
});

const renderPlayer = () => {
  const result: { current: ScenePlayer } = { current: undefined as unknown as ScenePlayer };
  const onComplete = jest.fn();
  const Component = () => {
    result.current = useScenePlayer({ onComplete });
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
    onComplete,
    unmount: () => act(() => tree.unmount()),
  };
};

const steps = (): SceneStep[] => buildRoundScene(snapshot()).steps;

describe('проигрыватель сцены', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('идёт по шагам и в конце один раз зовёт onComplete', () => {
    const player = renderPlayer();

    act(() => player.current.start(steps()));
    expect(player.current.index).toBe(0);
    expect(player.current.active?.kind).toBe('impact');

    act(() => {
      jest.advanceTimersByTime(SCENE_DURATION.impact);
    });
    expect(player.current.index).toBe(1);
    expect(player.current.active?.kind).toBe('death');

    act(() => {
      jest.advanceTimersByTime(SCENE_DURATION.death + SCENE_DURATION.roundEnd);
    });
    expect(player.current.finished).toBe(true);
    expect(player.onComplete).toHaveBeenCalledTimes(1);

    player.unmount();
  });

  it('«Пропустить» доводит сцену до конца сразу', () => {
    const player = renderPlayer();
    act(() => player.current.start(steps()));
    act(() => player.current.skip());

    expect(player.current.finished).toBe(true);
    expect(player.onComplete).toHaveBeenCalledTimes(1);

    // Таймеры после пропуска не должны звать onComplete ещё раз.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(player.onComplete).toHaveBeenCalledTimes(1);

    player.unmount();
  });

  it('скорость x2 сокращает шаг вдвое', () => {
    const player = renderPlayer();
    act(() => player.current.setSpeed(2));
    act(() => player.current.start(steps()));
    act(() => {
      jest.advanceTimersByTime(Math.round(SCENE_DURATION.impact / 2));
    });
    expect(player.current.index).toBe(1);
    player.unmount();
  });
});
