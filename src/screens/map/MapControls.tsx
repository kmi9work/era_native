/**
 * Кнопки карты (крупные, «флэт»): приблизить, отдалить, вписать.
 * Размер 56 dp — палец мастера за планшетом, наклейка на кнопку не нужна.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MAP_COLORS } from './mapStyle';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  bottom: number;
  right: number;
}

const MapControls = ({ onZoomIn, onZoomOut, onFit, bottom, right }: Props) => (
  <View style={[styles.wrap, { bottom, right }]} pointerEvents="box-none">
    <TouchableOpacity
      style={styles.button}
      onPress={onZoomIn}
      accessibilityRole="button"
      accessibilityLabel="Приблизить карту"
    >
      <Text style={styles.symbol}>+</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.button}
      onPress={onZoomOut}
      accessibilityRole="button"
      accessibilityLabel="Отдалить карту"
    >
      <Text style={styles.symbol}>−</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.button, styles.fitButton]}
      onPress={onFit}
      accessibilityRole="button"
      accessibilityLabel="Вписать карту в экран"
    >
      <Text style={styles.fitText}>Вписать</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MAP_COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fitButton: {
    width: 56,
    height: 40,
    borderRadius: 20,
  },
  symbol: {
    color: MAP_COLORS.text,
    fontSize: 28,
    lineHeight: 32,
    marginTop: -2,
  },
  fitText: {
    color: MAP_COLORS.text,
    fontSize: 10,
    fontWeight: '600',
  },
});

export default MapControls;
