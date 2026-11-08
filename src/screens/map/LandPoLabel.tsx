/**
 * Общественный порядок земли на карте: число в скобках рядом с названием земли.
 *
 * Само название нарисовано на растровой подложке `map-base.png`, поэтому клиент
 * пишет только число — в точке сразу за правым краем названия (положение снято
 * с map.psd, см. landLayout.ts). Отрицательный порядок — красным, ноль и
 * положительный — зелёным (решение заказчика).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MAP_COLORS } from './mapStyle';

interface Props {
  /** Левый край числа в единицах полотна. */
  x: number;
  /** Вертикальный центр названия земли в единицах полотна. */
  y: number;
  /** Кегль в единицах полотна (родитель уже учёл масштаб и минимум). */
  fontSize: number;
  value: number;
}

const formatValue = (value: number): string => `(${Math.round(value)})`;

const LandPoLabel = ({ x, y, fontSize, value }: Props) => (
  <View
    pointerEvents="none"
    style={[styles.wrapper, { left: x, top: y - fontSize * 0.75 }]}
    accessibilityLabel={`Общественный порядок земли: ${Math.round(value)}`}
  >
    <Text
      numberOfLines={1}
      style={[
        styles.text,
        { fontSize, lineHeight: fontSize * 1.15 },
        value < 0 ? styles.negative : styles.positive,
      ]}
    >
      {formatValue(value)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
  },
  text: {
    // Шрифт системный, а не Monomakh карты: в декоративном шрифте нет гарантии
    // на цифры и минус, а число должно читаться всегда.
    fontWeight: '700',
    textShadowColor: MAP_COLORS.labelHalo,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  positive: {
    color: MAP_COLORS.poPositive,
  },
  negative: {
    color: MAP_COLORS.poNegative,
  },
});

export default LandPoLabel;
