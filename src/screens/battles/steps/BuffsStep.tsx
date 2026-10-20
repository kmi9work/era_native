/**
 * Шаг 3. Баффы и дебаффы.
 *
 * Город даёт защищающимся пехоту (её добавляет экран при старте боя), крепость
 * добавляет +1/+2 к значениям кубиков защищающихся. Мастер может выдать армии
 * бонус (+1 к кубику каждого отряда) или дебафф (−1) на всё сражение.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fortressRequiresCannon } from '../../../services/battleRules';
import type { BattleLogic } from '../../hooks/useBattleLogic';
import ArmyGroup from '../components/ArmyGroup';

const BuffsStep: React.FC<{ logic: BattleLogic }> = ({ logic }) => {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.placeCard}>
        <Text style={styles.placeTitle}>{logic.placeTitle}</Text>
        {logic.placeKind === 'city' ? (
          <>
            <Text style={styles.placeLine}>
              Крепость: {logic.fortressLevel > 0 ? `${logic.fortressLevel} уровень` : 'нет'}
              {logic.fortressLevel === 2 ? ' (+1 к кубикам защищающихся)' : ''}
              {logic.fortressLevel >= 3 ? ' (+2 к кубикам защищающихся)' : ''}
            </Text>
            <Text style={styles.placeLine}>
              Город: +1 пехота в каждую защищающуюся армию (добавится при старте боя)
            </Text>
            {logic.isCapital ? <Text style={styles.placeLine}>Это столица государства</Text> : null}
            {fortressRequiresCannon(logic.fortressLevel) ? (
              <Text style={styles.placeLine}>Крепость требует пушку у нападающих</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.placeLine}>Поле: городских бонусов нет</Text>
        )}
      </View>

      {logic.cannonWarning ? (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Внимание</Text>
          <Text style={styles.warningText}>{logic.cannonWarning}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Баффы и дебаффы армий</Text>
      <Text style={styles.hint}>
        Бонус даёт +1 к значению кубика каждого отряда армии, дебафф — −1. Действуют всё
        сражение. Крепость и пехота города уже учтены в правилах боя.
      </Text>

      {logic.attackers.length > 0 ? (
        <>
          <Text style={styles.sideTitleAttacker}>Атакующие</Text>
          {logic.attackers.map(army => (
            <ArmyGroup key={army.uid} army={army} logic={logic} mode="buffs" />
          ))}
        </>
      ) : null}

      {logic.defenders.length > 0 ? (
        <>
          <Text style={styles.sideTitleDefender}>Защищающиеся</Text>
          {logic.defenders.map(army => (
            <ArmyGroup key={army.uid} army={army} logic={logic} mode="buffs" />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  placeCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  placeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0d47a1',
    marginBottom: 4,
  },
  placeLine: {
    fontSize: 12,
    color: '#1565c0',
    marginBottom: 2,
  },
  warning: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffb74d',
    padding: 12,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e65100',
    marginBottom: 3,
  },
  warningText: {
    fontSize: 12,
    color: '#bf360c',
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#263238',
    marginBottom: 6,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#78909c',
    lineHeight: 17,
    marginBottom: 12,
  },
  sideTitleAttacker: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c62828',
    marginBottom: 6,
  },
  sideTitleDefender: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1565c0',
    marginBottom: 6,
    marginTop: 4,
  },
});

export default BuffsStep;
