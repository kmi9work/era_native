/**
 * Итог сражения: подтверждение уничтожения армий, захват города и
 * присоединение павшего государства.
 *
 * На бэкенд уходит только DELETE /armies/:id для разбитых армий. Захват города
 * и присоединение государства экран показывает итогом: API захвата города нет
 * (город принадлежит региону, захват региона — отдельное действие), поэтому
 * мастер оформляет это в веб-админке.
 */
import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BattleLogic } from '../../hooks/useBattleLogic';

const OUTCOME_TITLES: Record<string, string> = {
  attackers_destroyed: 'Нападающие разбиты',
  defenders_destroyed: 'Защищающиеся разбиты',
  attackers_retreated: 'Нападающие отступили',
  defenders_retreated: 'Защищающиеся отступили',
};

const OutcomePanel: React.FC<{ logic: BattleLogic }> = ({ logic }) => {
  if (!logic.outcome) return null;

  const destroyedSideLabel =
    logic.outcome === 'attackers_destroyed' ? 'нападающих' : 'защищающихся';

  const askDestroy = () => {
    const names = logic.armiesToDestroy.map(army => `${army.name} (${army.ownerName})`);
    Alert.alert(
      'Уничтожить армии?',
      `${destroyedSideLabel[0].toUpperCase()}${destroyedSideLabel.slice(1)}: ${names.join(', ')}.\n\nАрмии будут удалены на бэкенде.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Уничтожить', style: 'destructive', onPress: () => logic.confirmOutcome() },
      ],
    );
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{OUTCOME_TITLES[logic.outcome] || 'Сражение завершено'}</Text>

      {logic.armiesToDestroy.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Армии к уничтожению</Text>
          {logic.armiesToDestroy.map(army => (
            <Text key={army.uid} style={styles.blockLine}>
              • {army.name} — {army.ownerName}
              {army.armyId === null ? ' (нет на бэкенде)' : ''}
            </Text>
          ))}
          {!logic.outcomeConfirmed ? (
            <TouchableOpacity style={styles.dangerButton} onPress={askDestroy} disabled={logic.busy}>
              {logic.busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.dangerButtonText}>
                  Подтвердить уничтожение {destroyedSideLabel}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.done}>
              {logic.deletedArmyIds.length > 0
                ? `Уничтожено армий на бэкенде: ${logic.deletedArmyIds.length}`
                : 'Армий для удаления на бэкенде нет'}
            </Text>
          )}
          {logic.deleteError ? <Text style={styles.error}>Ошибка: {logic.deleteError}</Text> : null}
        </View>
      ) : null}

      {logic.cityCaptureNote ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Город</Text>
          <Text style={styles.blockLine}>{logic.cityCaptureNote}</Text>
        </View>
      ) : null}

      {logic.annexation ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            Государство {logic.annexation.defendingCountryName}
          </Text>
          <Text style={styles.blockLine}>
            {logic.annexation.capitalName} — столица, и у государства не осталось армий.
            Присоединить его к нападающему?
          </Text>
          {logic.annexation.attackerCountries.length === 0 ? (
            <Text style={styles.blockLine}>
              Государство нападающих не определено — решение мастер принимает в админке.
            </Text>
          ) : (
            <View style={styles.chips}>
              {logic.annexation.attackerCountries.map(country => (
                <TouchableOpacity
                  key={country.id}
                  style={[
                    styles.chip,
                    logic.annexationChoice === country.id ? styles.chipActive : null,
                  ]}
                  onPress={() => logic.setAnnexationChoice(country.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      logic.annexationChoice === country.id ? styles.chipTextActive : null,
                    ]}
                  >
                    {country.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {logic.annexationDone ? (
            <Text style={styles.done}>
              Решение записано: государство {logic.annexation.defendingCountryName} присоединяется
              к {logic.countryName(logic.annexationChoice)}. Оформите присоединение в веб-админке
              (Страны → присоединить) — отдельного API присоединения в клиенте нет.
            </Text>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                if (logic.annexation?.attackerCountries.length && logic.annexationChoice === null) {
                  Alert.alert('Выберите государство', 'Укажите, к какому государству присоединить.');
                  return;
                }
                logic.confirmAnnexation();
              }}
            >
              <Text style={styles.primaryButtonText}>Присоединить государство</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={logic.resetAll}>
          <Text style={styles.secondaryButtonText}>Новое сражение</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={logic.goBack}>
          <Text style={styles.secondaryButtonText}>К баффам</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 14,
    marginTop: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#263238',
    marginBottom: 10,
  },
  block: {
    backgroundColor: '#f7f9fb',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#37474f',
    marginBottom: 4,
  },
  blockLine: {
    fontSize: 12,
    color: '#546e7a',
    lineHeight: 17,
    marginBottom: 2,
  },
  dangerButton: {
    backgroundColor: '#c62828',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#90a4ae',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    marginRight: 8,
    marginTop: 4,
  },
  secondaryButtonText: {
    color: '#546e7a',
    fontSize: 12,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#90caf9',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  chipActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  chipText: {
    fontSize: 12,
    color: '#1565c0',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  done: {
    fontSize: 12,
    color: '#2e7d32',
    marginTop: 6,
    lineHeight: 17,
  },
  error: {
    fontSize: 12,
    color: '#c62828',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

export default OutcomePanel;
