/**
 * Экран «Сражения»: пошаговый стол мастера.
 *
 *   1. место — поле или город (страна → город);
 *   2. армии с бэкенда: атакующие сверху, защищающиеся снизу, плюс отряды;
 *   3. баффы/дебаффы армий (город и крепость учитываются автоматически);
 *   4. бой на к6 с авто-выбором потерь, анимацией удара и отступлением.
 *
 * Данные (армии, поселения, регионы) идут через единый слой `src/data`:
 * ключи перечислены и в `useRefetchOnFocus`, и в шильдике свежести — расхождение
 * ключей давало бы фантомное «нет связи».
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DataFreshnessBadge from '../components/DataFreshnessBadge';
import { queryKeys } from '../data/keys';
import { useRefetchOnFocus } from '../data/useRefetchOnFocus';
import { useBattleLogic } from './hooks/useBattleLogic';
import StepBar from './battles/components/StepBar';
import PlaceStep from './battles/steps/PlaceStep';
import ArmiesStep from './battles/steps/ArmiesStep';
import BuffsStep from './battles/steps/BuffsStep';
import BattleStep from './battles/steps/BattleStep';

const BattlesScreen = () => {
  const navigation = useNavigation();
  const logic = useBattleLogic();

  useRefetchOnFocus([
    queryKeys.armies(),
    queryKeys.allCountries(),
    queryKeys.settlements(),
    queryKeys.regions(),
    queryKeys.players(),
  ]);

  const nextLabel =
    logic.step === 'place' ? 'К армиям' : logic.step === 'armies' ? 'К баффам' : 'Начать бой';

  const nextDisabled =
    logic.step === 'place'
      ? !logic.placeReady
      : logic.step === 'armies'
        ? !logic.battleReady
        : false;

  // Бой идёт на весь экран: шапка экрана и полоса шагов на этом шаге не рендерятся.
  const fullscreen = logic.step === 'battle';

  return (
    <View style={[styles.container, fullscreen ? styles.containerFullscreen : null]}>
      {fullscreen ? null : (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.back}
            onPress={() => (logic.step === 'place' ? navigation.goBack() : logic.goBack())}
            accessibilityLabel={logic.step === 'place' ? 'Назад к настройкам' : 'Предыдущий шаг'}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Сражения</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {logic.placeTitle}
            </Text>
          </View>
          <DataFreshnessBadge
            keys={[
              queryKeys.armies(),
              queryKeys.allCountries(),
              queryKeys.settlements(),
              queryKeys.regions(),
              queryKeys.players(),
            ]}
            style={styles.badge}
          />
        </View>
      )}

      {logic.step !== 'battle' ? <StepBar step={logic.step} /> : null}

      <View style={styles.body}>
        {logic.step === 'place' ? <PlaceStep logic={logic} /> : null}
        {logic.step === 'armies' ? <ArmiesStep logic={logic} /> : null}
        {logic.step === 'buffs' ? <BuffsStep logic={logic} /> : null}
        {logic.step === 'battle' ? <BattleStep logic={logic} /> : null}
      </View>

      {logic.step !== 'battle' ? (
        <View style={styles.footer}>
          {logic.step !== 'place' ? (
            <TouchableOpacity style={styles.footerBack} onPress={logic.goBack}>
              <Text style={styles.footerBackText}>Назад</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.footerNext, nextDisabled ? styles.footerNextDisabled : null]}
            onPress={logic.goNext}
            disabled={nextDisabled}
          >
            <Text style={styles.footerNextText}>{nextLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  containerFullscreen: {
    // Бой занимает весь экран: тёмный фон вместо светло-серого, чтобы на
    // краях не было белых полос при повороте и на широких планшетах.
    backgroundColor: '#263238',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 46,
    paddingBottom: 12,
    backgroundColor: '#1976d2',
  },
  back: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 32,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 11,
    color: '#bbdefb',
    marginTop: 2,
  },
  badge: {
    marginLeft: 8,
  },
  body: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerBack: {
    borderWidth: 1,
    borderColor: '#90a4ae',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginRight: 10,
  },
  footerBackText: {
    fontSize: 13,
    color: '#546e7a',
    fontWeight: '600',
  },
  footerNext: {
    flex: 1,
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerNextDisabled: {
    backgroundColor: '#b0bec5',
  },
  footerNextText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default BattlesScreen;
