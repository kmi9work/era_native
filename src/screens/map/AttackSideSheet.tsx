/**
 * Вопрос после переноса армии на цель: на чьей стороне она в этом сражении?
 *
 * Долгое нажатие на щит армии и перенос на город или другую армию сам по себе
 * не говорит, кем воюет армия: мастер может набирать и нападающих, и
 * защищающихся одной и той же рукой. Поэтому после каждого переноса экран
 * спрашивает сторону — и только потом армия попадает в план.
 *
 * Карточка показывает, куда именно перенесли (город или армия), что уже
 * набрано в этой точке и куда армия назначена сейчас (новое назначение
 * переносит её из прежнего сражения).
 */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BattleTarget, PlannedBattle } from './battlePlan';
import { MAP_COLORS } from './mapStyle';

interface Props {
  visible: boolean;
  armyName: string;
  target: BattleTarget | null;
  /** Сражение этой точки, если в нём уже что-то набрано. */
  current: PlannedBattle | null;
  /** Где армия числится сейчас: сражение и сторона. */
  assignedTo: { title: string; side: 'attacker' | 'defender' } | null;
  onPick: (side: 'attacker' | 'defender') => void;
  onCancel: () => void;
}

const AttackSideSheet = ({
  visible,
  armyName,
  target,
  current,
  assignedTo,
  onPick,
  onCancel,
}: Props) => {
  if (!target) return null;

  const attackers = current?.attackerIds.length ?? 0;
  const defenders = current?.defenderIds.length ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Армия «{armyName}»</Text>
          <Text style={styles.target}>Куда: {target.title}</Text>

          {attackers > 0 || defenders > 0 ? (
            <Text style={styles.note}>
              Уже набрано: {attackers} в атаку, {defenders} в защиту.
            </Text>
          ) : null}

          {assignedTo ? (
            <Text style={styles.warning}>
              Сейчас армия в сражении за «{assignedTo.title}» (
              {assignedTo.side === 'attacker' ? 'нападение' : 'защита'}) — назначение перенесёт её
              сюда.
            </Text>
          ) : null}

          {target.kind === 'army' ? (
            <Text style={styles.note}>
              Атакованная армия встанет в защиту этой точки, если её ещё никуда не назначили.
            </Text>
          ) : null}

          <Text style={styles.question}>На чьей стороне эта армия?</Text>

          <TouchableOpacity
            style={[styles.sideButton, styles.attackerButton]}
            onPress={() => onPick('attacker')}
            accessibilityRole="button"
            accessibilityLabel="Назначить армию в нападение"
          >
            <Text style={styles.sideButtonText}>Нападение</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sideButton, styles.defenderButton]}
            onPress={() => onPick('defender')}
            accessibilityRole="button"
            accessibilityLabel="Назначить армию в защиту"
          >
            <Text style={styles.sideButtonText}>Защита</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancel}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Отменить назначение"
          >
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: MAP_COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    padding: 18,
  },
  title: {
    color: MAP_COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  target: {
    color: MAP_COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  note: {
    color: MAP_COLORS.textMuted,
    fontSize: 12,
    marginTop: 10,
    lineHeight: 17,
  },
  warning: {
    color: '#e0b06a',
    fontSize: 12,
    marginTop: 10,
    lineHeight: 17,
  },
  question: {
    color: MAP_COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  sideButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  attackerButton: {
    backgroundColor: MAP_COLORS.attack,
  },
  defenderButton: {
    backgroundColor: MAP_COLORS.defend,
  },
  sideButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancel: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
  },
  cancelText: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default AttackSideSheet;
