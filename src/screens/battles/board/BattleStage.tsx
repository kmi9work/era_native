/**
 * Сцена боя: фон, город/крепость, армии, фишки отрядов и эффекты удара.
 *
 * Размеры приходят из `onLayout` и уходят в чистую `computeBoardLayout` — на
 * телефоне, планшете и в ландшафте раскладка разная, координат в коде нет.
 *
 * Что читается из логики:
 *  - армии и их отряды (`battleArmies`, `troopView`): каждая армия — отдельная
 *    рамка с подписью, чтобы принадлежность отряда армии была видна сразу;
 *  - выбранные мастером потери (`victims`) — для подсветки;
 *  - попадания раунда (`hits`) — крупными цифрами у полос той стороны,
 *    в которую попали;
 *  - проигранные шаги сцены (`scene.applied`) — кто уже погиб;
 *  - активный шаг (`scene.active`) — кто бьёт и кого бьют прямо сейчас.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { BattleArmy, BattleLogic, BattleSide } from '../../hooks/useBattleLogic';
import ImpactEffects from './Effects';
import HitCounter from './HitCounter';
import Token, { type StageTroop } from './Token';
import { computeBoardLayout, type BoardGroup } from './layout';

const CITY_BLOCKS = [0.16, 0.22, 0.14, 0.26, 0.18];
/** Левая колонка под крупные счётчики попаданий: не уже 56 и не шире 96 dp. */
const GUTTER_MIN = 56;
const GUTTER_MAX = 96;

/** Плашка «Раунд N» в конце сцены: пауза между раундами, видимая игрокам. */
const RoundBanner: React.FC<{ round: number; duration: number }> = ({ round, duration }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: Math.max(320, duration) });
  }, [duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value < 0.15 ? progress.value / 0.15 : 1 - (progress.value - 0.15) / 0.85,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.banner, animatedStyle]}>
      <Text style={styles.bannerText}>Раунд {round}</Text>
    </Animated.View>
  );
};

/** Первый кадр до `onLayout`: примерный размер окна, чтобы сцена не мигала пустотой. */
const initialSize = () => {
  const window = Dimensions.get('window');
  return { width: window.width, height: Math.round(window.height * 0.5) };
};

/** Армия на сцене → блок с подписью: по ней видно, чьи это отряды. */
const groupsFor = (armies: BattleArmy[]): BoardGroup[] =>
  armies
    .filter(army => !army.retreated && army.troops.length > 0)
    .map(army => ({
      uid: army.uid,
      label: army.name,
      uids: army.troops.map(troop => troop.uid),
    }));

