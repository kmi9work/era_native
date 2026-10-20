/**
 * Кубик к6 на фишке отряда: точки вместо цифры (читается на маленьком размере),
 * вращение во время броска, зелёная рамка при попадании.
 *
 * Вращение — Reanimated на UI-потоке: пока идёт волна бросков по всем отрядам,
 * JS занят расчётом попаданий, а кубики всё равно крутятся ровно.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Позиции точек в сетке 3×3. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

interface DieBadgeProps {
  value: number | null;
  spinning: boolean;
  hit?: boolean;
  /** Пушка не участвует в бросках — вместо кубика прочерк. */
  participates?: boolean;
  size?: number;
}

const DieBadge: React.FC<DieBadgeProps> = ({
  value,
  spinning,
  hit,
  participates = true,
  size = 26,
}) => {
  const spin = useSharedValue(0);

  useEffect(() => {
    if (spinning) {
      spin.value = 0;
      spin.value = withRepeat(
        withTiming(1, { duration: 520, easing: Easing.linear }),
        -1,
        false,
      );
      return;
    }
    cancelAnimation(spin);
    spin.value = withTiming(0, { duration: 140 });
  }, [spin, spinning]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  if (!participates) {
    return (
      <View style={[styles.badge, styles.badgeIdle, { width: size, height: size }]}>
        <Text style={[styles.idleText, { fontSize: Math.round(size * 0.5) }]}>—</Text>
      </View>
    );
  }

  const face = value === null || spinning ? null : value;
  const dots = face === null ? [] : PIPS[face] || [];

  return (
    <Animated.View
      style={[
        styles.badge,
        hit ? styles.badgeHit : null,
        { width: size, height: size, borderRadius: Math.round(size / 5) },
        animatedStyle,
      ]}
    >
      {face === null ? (
        <Text style={[styles.spinText, { fontSize: Math.round(size * 0.55) }]}>?</Text>
      ) : (
        <View style={styles.grid}>
          {Array.from({ length: 9 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.pip,
                {
                  width: Math.max(2, Math.round(size * 0.15)),
                  height: Math.max(2, Math.round(size * 0.15)),
                  borderRadius: Math.round(size * 0.08),
                },
                dots.includes(index) ? (hit ? styles.pipHit : styles.pipOn) : styles.pipOff,
              ]}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#90a4ae',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeHit: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  badgeIdle: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  idleText: {
    color: '#90a4ae',
    fontWeight: '700',
  },
  spinText: {
    color: '#546e7a',
    fontWeight: '700',
  },
  grid: {
    width: '72%',
    height: '72%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'space-between',
    justifyContent: 'space-between',
  },
  pip: {
    margin: 0.5,
  },
  pipOn: {
    backgroundColor: '#263238',
  },
  pipHit: {
    backgroundColor: '#1b5e20',
  },
  pipOff: {
    backgroundColor: 'transparent',
  },
});

export default DieBadge;
