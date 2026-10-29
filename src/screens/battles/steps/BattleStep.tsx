/**
 * Шаг 4. Сражение — сцена, а не таблица.
 *
 * Композиция: табло (HUD) → сцена с фишками → лента боя → управление по фазе.
 * Экран не прокручивается: сцена занимает всё место, а «Состав» и итог
 * открываются поверх неё. Раунд проигрывает `useScenePlayer`, поэтому в фазе
 * `playing` остаётся одна кнопка — «Пропустить».
 *
 * Ручной выбор потерь сохранён: в фазе `casualties` мастер касается фишки и
 * меняет авто-выбор (это правило игры, а не оформление).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { canRetreat } from '../../../services/battleRules';
import DataFreshnessBadge from '../../../components/DataFreshnessBadge';
import { queryKeys } from '../../../data/keys';
import type { BattleLogic } from '../../hooks/useBattleLogic';
import BattleLog from '../board/BattleLog';
import BattleStage from '../board/BattleStage';
import DieBadge from '../board/DieBadge';
import Hud from '../board/Hud';
import RosterSheet from '../board/RosterSheet';
import OutcomePanel from '../components/OutcomePanel';

const PHASE_HINTS: Record<string, string> = {
  rolling:
    'Нажмите «Ход» — кубики бросит вся армия сразу. Можно бросать по одному, касаясь кубика у отряда.',
  casualties:
    'Крупная цифра у строя — сколько отрядов этой стороны обязано погибнуть. Касание фишки снимает или ставит метку потери; затем подтвердите потери.',
  playing: 'Идёт бой: удары, потери, лента событий.',
  retreat: 'Обе стороны сохранились. Любая армия может отступить: нужен бросок 4–6.',
  finished: 'Сражение завершено.',
};

/**
 * Бой идёт на весь экран, поверх шапки экрана «Сражения», поэтому табло само
 * отступает под строку статуса. `SafeAreaProvider` в проекте не подключён —
 * берём высоту строки статуса у платформы.
 */
const STATUS_TOP = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 44;

