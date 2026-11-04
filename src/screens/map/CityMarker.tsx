/**
 * Метка города на карте: плоский круг цвета крепости и белый значок —
 * башня у города, корона у столицы (ТЗ § 4.4, § 4.6).
 *
 * Координаты и размер приходят в единицах полотна (0..1000): родитель уже
 * пересчитал их из map_x/map_y и текущего масштаба.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { MAP_COLORS } from './mapStyle';

const TOWER = require('../../../assets/map/markers/tower.png');
const CROWN = require('../../../assets/map/markers/crown.png');

interface Props {
  x: number;
  y: number;
  size: number;
  color: string;
  capital: boolean;
  selected?: boolean;
}

const CityMarker = ({ x, y, size, color, capital, selected }: Props) => {
  const ringSize = size + Math.max(6, size * 0.34);
  const glyph = size * 0.58;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { left: x - size / 2, top: y - size / 2, width: size, height: size },
      ]}
    >
      {selected ? (
        <View
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              left: (size - ringSize) / 2,
              top: (size - ringSize) / 2,
            },
          ]}
        />
      ) : null}
      <View
        style={[
          styles.disc,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        ]}
      >
        <Image
          source={capital ? CROWN : TOWER}
          style={{ width: glyph, height: glyph }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#f4ead8',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: MAP_COLORS.accent,
  },
});

export default CityMarker;
