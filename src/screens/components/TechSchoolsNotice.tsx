import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { selectTechnology, useTechnologies } from '../../data/hooks/useTechnologies';
import { TECH_SCHOOLS_ID, TECH_SCHOOLS_MULTIPLIER } from '../../services/plantProduction';

interface TechSchoolsNoticeProps {
  /** Технология «Технические училища» открыта у текущего государства (plant_level.tech_schools_open). */
  open: boolean;
  /** Учтён ли эффект в цифрах, которые видит мастер на этом экране. */
  applied?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Плашка «технология открыта» для экранов переработки.
 * Название и текст эффекта приходят с сервера (GET /technologies.json), чтобы формулировка
 * совпадала с игровой; если список ещё не загружен — краткий текст с коэффициентом.
 */
export default function TechSchoolsNotice({ open, applied = true, style }: TechSchoolsNoticeProps) {
  const technologiesQuery = useTechnologies();

  if (!open) {
    return null;
  }

  const technology = selectTechnology(technologiesQuery.data, TECH_SCHOOLS_ID);
  const name = technology?.name || 'Технические училища';
  const effect = technology?.description || `Выход предприятий ×${TECH_SCHOOLS_MULTIPLIER}`;

  return (
    <View style={[styles.notice, style]}>
      <Text style={styles.title}>Технология «{name}» открыта</Text>
      <Text style={styles.effect}>
        {effect}
        {applied ? ' — уже учтено в расчёте' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 3,
    borderLeftColor: '#1976d2',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0d47a1',
  },
  effect: {
    fontSize: 12,
    color: '#1565c0',
    marginTop: 2,
  },
});
