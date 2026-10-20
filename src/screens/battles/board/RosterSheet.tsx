/**
 * «Состав боя» — выдвижная панель поверх сцены.
 *
 * Сцена показывает фишки, но мастеру за столом нужно иногда увидеть точные
 * названия армий, владельцев и состав. Это не дублирование шага «Армии»:
 * данные те же, из боя, но без кубиков и без правок.
 */
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BattleLogic } from '../../hooks/useBattleLogic';

interface RosterSheetProps {
  visible: boolean;
  logic: BattleLogic;
  onClose: () => void;
  /** Шильдик свежести данных: на полноэкранном бою шапка скрыта, поэтому он живёт здесь. */
  badge?: React.ReactNode;
}

const RosterSheet: React.FC<RosterSheetProps> = ({ visible, logic, onClose, badge }) => {
  const groups: Array<{ title: string; armies: BattleLogic['attackers'] }> = [
    { title: 'Атакующие', armies: logic.attackers },
    { title: 'Защищающиеся', armies: logic.defenders },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Состав боя</Text>
            <TouchableOpacity onPress={onClose} style={styles.close} accessibilityLabel="Закрыть состав">
              <Text style={styles.closeText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
          {badge ? <View style={styles.badgeRow}>{badge}</View> : null}
          <ScrollView contentContainerStyle={styles.content}>
            {groups.map(group => (
              <View key={group.title} style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.armies.length === 0 ? (
                  <Text style={styles.empty}>Армий нет</Text>
                ) : (
                  group.armies.map(army => {
                    const counts = new Map<string, number>();
                    army.troops.forEach(troop => {
                      counts.set(troop.name, (counts.get(troop.name) || 0) + 1);
                    });
                    return (
                      <View key={army.uid} style={styles.army}>
                        <Text style={styles.armyName}>{army.name}</Text>
                        <Text style={styles.armyMeta}>
                          {army.ownerName}
                          {army.retreated ? ' · отступила' : ''}
                        </Text>
                        <Text style={styles.armyTroops}>
                          {counts.size === 0
                            ? 'отрядов нет'
                            : [...counts.entries()]
                                .map(([name, count]) => `${name}${count > 1 ? ` ×${count}` : ''}`)
                                .join(', ')}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 30, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '72%',
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#263238',
  },
  close: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '600',
  },
  badgeRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  group: {
    marginBottom: 14,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#455a64',
    marginBottom: 6,
  },
  army: {
    backgroundColor: '#f7f9fb',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  armyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#263238',
  },
  armyMeta: {
    fontSize: 11,
    color: '#78909c',
    marginTop: 1,
  },
  armyTroops: {
    fontSize: 11,
    color: '#546e7a',
    marginTop: 3,
  },
  empty: {
    fontSize: 11,
    color: '#90a4ae',
  },
});

export default RosterSheet;
