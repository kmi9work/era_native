/**
 * Итог сражения: уничтожение разбитых армий и погибших отрядов, влияние Воеводе,
 * взятый город и присоединение региона.
 *
 * Три независимых действия мастера после взятия города (порядок произвольный):
 *  1. снять владельца города (`PATCH /settlements/:id`, player_id пустой);
 *  2. назначить нового владельца — любого игрока игры, нападавшие в списке первыми;
 *  3. присоединить регион войной — только для взятой столицы
 *     (`PATCH /regions/:id/captured_by`), с выбором страны, если воевали союзники.
 *
 * Все три вызова — те же, что делает веб-админка. Захвата отдельного города в API
 * нет: город принадлежит региону, поэтому присоединяется регион целиком.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BattleLogic } from '../../hooks/useBattleLogic';
import OwnerPicker from './OwnerPicker';

const OUTCOME_TITLES: Record<string, string> = {
  attackers_destroyed: 'Нападающие разбиты',
  defenders_destroyed: 'Защищающиеся разбиты',
  attackers_retreated: 'Нападающие отступили',
  defenders_retreated: 'Защищающиеся отступили',
};

const OutcomePanel: React.FC<{ logic: BattleLogic }> = ({ logic }) => {
  // Список игроков открывается модалом: хуки обязаны идти до раннего возврата.
  const [ownerPickerVisible, setOwnerPickerVisible] = useState(false);

  if (!logic.outcome) return null;

  const destroyedSideLabel =
    logic.outcome === 'attackers_destroyed' ? 'нападающих' : 'защищающихся';

  const askDestroyTroops = () => {
    const label = logic.troopsToDestroy.length === 1 ? 'отряд' : 'отрядов';
    Alert.alert(
      'Уничтожить отряды?',
      `${logic.troopsToDestroy.length} ${label} погибли в бою и будут удалены на бэкенде:\n\n${logic.troopsToDestroy
        .map(troop => `${troop.name} — ${troop.armyName}`)
        .join(', ')}`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Уничтожить', style: 'destructive', onPress: () => void logic.confirmTroopDestruction() },
      ],
    );
  };

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

      {logic.troopsToDestroy.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Погибшие отряды</Text>
          {logic.troopsToDestroy.map(troop => (
            <Text key={`troop-${troop.troopId}`} style={styles.blockLine}>
              • {troop.name} — армия {troop.armyName}
            </Text>
          ))}
          {!logic.troopsConfirmed ? (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={askDestroyTroops}
              disabled={logic.troopDeleteBusy}
            >
              {logic.troopDeleteBusy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.dangerButtonText}>
                  Уничтожить отряды ({logic.troopsToDestroy.length})
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.done}>
              {logic.deletedTroopIds.length > 0
                ? `Уничтожено отрядов на бэкенде: ${logic.deletedTroopIds.length}`
                : 'Отрядов для удаления на бэкенде нет'}
            </Text>
          )}
          {logic.troopDeleteError ? (
            <Text style={styles.error}>Ошибка: {logic.troopDeleteError}</Text>
          ) : null}
        </View>
      ) : null}

      {logic.outcome ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Влияние Воеводе за победу</Text>
          <Text style={styles.blockLine}>
            Победившие армии:{' '}
            {logic.winnerArmies.length > 0
              ? logic.winnerArmies.map(army => `${army.name} (${army.ownerName})`).join(', ')
              : 'нет армий на бэкенде'}
          </Text>
          <Text style={styles.blockLine}>
            Разбитые армии:{' '}
            {logic.defeatedArmies.length > 0
              ? logic.defeatedArmies.map(army => `${army.name} (${army.ownerName})`).join(', ')
              : 'нет'}
          </Text>
          <Text style={styles.blockLine}>
            Воевода победителя получает +4 за каждую разбитую армию противника, Воевода
            проигравшего — −1 за каждую разбитую армию своего государства. Гарнизон города
            армией не считается.
          </Text>

          {logic.voevodaAwarded === null ? (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                logic.voevodaBusy || logic.winnerArmies.length === 0
                  ? styles.primaryButtonDisabled
                  : null,
              ]}
              onPress={() => {
                void logic.awardVoevodaInfluence();
              }}
              disabled={logic.voevodaBusy || logic.winnerArmies.length === 0}
            >
              {logic.voevodaBusy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Начислить влияние Воеводе</Text>
              )}
            </TouchableOpacity>
          ) : logic.voevodaAwarded.length > 0 ? (
            <Text style={styles.done}>
              Начислено:{' '}
              {logic.voevodaAwarded
                .map(player => `${player.name} (+${player.value ?? 0})`)
                .join(', ')}
            </Text>
          ) : (
            <Text style={styles.blockLine}>
              Влияние не начислено: разбитых армий на бэкенде нет — гарнизон города армией не
              считается.
            </Text>
          )}
          {logic.voevodaError ? (
            <Text style={styles.error}>Ошибка: {logic.voevodaError}</Text>
          ) : null}
        </View>
      ) : null}

      {logic.capturedCity ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Город {logic.capturedCity.name} захвачен</Text>
          <Text style={styles.blockLine}>
            Владелец: {logic.capturedCity.owner ? logic.capturedCity.owner.name : 'нет'}
          </Text>
          {logic.outcome === 'defenders_retreated' ? (
            <Text style={styles.blockLine}>
              Защищающиеся оставили город: регион остаётся за прежним государством — присоединение
              региона оформляется в веб-админке.
            </Text>
          ) : logic.capturedCity.isCapital ? null : (
            <Text style={styles.blockLine}>
              Столица государства не взята — регион не переходит.
            </Text>
          )}

          <View style={styles.ownerButtons}>
            <TouchableOpacity
              style={[
                styles.secondaryWide,
                logic.cityOwnerBusy || !logic.capturedCity.owner ? styles.secondaryWideOff : null,
              ]}
              onPress={() => {
                void logic.removeCityOwner();
              }}
              disabled={logic.cityOwnerBusy || !logic.capturedCity.owner}
            >
              <Text style={styles.secondaryWideText}>Снять владельца</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryWide, logic.cityOwnerBusy ? styles.secondaryWideOff : null]}
              onPress={() => setOwnerPickerVisible(true)}
              disabled={logic.cityOwnerBusy}
            >
              <Text style={styles.secondaryWideText}>Назначить владельца</Text>
            </TouchableOpacity>
          </View>

          {logic.annexation && !logic.annexationResult ? (
            <Text style={styles.blockLine}>
              Сначала присоедините регион, затем назначайте владельца: при передаче региона
              другому государству владельцы поселений снимаются.
            </Text>
          ) : null}

          {logic.cityOwnerResult ? (
            <Text style={styles.done}>
              {logic.cityOwnerResult === 'removed' ? 'Владелец города снят.' : 'Владелец города назначен.'}
            </Text>
          ) : null}
          {logic.cityOwnerError ? (
            <Text style={styles.error}>Ошибка: {logic.cityOwnerError}</Text>
          ) : null}

          <OwnerPicker
            visible={ownerPickerVisible}
            choices={logic.ownerChoices}
            busy={logic.cityOwnerBusy}
            onPick={playerId => {
              setOwnerPickerVisible(false);
              void logic.assignCityOwner(playerId);
            }}
            onClose={() => setOwnerPickerVisible(false)}
          />
        </View>
      ) : null}

      {logic.annexation && !logic.annexationResult ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            Столица {logic.annexation.capitalName} взята
          </Text>
          <Text style={styles.blockLine}>
            Государство {logic.annexation.defendingCountryName}. Регион{' '}
            {logic.annexation.regionName} можно присоединить к победителю.
          </Text>
          {logic.annexation.remainingArmyCount > 0 ? (
            <Text style={styles.blockLine}>
              У государства осталось армий: {logic.annexation.remainingArmyCount}. По правилам
              это оккупация — присоединение региона подтверждает мастер.
            </Text>
          ) : null}

          {logic.annexation.attackerCountries.length === 0 ? (
            <Text style={styles.blockLine}>
              Государство нападающих не определено — регион передаётся в веб-админке.
            </Text>
          ) : logic.annexation.attackerCountries.length === 1 ? (
            <Text style={styles.pickLine}>
              Победитель: {logic.annexation.attackerCountries[0].name}
            </Text>
          ) : (
            <>
              <Text style={styles.pickLine}>
                Воевали союзники — выберите, кому присоединить регион:
              </Text>
              <View style={styles.chips}>
                {logic.annexation.attackerCountries.map(country => (
                  <TouchableOpacity
                    key={country.id}
                    style={[
                      styles.chip,
                      logic.annexationTarget === country.id ? styles.chipActive : null,
                    ]}
                    onPress={() => logic.setAnnexationChoice(country.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        logic.annexationTarget === country.id ? styles.chipTextActive : null,
                      ]}
                    >
                      {country.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {logic.annexation.attackerCountries.length === 0 ? null : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                logic.annexationBusy || logic.annexationTarget === null
                  ? styles.primaryButtonDisabled
                  : null,
              ]}
              onPress={() => {
                void logic.confirmAnnexation();
              }}
              disabled={logic.annexationBusy || logic.annexationTarget === null}
            >
              {logic.annexationBusy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Присоединить регион</Text>
              )}
            </TouchableOpacity>
          )}
          {logic.annexationError ? (
            <Text style={styles.error}>Ошибка: {logic.annexationError}</Text>
          ) : null}
        </View>
      ) : null}

      {logic.annexationResult ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Регион передан</Text>
          <Text style={styles.done}>
            Регион {logic.annexationResult.regionName} присоединён. Новое государство:{' '}
            {logic.annexationResult.countryName}.
          </Text>
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
  primaryButtonDisabled: {
    backgroundColor: '#b0bec5',
  },
  ownerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  secondaryWide: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  secondaryWideOff: {
    borderColor: '#cfd8dc',
  },
  secondaryWideText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1565c0',
  },
  pickLine: {
    fontSize: 12,
    fontWeight: '600',
    color: '#37474f',
    marginTop: 6,
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
