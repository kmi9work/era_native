/** Полоса шагов сражения: место → армии → баффы → бой. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BattleStep } from '../../hooks/useBattleLogic';

const STEPS: Array<{ key: BattleStep; label: string }> = [
  { key: 'place', label: 'Место' },
  { key: 'armies', label: 'Армии' },
  { key: 'buffs', label: 'Баффы' },
  { key: 'battle', label: 'Бой' },
];

const StepBar: React.FC<{ step: BattleStep }> = ({ step }) => {
  const index = STEPS.findIndex(item => item.key === step);

  return (
    <View style={styles.container}>
      {STEPS.map((item, itemIndex) => {
        const passed = itemIndex < index;
        const active = itemIndex === index;
        return (
          <View key={item.key} style={styles.item}>
            <View style={[styles.dot, passed ? styles.dotPassed : null, active ? styles.dotActive : null]}>
              <Text style={[styles.dotText, active || passed ? styles.dotTextActive : null]}>
                {itemIndex + 1}
              </Text>
            </View>
            <Text style={[styles.label, active ? styles.labelActive : null]}>{item.label}</Text>
            {itemIndex < STEPS.length - 1 ? (
              <View style={[styles.line, passed ? styles.linePassed : null]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#eceff1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPassed: {
    backgroundColor: '#81c784',
  },
  dotActive: {
    backgroundColor: '#1976d2',
  },
  dotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#90a4ae',
  },
  dotTextActive: {
    color: '#ffffff',
  },
  label: {
    fontSize: 11,
    color: '#90a4ae',
    marginLeft: 5,
  },
  labelActive: {
    color: '#1976d2',
    fontWeight: '700',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#eceff1',
    marginHorizontal: 6,
  },
  linePassed: {
    backgroundColor: '#81c784',
  },
});

export default StepBar;