const BattleStage: React.FC<{ logic: BattleLogic }> = ({ logic }) => {
  const [size, setSize] = useState(initialSize);
  const { battleArmies, troopView, placeKind, fortressLevel, scene } = logic;
  const applied = scene.applied;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(prev =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const troops: StageTroop[] = useMemo(() => {
    const list: StageTroop[] = [];
    battleArmies.forEach(army => {
      if (army.retreated) return;
      army.troops.forEach(troop => {
        const view = troopView(army, troop);
        list.push({
          uid: troop.uid,
          side: army.side,
          armyUid: army.uid,
          armyName: army.name,
          name: troop.name,
          kind: troop.kind,
          raw: view.raw,
          value: view.value,
          hit: view.isHit,
          spinning: view.spinning,
          participates: view.participates,
          modifier: view.modifier,
          fortressBonus: view.fortressBonus,
        });
      });
    });
    return list;
  }, [battleArmies, troopView]);

  const attackerGroups = useMemo(
    () => groupsFor(battleArmies.filter(army => army.side === 'attacker')),
    [battleArmies],
  );
  const defenderGroups = useMemo(
    () => groupsFor(battleArmies.filter(army => army.side === 'defender')),
    [battleArmies],
  );

  const gutter = Math.min(GUTTER_MAX, Math.max(GUTTER_MIN, Math.round(size.width * 0.09)));

  const layout = useMemo(
    () =>
      computeBoardLayout({
        width: size.width,
        height: size.height,
        attackers: troops.filter(troop => troop.side === 'attacker').map(troop => troop.uid),
        defenders: troops.filter(troop => troop.side === 'defender').map(troop => troop.uid),
        attackerGroups,
        defenderGroups,
        fortressLevel: placeKind === 'city' ? fortressLevel : 0,
        gutter,
      }),
    [attackerGroups, defenderGroups, fortressLevel, gutter, placeKind, size.height, size.width, troops],
  );

  const boxesByUid = useMemo(
    () => new Map(layout.boxes.map(box => [box.uid, box])),
    [layout.boxes],
  );

  const deadUids = useMemo(() => {
    const set = new Set<string>();
    applied.forEach(step => {
      if (step.kind === 'death') set.add(step.victimUid);
    });
    return set;
  }, [applied]);

  const active = scene.active;
  const impact = active && active.kind === 'impact' ? active : null;
  const victimBox = impact ? boxesByUid.get(impact.victimUid) : undefined;

  /** Попадания, полученные стороной: их нанесли отряды противоположной. */
  const incomingHits = (side: BattleSide): number =>
    side === 'attacker' ? logic.hits.defender : logic.hits.attacker;

  const retreated = logic.battleArmies.filter(army => army.retreated);
  /**
   * Счётчики нужны там, где попадания этого раунда ещё «в силе»: выбор потерь и
   * проигрывание сцены. В отступлении попадания уже применены и обнулены.
   */
  const showCounters = logic.phase === 'casualties' || logic.phase === 'playing';

  return (
    <View style={styles.stage} onLayout={onLayout}>
      <View style={styles.sky} />
      <View style={[styles.ground, { top: layout.groundY }]} />

      {placeKind === 'city' ? (
        <View
          style={[
            styles.city,
            {
              top:
                layout.bands.center.top +
                Math.max(0, Math.round((layout.bands.center.height - 44) / 2)) -
                6,
            },
          ]}
        >
          {CITY_BLOCKS.map((share, index) => (
            <View
              key={index}
              style={[
                styles.cityBlock,
                {
                  width: `${share * 100}%`,
                  height: 18 + ((index * 7) % 20),
                  marginRight: 3,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {layout.wall ? (
        <View
          style={[
            styles.wall,
            {
              left: layout.wall.x,
              top: layout.wall.y,
              width: layout.wall.width,
              height: layout.wall.height,
            },
          ]}
        >
          {Array.from({ length: Math.max(4, Math.floor(layout.wall.width / 26)) }).map(
            (_, index) => (
              <View key={index} style={styles.merlon} />
            ),
          )}
        </View>
      ) : null}

      {size.width > 0 && troops.length === 0 ? (
        <Text style={styles.empty}>На сцене нет отрядов</Text>
      ) : null}

      {/* Рамки армий: под фишками, чтобы мастер видел, чьи это отряды. */}
      {layout.groups.map(group => (
        <View
          key={`${group.side}-${group.uid}`}
          pointerEvents="none"
          style={[
            styles.group,
            group.side === 'attacker' ? styles.groupAttacker : styles.groupDefender,
            {
              left: group.x,
              top: group.y,
              width: group.width,
              height: group.height,
            },
          ]}
        >
          {group.label ? (
            <View
              style={[
                styles.groupLabelBox,
                group.side === 'attacker' ? styles.groupLabelAttacker : styles.groupLabelDefender,
              ]}
            >
              <Text
                style={[
                  styles.groupLabel,
                  group.side === 'attacker' ? styles.groupLabelTextAttacker : styles.groupLabelTextDefender,
                ]}
                numberOfLines={1}
              >
                {group.label}
                {group.visible < group.total ? ` +${group.total - group.visible}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      ))}

      {showCounters ? (
        <>
          <HitCounter
            count={incomingHits('attacker')}
            side="attacker"
            band={layout.bands.attacker}
            gutter={layout.gutter}
          />
          <HitCounter
            count={incomingHits('defender')}
            side="defender"
            band={layout.bands.defender}
            gutter={layout.gutter}
          />
        </>
      ) : null}

      {troops.map(troop => {
        const box = boxesByUid.get(troop.uid);
        if (!box) return null;
        const selectable = logic.phase === 'casualties' && incomingHits(troop.side) > 0;
        return (
          <Token
            key={troop.uid}
            troop={troop}
            box={box}
            selected={logic.victims[troop.side].includes(troop.uid)}
            dead={deadUids.has(troop.uid)}
            strikeId={impact && impact.strikerUid === troop.uid ? impact.id : null}
            struckId={impact && impact.victimUid === troop.uid ? impact.id : null}
            onPress={
              selectable ? () => logic.toggleVictim(troop.side, troop.uid) : undefined
            }
          />
        );
      })}

      {impact && victimBox ? (
        <ImpactEffects
          key={impact.id}
          x={victimBox.x + victimBox.size / 2}
          y={victimBox.y}
          size={victimBox.size}
          text="−1"
          duration={impact.duration}
          effectKey={impact.id}
        />
      ) : null}

      {active && active.kind === 'round_end' ? (
        <RoundBanner key={active.id} round={active.round} duration={active.duration} />
      ) : null}

      {layout.overflow.attacker > 0 ? (
        <Text
          style={[
            styles.overflow,
            { top: layout.bands.attacker.top + 2, left: layout.gutter + 16 },
          ]}
        >
          +{layout.overflow.attacker} вне сцены
        </Text>
      ) : null}
      {layout.overflow.defender > 0 ? (
        <Text
          style={[
            styles.overflow,
            {
              top: layout.bands.defender.top + layout.bands.defender.height - 18,
              left: layout.gutter + 16,
            },
          ]}
        >
          +{layout.overflow.defender} вне сцены
        </Text>
      ) : null}

      {retreated.length > 0 ? (
        <Text style={[styles.retreated, { top: layout.bands.center.top + 2 }]}>
          отступили: {retreated.map(army => army.name).join(', ')}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#eef3f8',
  },
  sky: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eaf1f8',
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#e7eee1',
    borderTopWidth: 1,
    borderTopColor: '#d7e0cd',
  },
  city: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  cityBlock: {
    backgroundColor: '#cfd8dc',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    opacity: 0.75,
  },
  wall: {
    position: 'absolute',
    backgroundColor: '#c3b8a3',
    borderColor: '#a99e88',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  merlon: {
    width: 8,
    height: 6,
    backgroundColor: '#a99e88',
  },
  group: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
  },
  groupAttacker: {
    borderColor: 'rgba(198, 40, 40, 0.35)',
    backgroundColor: 'rgba(198, 40, 40, 0.05)',
  },
  groupDefender: {
    borderColor: 'rgba(21, 101, 192, 0.35)',
    backgroundColor: 'rgba(21, 101, 192, 0.05)',
  },
  groupLabelBox: {
    position: 'absolute',
    top: -1,
    left: 4,
    maxWidth: '96%',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  groupLabelAttacker: {
    backgroundColor: '#fff5f5',
    borderColor: 'rgba(198, 40, 40, 0.35)',
  },
  groupLabelDefender: {
    backgroundColor: '#f3f8fe',
    borderColor: 'rgba(21, 101, 192, 0.35)',
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  groupLabelTextAttacker: {
    color: '#b71c1c',
  },
  groupLabelTextDefender: {
    color: '#0d47a1',
  },
  empty: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    fontSize: 12,
    color: '#90a4ae',
  },
  overflow: {
    position: 'absolute',
    fontSize: 10,
    color: '#78909c',
  },
  retreated: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 10,
    color: '#8d6e63',
    fontWeight: '600',
  },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    top: '46%',
    backgroundColor: 'rgba(38, 50, 56, 0.86)',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  bannerText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
});

export default BattleStage;