const BattleStep: React.FC<{ logic: BattleLogic }> = ({ logic }) => {
  const [rosterVisible, setRosterVisible] = useState(false);

  // Системная «назад» на полноэкранном бою возвращает к баффам, а не выкидывает
  // из экрана «Сражения» вместе с набранной сценой.
  const goBack = logic.goBack;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]);

  // Силы сторон на начало боя: полосы в HUD должны показывать потери, а не
  // «сколько было минуту назад». Сцена монтируется один раз на бой.
  const initialTroops = useRef({
    attacker: logic.troopsBySide.attacker,
    defender: logic.troopsBySide.defender,
  });

  const retreatArmies = logic.battleArmies.filter(army => !army.retreated && army.troops.length > 0);

  /**
   * «Закончить сражение» в перерыве между раундами: уход стороны — решение
   * мастера, а не бросок 4–6. Сценарии различаются итогом, а не кнопкой:
   * в поле и при уходе атакующих из-под осады — финальный экран сражения, а
   * если защищающиеся оставляют город, к нему добавляется передача владельца.
   */
  const askFinishBattle = () => {
    Alert.alert(
      'Закончить сражение',
      logic.placeKind === 'city'
        ? 'Кто уходит из боя? Если город оставляют защищающиеся — в итоге появится передача владельца города.'
        : 'Кто уходит из боя?',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Атакующие уходят', onPress: () => logic.finishBattle('attacker') },
        { text: 'Защищающиеся уходят', onPress: () => logic.finishBattle('defender') },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Hud
        round={logic.round}
        placeTitle={logic.placeTitle}
        hint={PHASE_HINTS[logic.phase] || ''}
        troops={logic.troopsBySide}
        initial={initialTroops.current}
        topInset={STATUS_TOP}
        onBack={logic.goBack}
      />

      <BattleStage logic={logic} />
      <BattleLog lines={logic.sceneLog} />

      {logic.phase === 'retreat' ? (
        <View style={styles.retreat}>
          {logic.roundMessage ? (
            <Text style={styles.retreatNote}>{logic.roundMessage}</Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {retreatArmies.map(army => (
              <View key={army.uid} style={styles.retreatCard}>
                <Text style={styles.retreatName} numberOfLines={1}>
                  {army.name}
                </Text>
                <Text style={styles.retreatMeta}>
                  {logic.sideLabel(army.side)} · отрядов: {army.troops.length}
                </Text>
                <TouchableOpacity
                  onPress={() => logic.retreatArmy(army.uid)}
                  disabled={army.retreatRoll !== null || !!logic.retreatSpinning[army.uid]}
                  accessibilityLabel={`Бросить отступление: ${army.name}`}
                >
                  <DieBadge
                    value={army.retreatRoll}
                    spinning={!!logic.retreatSpinning[army.uid]}
                    size={30}
                  />
                </TouchableOpacity>
                {army.retreatRoll !== null ? (
                  <Text
                    style={[
                      styles.retreatResult,
                      canRetreat(army.retreatRoll) ? styles.retreatOk : styles.retreatFail,
                    ]}
                  >
                    {canRetreat(army.retreatRoll)
                      ? `отступила (${army.retreatRoll})`
                      : `не смогла (${army.retreatRoll})`}
                  </Text>
                ) : (
                  <Text style={styles.retreatHint}>4–6</Text>
                )}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.finishButton}
            onPress={askFinishBattle}
            accessibilityLabel="Закончить сражение"
          >
            <Text style={styles.finishButtonText}>Закончить сражение</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.controls}>
        {logic.phase === 'casualties' ? (
          <Text style={styles.casualtiesText} numberOfLines={2}>
            Атакующие получили {logic.incomingHits.attacker} — отметьте{' '}
            {logic.lossLimit('attacker')}; защищающиеся получили{' '}
            {logic.incomingHits.defender} — отметьте {logic.lossLimit('defender')}.
          </Text>
        ) : null}

        <TouchableOpacity style={styles.rosterButton} onPress={() => setRosterVisible(true)}>
          <Text style={styles.rosterButtonText}>Состав</Text>
        </TouchableOpacity>

        {logic.phase === 'rolling' ? (
          <TouchableOpacity
            style={[styles.primary, logic.canRollAll ? null : styles.primaryDisabled]}
            onPress={logic.rollAll}
            disabled={!logic.canRollAll}
          >
            <Text style={styles.primaryText}>Ход</Text>
          </TouchableOpacity>
        ) : null}

        {logic.phase === 'casualties' ? (
          <TouchableOpacity
            style={[styles.primary, logic.victimsReady ? null : styles.primaryDisabled]}
            onPress={logic.confirmCasualties}
            disabled={!logic.victimsReady}
          >
            <Text style={styles.primaryText}>Подтвердить потери</Text>
          </TouchableOpacity>
        ) : null}

        {logic.phase === 'playing' ? (
          <TouchableOpacity style={styles.secondary} onPress={logic.skipScene}>
            <Text style={styles.secondaryText}>Пропустить</Text>
          </TouchableOpacity>
        ) : null}

        {logic.phase === 'retreat' ? (
          <TouchableOpacity style={styles.primary} onPress={logic.nextRound}>
            <Text style={styles.primaryText}>Продолжить бой</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {logic.phase === 'finished' ? (
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayContent}>
            <OutcomePanel logic={logic} />
          </ScrollView>
        </View>
      ) : null}

      <RosterSheet
        visible={rosterVisible}
        logic={logic}
        onClose={() => setRosterVisible(false)}
        badge={
          <DataFreshnessBadge
            keys={[
              queryKeys.armies(),
              queryKeys.allCountries(),
              queryKeys.settlements(),
              queryKeys.regions(),
              queryKeys.players(),
            ]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  retreat: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
    backgroundColor: '#e8eaf6',
    borderTopWidth: 1,
    borderTopColor: '#c5cae9',
  },
  retreatNote: {
    fontSize: 11,
    color: '#283593',
    marginBottom: 4,
  },
  retreatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 8,
    marginRight: 8,
    minWidth: 132,
    alignItems: 'center',
  },
  retreatName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#263238',
    maxWidth: 120,
  },
  retreatMeta: {
    fontSize: 10,
    color: '#78909c',
    marginBottom: 4,
  },
  retreatResult: {
    fontSize: 10,
    marginTop: 3,
  },
  retreatOk: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  retreatFail: {
    color: '#c62828',
    fontWeight: '700',
  },
  retreatHint: {
    fontSize: 10,
    color: '#90a4ae',
    marginTop: 3,
  },
  finishButton: {
    borderWidth: 1,
    borderColor: '#c62828',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  finishButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c62828',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    // Запас под системную панель навигации: бой идёт до самого низа экрана.
    paddingBottom: Platform.OS === 'android' ? 14 : 24,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  casualtiesText: {
    flex: 1,
    fontSize: 10,
    color: '#5d4037',
    lineHeight: 13,
    marginRight: 8,
  },
  rosterButton: {
    borderWidth: 1,
    borderColor: '#90a4ae',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 8,
  },
  rosterButtonText: {
    fontSize: 12,
    color: '#546e7a',
    fontWeight: '600',
  },
  primary: {
    flex: 1,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryDisabled: {
    backgroundColor: '#b0bec5',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#1565c0',
    fontSize: 13,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 30, 0.55)',
    justifyContent: 'center',
  },
  overlayContent: {
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
});

export default BattleStep;
