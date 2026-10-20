/**
 * Шаг 4. Сражение.
 *
 * Сверху — атакующие, снизу — защищающиеся. У каждого отряда кубик к6
 * (у пушки его нет). Когда все кубики легли, экран сам считает попадания и
 * выбирает самые слабые потери; мастер может переставить выбор и подтвердить.
 * После анимации удара — отступление на 4–6 и новый раунд, пока у сторон есть
 * отряды.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { canRetreat } from '../../../services/battleRules';
import type { BattleLogic } from '../../hooks/useBattleLogic';
import ArmyGroup from '../components/ArmyGroup';
import DieButton from '../components/DieButton';
import OutcomePanel from '../components/OutcomePanel';

const PHASE_HINTS: Record<string, string> = {
  rolling:
    'Бросайте кубики: нажмите на кубик у отряда или «Бросить все» у армии. Пушка в бою не участвует.',
  casualties:
    'Система выбрала самые слабые отряды. Можно поменять выбор — нажмите на карточку. Затем подтвердите.',
  animating: 'Отряды бьют друг друга…',
  retreat: 'Обе армии сохранились. Любая армия может отступить: для этого нужен бросок 4–6.',
  finished: 'Сражение завершено.',
};

const BattleStep: React.FC<{ logic: BattleLogic }> = ({ logic }) => {
  const { phase, victims, hits, battleArmies } = logic;

  const animations = useMemo(() => {
    const map: Record<string, 'strike' | 'victim'> = {};
    if (phase !== 'animating') return map;
    [...victims.attacker, ...victims.defender].forEach(uid => {
      map[uid] = 'victim';
    });
    battleArmies.forEach(army => {
      army.troops.forEach(troop => {
        if (map[troop.uid]) return;
        const view = logic.troopView(army, troop);
        if (view.isHit) map[troop.uid] = 'strike';
      });
    });
    return map;
  }, [battleArmies, logic, phase, victims.attacker, victims.defender]);

  const retreatArmies = battleArmies.filter(
    army => !army.retreated && army.troops.length > 0,
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.roundBar}>
        <Text style={styles.roundTitle}>Раунд {logic.round}</Text>
        <Text style={styles.roundHits}>
          попадания: атакующие — {hits.attacker}, защищающиеся — {hits.defender}
        </Text>
      </View>

      {logic.cannonWarning ? (
        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Внимание</Text>
          <Text style={styles.warningText}>{logic.cannonWarning}</Text>
        </View>
      ) : null}

      <Text style={styles.phaseHint}>{PHASE_HINTS[phase]}</Text>

      {phase === 'casualties' ? (
        <View style={styles.casualtiesBlock}>
          <Text style={styles.casualtiesLine}>
            Атакующие нанесли {hits.attacker} — отметьте {Math.min(hits.attacker, logic.troopsBySide.defender)}{' '}
            у защищающихся.
          </Text>
          <Text style={styles.casualtiesLine}>
            Защищающиеся нанесли {hits.defender} — отметьте {Math.min(hits.defender, logic.troopsBySide.attacker)}{' '}
            у атакующих.
          </Text>
          <Text style={styles.casualtiesSelected}>
            выбрано: у атакующих {victims.attacker.length}, у защищающихся {victims.defender.length}
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, logic.victimsReady ? null : styles.primaryDisabled]}
            disabled={!logic.victimsReady}
            onPress={logic.confirmCasualties}
          >
            <Text style={styles.primaryButtonText}>Подтвердить потери</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {phase === 'retreat' ? (
        <View style={styles.retreatBlock}>
          {logic.roundMessage ? <Text style={styles.retreatNote}>{logic.roundMessage}</Text> : null}
          {retreatArmies.map(army => (
            <View key={army.uid} style={styles.retreatRow}>
              <View style={styles.retreatInfo}>
                <Text style={styles.retreatName}>{army.name}</Text>
                <Text style={styles.retreatMeta}>
                  {logic.sideLabel(army.side)} · отрядов: {army.troops.length}
                </Text>
                {army.retreatRoll !== null ? (
                  <Text
                    style={[
                      styles.retreatResult,
                      canRetreat(army.retreatRoll) ? styles.retreatOk : styles.retreatFail,
                    ]}
                  >
                    {canRetreat(army.retreatRoll)
                      ? `отступила (${army.retreatRoll})`
                      : `не смогла (${army.retreatRoll}), остаётся в бою`}
                  </Text>
                ) : null}
              </View>
              <DieButton
                value={army.retreatRoll}
                spinning={!!logic.retreatSpinning[army.uid]}
                disabled={army.retreatRoll !== null || !!logic.retreatSpinning[army.uid]}
                onPress={() => logic.retreatArmy(army.uid)}
                caption="4–6"
              />
            </View>
          ))}
          <TouchableOpacity style={styles.primaryButton} onPress={logic.nextRound}>
            <Text style={styles.primaryButtonText}>Продолжить бой</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.sideTitleAttacker}>Атакующие</Text>
      {logic.attackers.length === 0 ? (
        <Text style={styles.empty}>Атакующих армий нет</Text>
      ) : (
        logic.attackers.map(army => (
          <ArmyGroup
            key={army.uid}
            army={army}
            logic={logic}
            mode="battle"
            animations={animations}
            highlighted={army.side === 'attacker'}
          />
        ))
      )}

      <View style={styles.divider}>
        <Text style={styles.dividerText}>поле боя</Text>
      </View>

      <Text style={styles.sideTitleDefender}>Защищающиеся</Text>
      {logic.defenders.length === 0 ? (
        <Text style={styles.empty}>Защищающихся армий нет</Text>
      ) : (
        logic.defenders.map(army => (
          <ArmyGroup
            key={army.uid}
            army={army}
            logic={logic}
            mode="battle"
            animations={animations}
            highlighted={army.side === 'defender'}
          />
        ))
      )}

      {phase === 'finished' ? <OutcomePanel logic={logic} /> : null}

      {phase === 'casualties' ? (
        <TouchableOpacity
          style={[styles.primaryButton, styles.bottomButton, logic.victimsReady ? null : styles.primaryDisabled]}
          disabled={!logic.victimsReady}
          onPress={logic.confirmCasualties}
        >
          <Text style={styles.primaryButtonText}>Подтвердить потери</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  roundBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#263238',
  },
  roundHits: {
    fontSize: 11,
    color: '#607d8b',
  },
  warning: {
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffb74d',
    padding: 10,
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e65100',
  },
  warningText: {
    fontSize: 12,
    color: '#bf360c',
    lineHeight: 16,
    marginTop: 2,
  },
  phaseHint: {
    fontSize: 12,
    color: '#78909c',
    lineHeight: 17,
    marginBottom: 10,
  },
  casualtiesBlock: {
    backgroundColor: '#fffde7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fdd835',
    padding: 10,
    marginBottom: 12,
  },
  casualtiesLine: {
    fontSize: 12,
    color: '#5d4037',
    marginBottom: 2,
  },
  casualtiesSelected: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4e342e',
    marginTop: 4,
  },
  retreatBlock: {
    backgroundColor: '#e8eaf6',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  retreatNote: {
    fontSize: 12,
    color: '#283593',
    marginBottom: 6,
  },
  retreatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  retreatInfo: {
    flex: 1,
  },
  retreatName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#263238',
  },
  retreatMeta: {
    fontSize: 11,
    color: '#78909c',
  },
  retreatResult: {
    fontSize: 11,
    marginTop: 2,
  },
  retreatOk: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  retreatFail: {
    color: '#c62828',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryDisabled: {
    backgroundColor: '#b0bec5',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomButton: {
    marginTop: 16,
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
  },
  empty: {
    fontSize: 12,
    color: '#90a4ae',
    marginBottom: 8,
  },
  divider: {
    alignItems: 'center',
    marginVertical: 10,
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
});

export default BattleStep;
