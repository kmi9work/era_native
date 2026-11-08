/**
 * Панель набранных сражений на карте.
 *
 * Показывает точки, по которым мастер уже набрал армии, и кнопку «Начать
 * сражения»: без неё перенос армий — просто разметка, а нажатие уводит на экран
 * «Сражения» и играет бои по очереди (по одному сражению за раз).
 *
 * Кнопка неактивна, пока хотя бы в одном сражении нет одной из сторон: бой без
 * защищающихся или без нападающих на экране «Сражения» не начать, и мастер
 * узнал бы об этом уже там, потеряв весь остальной набор.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  battleIsReady,
  battleSummary,
  planArmyCount,
  planProblem,
  type PlannedBattle,
} from './battlePlan';
import { MAP_COLORS } from './mapStyle';

interface Props {
  plan: PlannedBattle[];
  bottom: number;
  /** Идёт подготовка боёв (армии сходятся к точке) — кнопку не жмём дважды. */
  busy?: boolean;
  onStart: () => void;
  onClear: () => void;
  onRemove: (key: string) => void;
}

const BattlePlanPanel = ({ plan, bottom, busy, onStart, onClear, onRemove }: Props) => {
  const problem = planProblem(plan);
  const armies = planArmyCount(plan);
  const disabled = problem !== null || Boolean(busy);

  return (
    <View style={[styles.panel, { bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Сражения на карте: {plan.length} · армий: {armies}
        </Text>
        <TouchableOpacity
          onPress={onClear}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel="Очистить набранные сражения"
        >
          <Text style={styles.clearText}>Очистить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {plan.map(battle => (
          <View key={battle.key} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {battle.title}
              </Text>
              <Text style={[styles.rowSummary, !battleIsReady(battle) && styles.rowSummaryBad]}>
                {battleSummary(battle)}
                {!battleIsReady(battle) ? ' · не хватает стороны' : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onRemove(battle.key)}
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={`Убрать сражение за ${battle.title} из плана`}
            >
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {problem ? <Text style={styles.hint}>{problem}</Text> : null}

      <TouchableOpacity
        style={[styles.start, disabled ? styles.startDisabled : null]}
        onPress={disabled ? undefined : onStart}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Начать сражения"
      >
        <Text style={styles.startText}>
          {busy
            ? 'Армии сходятся к месту боя…'
            : `Начать сражения${plan.length > 1 ? ` (${plan.length})` : ''}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 16,
    maxWidth: 320,
    maxHeight: '52%',
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(36,31,24,0.92)',
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    color: MAP_COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  clear: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearText: {
    color: MAP_COLORS.textMuted,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  list: {
    marginTop: 6,
  },
  listContent: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: {
    flexShrink: 1,
  },
  rowTitle: {
    color: MAP_COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  rowSummary: {
    color: MAP_COLORS.textMuted,
    fontSize: 11,
  },
  rowSummaryBad: {
    color: '#e0b06a',
  },
  remove: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
  },
  hint: {
    marginTop: 8,
    color: '#e0b06a',
    fontSize: 11,
    lineHeight: 15,
  },
  start: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: MAP_COLORS.attack,
  },
  startDisabled: {
    backgroundColor: MAP_COLORS.surfaceRaised,
  },
  startText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default BattlePlanPanel;
