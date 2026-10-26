/**
 * Фишка отряда на сцене боя.
 *
 * Состояния фишки — это и есть «как в игре»:
 *  - бросок: кубик крутится, потом ложится точками;
 *  - удар (бьёт): короткий выпад в сторону противника;
 *  - попадание (бьют её): вспышка и дрожь;
 *  - потеря: фишка уезжает в свою сторону, уменьшается и гаснет;
 *  - выбор потери мастером: янтарная рамка.
 *
 * Всё движение — Reanimated, только transform/opacity, поэтому 20-30 фишек
 * анимируются без просадок, пока JS занят расчётом раунда.
 */
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { TroopKind } from '../../../services/battleRules';
import type { BattleSide } from '../../hooks/useBattleLogic';
import { TROOP_IMAGE } from '../troopImages';
import DieBadge from './DieBadge';
import type { BoardBox } from './layout';

export interface StageTroop {
  uid: string;
  side: BattleSide;
  armyUid: string;
  armyName: string;
  name: string;
  kind: TroopKind;
  raw: number | null;
  value: number | null;
  hit: boolean;
  spinning: boolean;
  /** Пушка в бросках не участвует, у неё нет кубика. */
  participates: boolean;
  modifier: number;
  fortressBonus: number;
}

interface TokenProps {
  troop: StageTroop;
  box: BoardBox;
  selected: boolean;
  dead: boolean;
  /** id шага сцены, в котором отряд бьёт; null — не бьёт. */
  strikeId: string | null;
  /** id шага сцены, в котором бьют этот отряд; null — не бьют. */
  struckId: string | null;
  onPress?: () => void;
}

const Token: React.FC<TokenProps> = ({
  troop,
  box,
  selected,
  dead,
  strikeId,
  struckId,
  onPress,
}) => {
  const lunge = useSharedValue(0);
  const flash = useSharedValue(0);
  const shake = useSharedValue(0);
  const fade = useSharedValue(1);
  const drop = useSharedValue(0);

  const direction = troop.side === 'attacker' ? 1 : -1;

  useEffect(() => {
    if (!strikeId) return;
    lunge.value = 0;
    lunge.value = withSequence(
      withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 230, easing: Easing.in(Easing.quad) }),
    );
  }, [lunge, strikeId]);

  useEffect(() => {
    if (!struckId) return;
    flash.value = 0;
    flash.value = withSequence(
      withTiming(1, { duration: 70 }),
      withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }),
    );
    shake.value = 0;
    shake.value = withSequence(
      withTiming(-5, { duration: 60 }),
      withTiming(5, { duration: 70 }),
      withTiming(0, { duration: 90 }),
    );
  }, [flash, shake, struckId]);

  useEffect(() => {
    if (!dead) return;
    fade.value = withTiming(0, { duration: 380, easing: Easing.in(Easing.cubic) });
    drop.value = withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) });
  }, [dead, drop, fade]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateX: shake.value },
      { translateY: lunge.value * direction * 16 + drop.value * -direction * 20 },
      { scale: 0.72 + 0.28 * fade.value },
    ],
  }));

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.65 }));

  const modifier = troop.modifier + troop.fortressBonus;
  const label = `${troop.name}, ${troop.armyName}${
    troop.participates ? '' : ', не участвует в бою'
  }`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!onPress || dead}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.wrapper, { left: box.x, top: box.y, width: box.size }]}
    >
      <Animated.View
        style={[
          styles.token,
          {
            width: box.size,
            height: box.size,
            borderRadius: box.size / 2,
          },
          troop.side === 'attacker' ? styles.tokenAttacker : styles.tokenDefender,
          troop.hit ? styles.tokenHit : null,
          selected ? styles.tokenSelected : null,
          dead ? styles.tokenDead : null,
          animatedStyle,
        ]}
      >
        <Image
          source={TROOP_IMAGE[troop.kind]}
          style={{ width: box.size * 0.62, height: box.size * 0.62, resizeMode: 'contain' }}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { borderRadius: box.size / 2 }, flashStyle]}
        />
      </Animated.View>

      {modifier !== 0 ? (
        <View style={[styles.modifier, modifier > 0 ? styles.modifierGood : styles.modifierBad]}>
          <Text style={styles.modifierText}>{modifier > 0 ? `+${modifier}` : modifier}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.dieSlot,
          {
            top: box.size - Math.round(box.size * 0.38),
            right: -Math.round(box.size * 0.1),
          },
        ]}
      >
        <DieBadge
          value={troop.raw}
          spinning={troop.spinning}
          hit={troop.hit}
          participates={troop.participates}
          size={Math.max(18, Math.round(box.size * 0.42))}
        />
      </View>

      {/* Ширина подписи — ровно колонка фишки: иначе названия соседних
          отрядов наезжают друг на друга и читаются как одно слово. */}
      <Text
        style={[styles.name, { width: box.size + 8, marginLeft: -4 }]}
        numberOfLines={2}
      >
        {troop.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
  },
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  tokenAttacker: {
    borderColor: '#c62828',
    backgroundColor: '#fdf1f1',
  },
  tokenDefender: {
    borderColor: '#1565c0',
    backgroundColor: '#eef4fb',
  },
  tokenHit: {
    borderColor: '#2e7d32',
  },
  tokenSelected: {
    borderColor: '#f9a825',
    borderWidth: 3,
    backgroundColor: '#fff8e1',
  },
  tokenDead: {
    borderStyle: 'dashed',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e53935',
  },
  modifier: {
    position: 'absolute',
    top: -4,
    left: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  modifierGood: {
    backgroundColor: '#2e7d32',
  },
  modifierBad: {
    backgroundColor: '#b71c1c',
  },
  modifierText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  dieSlot: {
    position: 'absolute',
    bottom: 14,
  },
  name: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 11,
    color: '#455a64',
    textAlign: 'center',
  },
});

export default Token;
