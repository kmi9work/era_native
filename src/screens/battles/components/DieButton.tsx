/**
 * Кубик к6 на карточке отряда.
 *
 * Минимальный размер — 0.7×0.7 см (≈44 dp), чтобы мастер уверенно попадал
 * пальцем. Пока идёт бросок, кубик «вращается» и перебирает грани, затем
 * показывает итоговое значение; при попадании рамка становится зелёной.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MIN_DIE_SIZE } from '../../../services/battleRules';

interface DieButtonProps {
  value: number | null;
  spinning: boolean;
  onPress?: () => void;
  disabled?: boolean;
  hit?: boolean;
  /** Подпись под кубиком: результат отступления и т. п. */
  caption?: string;
  size?: number;
}

const DIE_FACES = [1, 2, 3, 4, 5, 6];

const DieButton: React.FC<DieButtonProps> = ({
  value,
  spinning,
  onPress,
  disabled,
  hit,
  caption,
  size = MIN_DIE_SIZE,
}) => {
  const rotate = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState(1);

  useEffect(() => {
    if (!spinning) {
      rotate.setValue(0);
      return undefined;
    }

    const interval = setInterval(() => {
      setFace(current => DIE_FACES[(DIE_FACES.indexOf(current) + 1) % DIE_FACES.length]);
    }, 70);
    const animation = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 420,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => {
      clearInterval(interval);
      animation.stop();
      rotate.setValue(0);
    };
  }, [rotate, spinning]);

  const rotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const shown = spinning ? face : value;
  const isEmpty = shown === null || shown === undefined;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.die,
          { width: size, height: size, borderRadius: size / 5 },
          hit ? styles.dieHit : null,
          disabled ? styles.dieDisabled : null,
        ]}
        onPress={onPress}
        disabled={disabled || !onPress}
        accessibilityRole="button"
        accessibilityLabel={isEmpty ? 'Кубик к6: не брошен' : `Кубик к6: ${shown}`}
      >
        <Animated.Text
          style={[
            styles.value,
            { fontSize: Math.round(size * 0.46) },
            hit ? styles.valueHit : null,
            isEmpty ? styles.valueEmpty : null,
            { transform: [{ rotate: rotation }] },
          ]}
        >
          {isEmpty ? '?' : shown}
        </Animated.Text>
      </TouchableOpacity>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  die: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#b0bec5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  dieHit: {
    borderColor: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  dieDisabled: {
    opacity: 0.75,
  },
  value: {
    fontWeight: '700',
    color: '#263238',
  },
  valueHit: {
    color: '#1b5e20',
  },
  valueEmpty: {
    color: '#90a4ae',
  },
  caption: {
    marginTop: 4,
    fontSize: 11,
    color: '#607d8b',
    textAlign: 'center',
  },
});

export default DieButton;
