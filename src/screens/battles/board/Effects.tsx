/**
 * Эффекты удара: искра на жертве и всплывающая цифра потери.
 *
 * Компонент один на активный шаг сцены (`impact`); смена `effectKey` —
 * новый удар, поэтому анимация проигрывается заново даже на той же фишке.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface ImpactEffectsProps {
  /** Центр фишки жертвы. */
  x: number;
  y: number;
  size: number;
  text: string;
  duration: number;
  effectKey: string;
}

const ImpactEffects: React.FC<ImpactEffectsProps> = ({
  x,
  y,
  size,
  text,
  duration,
  effectKey,
}) => {
  const progress = useSharedValue(0);
  const spark = useSharedValue(0);

  useEffect(() => {
    const total = Math.max(220, duration);
    progress.value = 0;
    progress.value = withTiming(1, { duration: total });
    spark.value = 0;
    spark.value = withTiming(1, { duration: Math.round(total * 0.55) });
  }, [effectKey, duration, progress, spark]);

  const sparkStyle = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - spark.value),
    transform: [{ scale: 0.4 + spark.value * 1.5 }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -36 * progress.value }, { scale: 1 + 0.2 * progress.value }],
  }));

  const sparkSize = Math.round(size * 0.95);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.spark,
          {
            left: Math.round(x - sparkSize / 2),
            top: Math.round(y + size / 2 - sparkSize / 2),
            width: sparkSize,
            height: sparkSize,
            borderRadius: sparkSize / 2,
          },
          sparkStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.textWrap, { left: Math.round(x - 45), top: Math.round(y - 6) }, textStyle]}
      >
        <Text style={styles.text}>{text}</Text>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  spark: {
    position: 'absolute',
    backgroundColor: '#ff7043',
    opacity: 0.6,
  },
  textWrap: {
    position: 'absolute',
    width: 90,
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: '800',
    color: '#b71c1c',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowRadius: 3,
  },
});

export default ImpactEffects;
