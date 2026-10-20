/**
 * Группа отрядов одной армии: подпись армии, её отряды-карточки и действия,
 * доступные на текущем шаге.
 *
 *  - setup — состав боя: добавить/убрать отряды, убрать армию, сменить сторону;
 *  - buffs — баффы/дебаффы армии (−1/+1 к кубикам каждого отряда);
 *  - battle — кубики, «бросить все», выбор потерь и анимация удара.
 */
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { armyModifier, TROOP_KINDS, TROOP_LABEL, troopPower } from '../../../services/battleRules';
import type { BattleArmy, BattleLogic } from '../../hooks/useBattleLogic';
import { TROOP_IMAGE } from '../troopImages';
import TroopCard from './TroopCard';

interface ArmyGroupProps {
  army: BattleArmy;
  logic: BattleLogic;
  mode: 'setup' | 'buffs' | 'battle';
  animations?: Record<string, 'strike' | 'victim'>;
  highlighted?: boolean;
}

const ArmyGroup: React.FC<ArmyGroupProps> = ({ army, logic, mode, animations, highlighted }) => {
  const modifier = armyModifier(army.bonus, army.debuff);
  const side = army.side;
  const victims = logic.victims[side];
  // Потери этой стороны приносят попадания противоположной.
  const incomingHits = side === 'attacker' ? logic.hits.defender : logic.hits.attacker;

  const rollAllDisabled =
    mode !== 'battle' ||
    army.retreated ||
    logic.phase !== 'rolling' ||
    !army.troops.some(troop => troop.kind !== 'cannon');

  return (
    <View style={[styles.group, highlighted ? styles.groupHighlighted : null]}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{army.name}</Text>
          <Text style={styles.owner}>
            {army.ownerName} · {logic.sideLabel(side)}
          </Text>
        </View>
        {mode === 'battle' ? (
          <TouchableOpacity
            style={[styles.rollAll, rollAllDisabled ? styles.rollAllDisabled : null]}
            onPress={() => logic.rollArmy(army.uid)}
            disabled={rollAllDisabled}
          >
            <Text style={styles.rollAllText}>Бросить все</Text>
          </TouchableOpacity>
        ) : null}
        {mode !== 'battle' ? (
          <>
            {!army.isGarrison ? (
              <TouchableOpacity
                style={styles.changeSide}
                onPress={() => logic.changeSide(army.uid, army.side === 'attacker' ? 'defender' : 'attacker')}
              >
                <Text style={styles.changeSideText}>
                  {army.side === 'attacker' ? 'В защиту' : 'В атаку'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.removeArmy}
              onPress={() => logic.removeArmy(army.uid)}
              accessibilityLabel={`Убрать армию ${army.name}`}
            >
              <Text style={styles.removeArmyText}>Убрать</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {mode === 'battle' ? (
        <View style={styles.statsRow}>
          <Text style={styles.stat}>отрядов: {army.troops.length}</Text>
          <Text style={styles.stat}>сила: {army.troops.reduce((sum, t) => sum + troopPower(t.kind), 0)}</Text>
          {modifier !== 0 ? (
            <Text style={[styles.stat, modifier > 0 ? styles.statGood : styles.statBad]}>
              к кубикам: {modifier > 0 ? `+${modifier}` : modifier}
            </Text>
          ) : null}
          {army.retreated ? <Text style={styles.statRetreated}>отступила</Text> : null}
        </View>
      ) : null}

      {mode === 'buffs' ? (
        <View style={styles.modsRow}>
          <View style={styles.modControl}>
            <Text style={styles.modLabel}>Бонус</Text>
            <View style={styles.modButtons}>
              <TouchableOpacity
                style={styles.modButton}
                onPress={() => logic.changeBonus(army.uid, -1)}
              >
                <Text style={styles.modButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.modValue}>+{army.bonus}</Text>
              <TouchableOpacity
                style={styles.modButton}
                onPress={() => logic.changeBonus(army.uid, 1)}
              >
                <Text style={styles.modButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.modControl}>
            <Text style={styles.modLabel}>Дебафф</Text>
            <View style={styles.modButtons}>
              <TouchableOpacity
                style={styles.modButton}
                onPress={() => logic.changeDebuff(army.uid, -1)}
              >
                <Text style={styles.modButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.modValue}>−{army.debuff}</Text>
              <TouchableOpacity
                style={styles.modButton}
                onPress={() => logic.changeDebuff(army.uid, 1)}
              >
                <Text style={styles.modButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.modNet, modifier > 0 ? styles.statGood : modifier < 0 ? styles.statBad : null]}>
            итого к кубику: {modifier > 0 ? `+${modifier}` : modifier}
          </Text>
        </View>
      ) : null}

      {army.troops.length === 0 ? (
        <Text style={styles.empty}>В армии нет отрядов</Text>
      ) : (
        army.troops.map(troop => {
          const view = logic.troopView(army, troop);
          const inBattle = mode === 'battle';
          return (
            <TroopCard
              key={troop.uid}
              troop={troop}
              view={view}
              compact={!inBattle}
              onRoll={inBattle ? () => logic.rollTroop(troop.uid) : undefined}
              rollDisabled={!inBattle || army.retreated || logic.phase !== 'rolling'}
              selectable={inBattle && logic.phase === 'casualties' && !army.retreated && incomingHits > 0}
              selected={inBattle && victims.includes(troop.uid)}
              onPress={
                inBattle ? () => logic.toggleVictim(side, troop.uid) : undefined
              }
              onRemove={mode === 'setup' ? () => logic.removeTroop(army.uid, troop.uid) : undefined}
              showDie={mode === 'battle' && !army.retreated}
              animation={animations ? animations[troop.uid] || null : null}
              direction={side === 'attacker' ? 1 : -1}
            />
          );
        })
      )}

      {mode === 'setup' ? (
        <View style={styles.addRow}>
          <Text style={styles.addLabel}>Добавить отряд:</Text>
          <View style={styles.addButtons}>
            {TROOP_KINDS.map(kind => (
              <TouchableOpacity
                key={kind}
                style={styles.addButton}
                onPress={() => logic.addTroop(army.uid, kind)}
              >
                <Image source={TROOP_IMAGE[kind]} style={styles.addIcon} />
                <Text style={styles.addButtonText}>{TROOP_LABEL[kind]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  group: {
    backgroundColor: '#f7f9fb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e8ee',
    padding: 10,
    marginBottom: 12,
  },
  groupHighlighted: {
    borderColor: '#c62828',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#263238',
  },
  owner: {
    fontSize: 12,
    color: '#607d8b',
    marginTop: 2,
  },
  rollAll: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rollAllDisabled: {
    backgroundColor: '#b0bec5',
  },
  rollAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeArmy: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeArmyText: {
    color: '#c62828',
    fontSize: 12,
    fontWeight: '600',
  },
  changeSide: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  changeSideText: {
    color: '#1565c0',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  stat: {
    fontSize: 11,
    color: '#607d8b',
    marginRight: 12,
  },
  statGood: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  statBad: {
    color: '#c62828',
    fontWeight: '700',
  },
  statRetreated: {
    fontSize: 11,
    color: '#8d6e63',
    fontWeight: '700',
  },
  modsRow: {
    marginBottom: 8,
  },
  modControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modLabel: {
    width: 70,
    fontSize: 12,
    color: '#455a64',
  },
  modButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modButtonText: {
    fontSize: 16,
    color: '#1565c0',
    fontWeight: '700',
    lineHeight: 18,
  },
  modValue: {
    minWidth: 34,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#263238',
  },
  modNet: {
    fontSize: 12,
    color: '#607d8b',
    marginTop: 2,
  },
  empty: {
    fontSize: 12,
    color: '#90a4ae',
    marginBottom: 6,
  },
  addRow: {
    marginTop: 4,
  },
  addLabel: {
    fontSize: 11,
    color: '#78909c',
    marginBottom: 4,
  },
  addButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  addIcon: {
    width: 20,
    height: 20,
    marginRight: 4,
    resizeMode: 'contain',
  },
  addButtonText: {
    fontSize: 11,
    color: '#37474f',
  },
});

export default ArmyGroup;
