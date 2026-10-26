/**
 * Крупный счётчик попаданий у строя стороны.
 *
 * Зачем: попадания — главное число раунда, и раньше они тонули мелкой строкой
 * в табло. Теперь у полосы той стороны, В КОТОРУЮ попали, стоит большая цифра:
 * мастер видит, сколько отрядов этой стороны обязано умереть, не отводя глаз
 * от фишек.
 *
 * Счётчик живёт в левой колонке сцены (`layout.gutter`), поэтому не
 * перекрывает фишки и не мешает касаниям. Появление новой цифры сопровождается
 * коротким «поп»-масштабом: цифра заметна, но не превращается в аттракцион.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { BattleSide } from '../../hooks/useBattleLogic';
import type { BoardBand } from './layout';

interface HitCounterProps {
  /** Сколько попаданий получила эта сторона. */
  count: number;
  side: BattleSide;
  /** Полоса стороны: счётчик центрируется по её высоте. */
  band: BoardBand;
  /** Ширина колонки, зарезервированной раскладкой. */
  gutter: number;
}

const HitCounter: React.FC<HitCounterProps> = ({ count, side, band, gutter }) => {
  const pop = useSharedValue(0);

  // Новое число — короткий удар масштабом: глаз цепляется за изменение.
  useEffect(() => {
    pop.value = 0;
    pop.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );
  }, [count, pop]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pop.value * 0.22 }],
  }));

  const width = Math.max(0, gutter - 8);
  if (width <= 0) return null;

  const height = Math.max(44, Math.min(104, band.height - 8));
  const filled = count > 0;
  const attacker = side === 'attacker';

  return (
    <View
      pointerEvents="none"
      style={[
        styles.slot,
        {
          width,
          top: band.top + Math.max(0, Math.round((band.height - height) / 2)),
          height,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.chip,
          attacker ? styles.chipAttacker : styles.chipDefender,
          filled ? null : styles.chipEmpty,
          animatedStyle,
        ]}
      >
        <Text
          style={[
            styles.count,
            { fontSize: Math.max(26, Math.min(52, Math.round(width * 0.62))) },
            attacker ? styles.countAttacker : styles.countDefender,
            filled ? null : styles.countEmpty,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Попаданий по ${attacker ? 'атакующим' : 'защищающимся'}: ${count}`}
        >
          {count}
        </Text>
        <Text style={[styles.caption, filled ? styles.captionFilled : null]} numberOfLines={2}>
          попаданий
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    left: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 4,
    borderWidth: 2,
  },
  chipAttacker: {
    backgroundColor: '#fdecea',
    borderColor: '#c62828',
  },
  chipDefender: {
    backgroundColor: '#e8f1fb',
    borderColor: '#1565c0',
  },
  chipEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  count: {
    fontWeight: '900',
    includeFontPadding: false,
  },
  countAttacker: {
    color: '#b71c1c',
  },
  countDefender: {
    color: '#0d47a1',
  },
  countEmpty: {
    color: '#b0bec5',
  },
  caption: {
    fontSize: 8,
    letterSpacing: 0.4,
    color: '#b0bec5',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  captionFilled: {
    color: '#546e7a',
    fontWeight: '700',
  },
});

export default HitCounter;
