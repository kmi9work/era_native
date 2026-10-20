/**
 * Шаг 2. Набор армий.
 *
 * Атакующие — сверху, защищающиеся — снизу. Армии берутся с бэкенда
 * (`GET /armies.json`). В любую армию можно добавить дополнительные отряды —
 * только в состав этого боя: состав армии на бэкенде не меняется (у армии там
 * лимит слотов, и мастер не должен случайно править её из экрана сражения).
 */
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getErrorMessage } from '../../../data/apiErrors';
import type { BattleLogic, BattleSide } from '../../hooks/useBattleLogic';
import ArmyGroup from '../components/ArmyGroup';

const ArmiesStep: React.FC<{ logic: BattleLogic }> = ({ logic }) => {
  const [picker, setPicker] = useState<BattleSide | null>(null);

  const renderSide = (side: BattleSide) => {
    const groups = side === 'attacker' ? logic.attackers : logic.defenders;
    const title = side === 'attacker' ? 'Атакующие армии' : 'Защищающиеся армии';
    const accent = side === 'attacker' ? styles.titleAttacker : styles.titleDefender;
    const available = logic.availableArmies.filter(item => !item.used);

    return (
      <View style={styles.side}>
        <Text style={[styles.sideTitle, accent]}>{title}</Text>

        {groups.length === 0 ? (
          <Text style={styles.empty}>Армии не выбраны</Text>
        ) : (
          groups.map(army => (
            <ArmyGroup key={army.uid} army={army} logic={logic} mode="setup" />
          ))
        )}

        <TouchableOpacity
          style={styles.pickButton}
          onPress={() => setPicker(picker === side ? null : side)}
        >
          <Text style={styles.pickButtonText}>
            {picker === side ? 'Скрыть список' : `Выбрать армию (${available.length})`}
          </Text>
        </TouchableOpacity>

        {picker === side ? (
          <View style={styles.picker}>
            {available.length === 0 ? (
              <Text style={styles.empty}>Свободных армий нет</Text>
            ) : (
              available.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.pickRow}
                  onPress={() => {
                    logic.addArmy(item.army, side);
                    setPicker(null);
                  }}
                >
                  <View style={styles.pickInfo}>
                    <Text style={styles.pickName}>{item.army.name}</Text>
                    <Text style={styles.pickMeta}>
                      {item.ownerName} · отрядов: {item.troopsCount}
                      {item.army.settlement?.name ? ` · ${item.army.settlement.name}` : ''}
                    </Text>
                    <Text style={styles.pickTroops}>{item.troopsLabel}</Text>
                  </View>
                  <Text style={styles.pickPlus}>+</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Атакующая армия сверху, защищающаяся снизу. Отряды добавляются только в состав
        этого боя — армии на бэкенде не меняются.
      </Text>

      {logic.armiesQuery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#1976d2" />
          <Text style={styles.loadingText}>Загружаем армии…</Text>
        </View>
      ) : null}

      {logic.armiesQuery.error ? (
        <Text style={styles.error}>{getErrorMessage(logic.armiesQuery.error, 'Не удалось загрузить армии')}</Text>
      ) : null}

      {renderSide('attacker')}
      <View style={styles.divider}>
        <Text style={styles.dividerText}>поле боя</Text>
      </View>
      {renderSide('defender')}

      <Text style={styles.total}>
        Всего армий: {logic.battleArmies.length} · отрядов: {logic.totalTroops}
      </Text>
      {!logic.battleReady ? (
        <Text style={styles.needSides}>
          Для перехода дальше нужна хотя бы одна армия сверху и хотя бы одна снизу.
        </Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  hint: {
    fontSize: 12,
    color: '#78909c',
    lineHeight: 17,
    marginBottom: 12,
  },
  side: {
    marginBottom: 8,
  },
  sideTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  titleAttacker: {
    color: '#c62828',
  },
  titleDefender: {
    color: '#1565c0',
  },
  empty: {
    fontSize: 12,
    color: '#90a4ae',
    marginBottom: 8,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#607d8b',
  },
  error: {
    fontSize: 12,
    color: '#c62828',
    marginBottom: 10,
  },
  pickButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#90caf9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pickButtonText: {
    fontSize: 12,
    color: '#1565c0',
    fontWeight: '600',
  },
  picker: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 6,
    marginBottom: 10,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickInfo: {
    flex: 1,
  },
  pickName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#263238',
  },
  pickMeta: {
    fontSize: 11,
    color: '#78909c',
    marginTop: 1,
  },
  pickTroops: {
    fontSize: 11,
    color: '#607d8b',
    marginTop: 2,
  },
  pickPlus: {
    fontSize: 24,
    color: '#1976d2',
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  divider: {
    alignItems: 'center',
    marginVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#cfd8dc',
    borderStyle: 'dashed',
  },
  dividerText: {
    marginTop: -8,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    fontSize: 10,
    color: '#90a4ae',
    textTransform: 'uppercase',
  },
  total: {
    marginTop: 14,
    fontSize: 12,
    color: '#546e7a',
  },
  needSides: {
    marginTop: 6,
    fontSize: 12,
    color: '#c62828',
  },
});

export default ArmiesStep;
