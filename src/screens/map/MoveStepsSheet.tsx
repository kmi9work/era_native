/**
 * «Сколько шагов потратит армия?» — вопрос после выбора места на карте.
 *
 * Правило заказчика: шаги вносятся КНОПКАМИ от 1 до максимума армии, а не полем
 * ввода (на планшете мастер работает пальцем). Максимум и остаток приходят с
 * сервера (`Army#steps_max`/`steps_spent`), клиент их не пересчитывает.
 *
 * Кнопки, которые тратят больше остатка, помечены предупреждающим цветом, но
 * остаются нажимаемыми: по правилам армия не может ходить, и решает мастер —
 * поэтому предупреждение показывается, а запрета нет.
 */
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ArmySteps } from './armySteps';
import { stepChoices } from './armySteps';
import { MAP_COLORS } from './mapStyle';

interface Props {
  visible: boolean;
  armyName: string;
  steps: ArmySteps | null;
  /** Куда идёт армия: «в город Москва» или «в поле». */
  destination: string;
  busy: boolean;
  onPick: (spend: number) => void;
  onCancel: () => void;
}

const MoveStepsSheet = ({
  visible,
  armyName,
  steps,
  destination,
  busy,
  onPick,
  onCancel,
}: Props) => {
  if (!steps) return null;
  const exhausted = steps.left <= 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Армия «{armyName}»</Text>
          <Text style={styles.destination}>Куда: {destination}</Text>
          <Text style={styles.summary}>
            Шагов в году: {steps.max} · потрачено: {steps.spent} · осталось: {steps.left}
          </Text>

          {exhausted ? (
            <Text style={styles.warning}>
              У армии закончились шаги: по правилам она не может ходить. Мастеру можно всё равно
              передвинуть её — выберите, сколько шагов списать.
            </Text>
          ) : null}

          <Text style={styles.question}>Сколько шагов потратит армия?</Text>

          <View style={styles.grid}>
            {stepChoices(steps).map(choice => {
              const over = choice > steps.left;
              return (
                <TouchableOpacity
                  key={choice}
                  style={[styles.choice, over ? styles.choiceOver : null]}
                  onPress={() => onPick(choice)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={
                    over
                      ? `Потратить шагов: ${choice} — больше остатка ${steps.left}`
                      : `Потратить шагов: ${choice}`
                  }
                >
                  <Text style={[styles.choiceText, over ? styles.choiceTextOver : null]}>
                    {choice}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.hint}>
            Красным — шагов больше остатка: армия по правилам идти не может, но мастер решает.
          </Text>

          <TouchableOpacity
            style={styles.cancel}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Отменить перемещение"
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
    maxWidth: 460,
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
  destination: {
    color: MAP_COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  summary: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  warning: {
    color: '#e0b06a',
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  question: {
    color: MAP_COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    minWidth: 48,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: MAP_COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
  },
  choiceOver: {
    borderColor: '#b3382c',
    backgroundColor: 'rgba(179,56,44,0.18)',
  },
  choiceText: {
    color: MAP_COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  choiceTextOver: {
    color: '#e0766a',
  },
  hint: {
    color: MAP_COLORS.textMuted,
    fontSize: 11,
    marginTop: 10,
    lineHeight: 15,
  },
  cancel: {
    marginTop: 14,
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

export default MoveStepsSheet;
