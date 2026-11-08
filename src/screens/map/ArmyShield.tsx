/**
 * Щит армии на карте. Подписей у армий нет — только щит, поэтому он крупнее
 * метки города и с тенью: армии должны читаться на карте с первого взгляда.
 *
 * Координаты и размер приходят в единицах полотна (0..1000): родитель уже
 * пересчитал их из map_x/map_y и текущего масштаба.
 *
 * Рамки:
 *   - `side` — армия уже набрана в сражение (красная — нападение, синяя — защита);
 *   - `highlighted` — под пальцем при переносе это цель атаки;
 *   - `lifted` — армию «подняли» долгим нажатием, она уехала за пальцем.
 */
import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { MAP_COLORS } from './mapStyle';

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  source: ImageSourcePropType;
  selected?: boolean;
  /** Армия назначена в сражение: на чьей стороне. */
  side?: 'attacker' | 'defender' | null;
  /** Цель переноса под пальцем. */
  highlighted?: boolean;
  /** По армии уже набрано сражение (точка плана). */
  planned?: boolean;
  /** Армия «поднята» и следует за пальцем. */
  lifted?: boolean;
}

const ArmyShield = ({
  x,
  y,
  width,
  height,
  source,
  selected,
  side,
  highlighted,
  planned,
  lifted,
}: Props) => {
  const inset = Math.max(2, width * 0.08);
  const ringColor =
    side === 'attacker' ? MAP_COLORS.attack : side === 'defender' ? MAP_COLORS.defend : null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrapper, { left: x - width / 2, top: y - height / 2, width, height }]}
    >
      {planned ? (
        <View
          style={[
            styles.planRing,
            {
              left: -inset * 1.6,
              top: -inset * 1.6,
              right: -inset * 1.6,
              bottom: -inset * 1.6,
              borderRadius: Math.max(4, width * 0.26),
            },
          ]}
        />
      ) : null}
      {selected ? (
        <View
          style={[
            styles.glow,
            {
              left: -inset,
              top: -inset,
              right: -inset,
              bottom: -inset,
              borderRadius: Math.max(3, width * 0.2),
            },
          ]}
        />
      ) : null}
      {ringColor ? (
        <View
          style={[
            styles.sideRing,
            {
              left: -inset,
              top: -inset,
              right: -inset,
              bottom: -inset,
              borderRadius: Math.max(3, width * 0.2),
              borderColor: ringColor,
            },
          ]}
        />
      ) : null}
      {highlighted ? (
        <View
          style={[
            styles.targetGlow,
            {
              left: -inset * 2,
              top: -inset * 2,
              right: -inset * 2,
              bottom: -inset * 2,
              borderRadius: Math.max(4, width * 0.26),
            },
          ]}
        />
      ) : null}
      <Image
        source={source}
        style={{ width, height, opacity: lifted ? 0.35 : 1 }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  glow: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: MAP_COLORS.accent,
    backgroundColor: 'rgba(201,162,39,0.18)',
  },
  sideRing: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  planRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: MAP_COLORS.target,
    borderStyle: 'dashed',
  },
  targetGlow: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: MAP_COLORS.accent,
    backgroundColor: 'rgba(201,162,39,0.28)',
  },
});

export default ArmyShield;
