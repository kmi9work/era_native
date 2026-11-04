/**
 * Подпись города на карте: шрифт Monomakh (тот же, что на печатной карте),
 * положение и кегль — из манифеста cityLayout (сняты с PSD).
 *
 * Кегль приходит в единицах полотна: родитель уже учёл масштаб и минимальный
 * экранный кегль (ТЗ § 4.5). Ширина подписи фиксированная, текст по центру —
 * так подпись не «прыгает» при измерении.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MAP_COLORS } from './mapStyle';

/** Ширина рамки подписи в единицах полотна. */
export const LABEL_WIDTH = 240;

interface Props {
  x: number;
  y: number;
  fontSize: number;
  text: string;
}

const CityLabel = ({ x, y, fontSize, text }: Props) => (
  <View
    pointerEvents="none"
    style={[
      styles.wrapper,
      {
        left: x - LABEL_WIDTH / 2,
        top: y - fontSize * 0.75,
        width: LABEL_WIDTH,
      },
    ]}
  >
    <Text
      numberOfLines={1}
      style={[styles.text, { fontSize, lineHeight: fontSize * 1.15 }]}
    >
      {text}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Monomakh-Regular',
    color: MAP_COLORS.label,
    textAlign: 'center',
    textShadowColor: MAP_COLORS.labelHalo,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});

export default CityLabel;
