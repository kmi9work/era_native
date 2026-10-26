/**
 * Тесты сцены боя: сборка шагов раунда, раскладка фишек и проигрыватель.
 *
 * Всё это — чистые функции и один таймер, поэтому проверяется без устройства:
 * порядок «удар → смерть», длительности, раскладка на узком и широком экране,
 * блоки армий, переполнение и «Пропустить».
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  buildRoundScene,
  SCENE_DURATION,
  type RoundSnapshot,
  type SceneStep,
} from '../src/screens/battles/scene/events';
import { computeBoardLayout } from '../src/screens/battles/board/layout';
import HitCounter from '../src/screens/battles/board/HitCounter';
import {
  useScenePlayer,
  type ScenePlayer,
} from '../src/screens/battles/scene/useScenePlayer';

/** Тексты из поддерева: у Text бывает несколько детей-строк. */
const collectText = (node: any, acc: string[] = []): string[] => {
  if (node == null) return acc;
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach(child => collectText(child, acc));
    return acc;
  }
  if (node.children) collectText(node.children, acc);
  return acc;
};

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

  it('каждая армия получает свою рамку с подписью', () => {
    const layout = computeBoardLayout({
      width: 1024,
      height: 768,
      attackers: [],
      defenders: [],
      attackerGroups: [
        { uid: 'a-1', label: 'Вологские', uids: ['a1', 'a2'] },
        { uid: 'a-2', label: 'Казанцы', uids: ['a3'] },
      ],
      defenderGroups: [{ uid: 'd-1', label: 'Гарнизон (Тверь)', uids: ['d1', 'd2'] }],
    });

    // По рамке на армию: две у нападающих, одна у защищающихся.
    expect(layout.groups).toHaveLength(3);
    const attackerFrames = layout.groups.filter(frame => frame.side === 'attacker');
    expect(attackerFrames.map(frame => frame.label)).toEqual(['Вологские', 'Казанцы']);

    // Отряд знает свою армию, и его фишка стоит внутри рамки этой армии.
    const frames = new Map(layout.groups.map(frame => [frame.uid, frame]));
    layout.boxes.forEach(box => {
      const frame = frames.get(box.armyUid)!;
      expect(frame).toBeDefined();
      expect(box.side).toBe(frame.side);
      expect(box.x).toBeGreaterThanOrEqual(frame.x);
      expect(box.x + box.size).toBeLessThanOrEqual(frame.x + frame.width);
      expect(box.y).toBeGreaterThanOrEqual(frame.y);
      // Название отряда живёт под фишкой — внутри той же рамки.
      expect(box.y + box.size).toBeLessThanOrEqual(frame.y + frame.height);
    });

    // Рамки не налезают друг на друга — ни в строке, ни между строками.
    layout.groups.forEach((frame, index) => {
      layout.groups.slice(index + 1).forEach(other => {
        const apart =
          frame.x + frame.width <= other.x ||
          other.x + other.width <= frame.x ||
          frame.y + frame.height <= other.y ||
          other.y + other.height <= frame.y;
        expect(apart).toBe(true);
      });
    });
  });

  it('армии идут в строку друг за другом и переносятся, когда не влезают', () => {
    // Три армии по одному отряду на широком экране — все в одной строке.
    const wide = computeBoardLayout({
      width: 1024,
      height: 768,
      attackers: [],
      defenders: [],
      attackerGroups: [
        { uid: 'a-1', label: 'Первая', uids: ['a1'] },
        { uid: 'a-2', label: 'Вторая', uids: ['a2'] },
        { uid: 'a-3', label: 'Третья', uids: ['a3'] },
      ],
      defenderGroups: [{ uid: 'd-1', label: 'Защитники', uids: ['d1'] }],
    });
    const wideFrames = wide.groups.filter(frame => frame.side === 'attacker');
    expect(new Set(wideFrames.map(frame => frame.y)).size).toBe(1);
    // Блоки стоят слева направо в порядке армий.
    expect(wideFrames[0].x).toBeLessThan(wideFrames[1].x);
    expect(wideFrames[1].x).toBeLessThan(wideFrames[2].x);

    // Узкий экран: те же армии переносятся на следующую строку.
    const narrow = computeBoardLayout({
      width: 300,
      height: 760,
      attackers: [],
      defenders: [],
      attackerGroups: [
        { uid: 'a-1', label: 'Первая', uids: ['a1', 'a2', 'a3', 'a4'] },
        { uid: 'a-2', label: 'Вторая', uids: ['a5', 'a6', 'a7', 'a8'] },
      ],
      defenderGroups: [{ uid: 'd-1', label: 'Защитники', uids: ['d1'] }],
      minToken: 34,
    });
    const narrowFrames = narrow.groups.filter(frame => frame.side === 'attacker');
    expect(narrowFrames).toHaveLength(2);
    // Вторая армия ушла ниже первой.
    expect(narrowFrames[1].y).toBeGreaterThan(narrowFrames[0].y);
    expect(narrowFrames[1].x).toBeLessThanOrEqual(narrowFrames[0].x);
  });

  it('колонка счётчиков не отбирается фишками', () => {
    const layout = computeBoardLayout({
      width: 390,
      height: 780,
      attackers,
      defenders,
      gutter: 60,
    });

    expect(layout.gutter).toBe(60);
    layout.boxes.forEach(box => {
      expect(box.x).toBeGreaterThanOrEqual(72);
      expect(box.x + box.size).toBeLessThanOrEqual(390);
    });
    // Фишки те же, а места под них меньше — переполнения по-прежнему нет.
    expect(layout.boxes).toHaveLength(6);
    expect(layout.overflow).toEqual({ attacker: 0, defender: 0 });
  });

  it('армия, которая не влезла в полосу, показывает «+N» в своей рамке', () => {
    const many = (prefix: string) => Array.from({ length: 12 }, (_, index) => `${prefix}${index}`);
    const layout = computeBoardLayout({
      width: 390,
      height: 320,
      attackers: [],
      defenders: [],
      attackerGroups: [
        { uid: 'a-1', label: 'Вологские', uids: many('a') },
        { uid: 'a-2', label: 'Казанцы', uids: many('b') },
      ],
      defenderGroups: [{ uid: 'd-1', label: 'Гарнизон', uids: ['d1'] }],
      minToken: 34,
    });

    const attackerFrames = layout.groups.filter(frame => frame.side === 'attacker');
    expect(attackerFrames.length).toBeGreaterThan(0);
    expect(layout.overflow.attacker).toBeGreaterThan(0);
    attackerFrames.forEach(frame => {
      expect(frame.visible).toBeLessThanOrEqual(frame.total);
    });
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

describe('счётчик попаданий', () => {
  const renderCounter = (count: number, band = { top: 0, height: 300 }) => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <HitCounter count={count} side="attacker" band={band} gutter={64} />,
      );
    });
    return tree!;
  };

  it('показывает крупное число и подпись', () => {
    const tree = renderCounter(3);
    const texts = tree.root
      .findAllByType(Text)
      .map(node => collectText(node.props.children).join(''));
    expect(texts).toContain('3');
    expect(texts).toContain('попаданий');
    // Цифра читается с другого конца стола: не мельче 26 dp при колонке 64.
    const number = tree.root.findAllByType(Text).find(node =>
      collectText(node.props.children).join('') === '3',
    );
    const size = StyleSheet.flatten(number!.props.style).fontSize as number;
    expect(size).toBeGreaterThanOrEqual(26);
    act(() => tree.unmount());
  });

  it('ноль попаданий показан приглушённо, но на месте', () => {
    const tree = renderCounter(0);
    const texts = tree.root
      .findAllByType(Text)
      .map(node => collectText(node.props.children).join(''));
    expect(texts).toContain('0');
    act(() => tree.unmount());
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

  it('шаги идут ровно своей длительностью — ускорения показа нет', () => {
    const player = renderPlayer();
    act(() => player.current.start(steps()));
    // Половины шага недостаточно: шаг длится столько, сколько заявлено.
    act(() => {
      jest.advanceTimersByTime(Math.round(SCENE_DURATION.impact / 2));
    });
    expect(player.current.index).toBe(0);
    act(() => {
      jest.advanceTimersByTime(SCENE_DURATION.impact);
    });
    expect(player.current.index).toBe(1);
    player.unmount();
  });
});
