/**
 * Экран «Карта»: интерактивная карта городов и армий.
 *
 * Полотно — картинка бэкенда /images/map/map-base.png (без городов и подписей),
 * метки, подписи и щиты армий рисует клиент; цвета меток — крепость (0..3),
 * корона — столица. Щит армии подписей не имеет:
 *
 *   - нажатие на щит открывает панель армии (состав, набор отрядов, перемещение);
 *   - нажатие на город открывает панель города;
 *   - двойное нажатие по карте предлагает создать армию в этой точке.
 *
 * Полное ТЗ по карте: eraofchange/docs/map/TZ-karta.md (армии — расширение § 4.4).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DataFreshnessBadge from '../components/DataFreshnessBadge';
import { queryKeys } from '../data/keys';
import { imagesBaseUrl } from '../services/images';
import ArmyPanel from './map/ArmyPanel';
import AttackSideSheet from './map/AttackSideSheet';
import BattlePlanPanel from './map/BattlePlanPanel';
import CityPanel from './map/CityPanel';
import CreateArmySheet from './map/CreateArmySheet';
import MapCanvas from './map/MapCanvas';
import MoveStepsSheet from './map/MoveStepsSheet';
import RecruitSheet from './map/RecruitSheet';
import { SHIELD_LEGEND } from './map/armyShields';
import type { AttackSide } from './map/battlePlan';
import { planProblem } from './map/battlePlan';
import {
  FORTRESS_COLORS,
  FORTRESS_NAMES,
  MAP_COLORS,
  MARKER_MAX_DP,
} from './map/mapStyle';
import type { MapCity, MapViewState } from './map/types';
import { useMapLogic } from './hooks/useMapLogic';

/** Отступ под строку статуса: SafeAreaProvider в проекте не подключён. */
const STATUS_TOP = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 44;
const HEADER_HEIGHT = STATUS_TOP + 56;

/** Куда идёт армия — подпись в листе «сколько шагов» (место уже выбрано на карте). */
const destinationLabel = (move: { city: MapCity | null } | null): string =>
  move?.city ? `город ${move.city.name}` : 'поле — точка на карте';

const SHIELD_LEGEND_ICONS: Record<string, ImageSourcePropType> = {
  family: require('../../assets/map/shields/golitsyny.png'),
  enemy: require('../../assets/map/shields/enemy.png'),
  rebel: require('../../assets/map/shields/rebel.png'),
};

const MapScreen = () => {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const landscape = width >= height;

  const panelWidth = Math.min(420, Math.round(width * 0.4));
  const panelHeight = Math.min(460, Math.round(height * 0.56));

  const logic = useMapLogic();
  const [view, setView] = useState<MapViewState | null>(null);
  // Галочка в шапке: показывать общественный порядок земель рядом с названиями.
  const [showLandPo, setShowLandPo] = useState(true);
  // Армии сходятся к месту боя — второй раз кнопку не жмём.
  const [startingBattles, setStartingBattles] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  const imageUrl = `${imagesBaseUrl()}/images/map/map-base.png`;
  const panelOpen = Boolean(logic.selected || logic.selectedArmy);
  const bottomInset = landscape ? 0 : panelOpen || logic.mode === 'move' ? panelHeight : 0;
  const rightInset = landscape && panelOpen ? panelWidth : 0;

  // ─── Сражения на карте ───────────────────────────────────────────────────
  /** Сторона каждой набранной армии: рамка щита на карте. */
  const planSides = useMemo(() => {
    const sides: Record<number, AttackSide> = {};
    logic.plan.forEach(battle => {
      battle.attackerIds.forEach(id => {
        sides[id] = 'attacker';
      });
      battle.defenderIds.forEach(id => {
        sides[id] = 'defender';
      });
    });
    return sides;
  }, [logic.plan]);

  /** Точки набранных сражений: город или армия подсвечиваются на карте. */
  const planTargets = useMemo(
    () => ({
      cities: logic.plan
        .filter(battle => battle.kind === 'city' && battle.cityId !== null)
        .map(battle => battle.cityId as number),
      armies: logic.plan
        .filter(battle => battle.kind === 'army' && battle.armyId !== null)
        .map(battle => battle.armyId as number),
    }),
    [logic.plan],
  );

  const startBattles = () => {
    if (planProblem(logic.plan) || startingBattles) return;
    setStartingBattles(true);
    // Армии сходятся к точке боя и «тратят» шаги (правило: участие в сражении
    // забирает остаток года), затем открывается стол мастера.
    void logic
      .prepareBattles()
      .catch(() => undefined)
      .finally(() => {
        setStartingBattles(false);
        navigation.navigate('Battles' as never);
      });
  };

  /**
   * «Передвинуть»: армию без шагов отпускаем только после предупреждения —
   * правило знает мастер, запрет был бы сильнее правил игры.
   */
  const handleMovePress = () => {
    const steps = logic.selectedArmySteps;
    if (!steps || steps.left > 0) {
      logic.startMove();
      return;
    }
    Alert.alert(
      'Шаги закончились',
      `У армии «${logic.selectedArmy?.army.name ?? ''}» потрачено ${steps.spent} из ${
        steps.max
      } шагов — по правилам она не может ходить. Всё равно передвинуть?`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Всё равно передвинуть', onPress: logic.startMove },
      ],
    );
  };

  useEffect(() => {
    Animated.timing(slide, {
      toValue: panelOpen ? 1 : 0,
      duration: panelOpen ? 180 : 160,
      useNativeDriver: true,
    }).start();
  }, [panelOpen, slide]);

  const panelTranslate = landscape
    ? slide.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] })
    : slide.interpolate({ inputRange: [0, 1], outputRange: [panelHeight, 0] });

  const panelStyle = landscape
    ? { transform: [{ translateX: panelTranslate }] }
    : { transform: [{ translateY: panelTranslate }] };

  const showLegend =
    !panelOpen && logic.mode !== 'move' && !logic.dragging && logic.plan.length === 0;

  return (
    <View style={styles.container}>
      <MapCanvas
        cities={logic.cities}
        armies={logic.armies}
        regions={logic.regions}
        showLandPo={showLandPo}
        selectedId={logic.selectedId}
        selectedArmyId={logic.selectedArmyId}
        view={view}
        onViewChange={setView}
        onTap={logic.tap}
        onDoubleTap={logic.doubleTap}
        focus={logic.focus}
        imageUrl={imageUrl}
        bottomInset={bottomInset}
        rightInset={rightInset}
        planSides={planSides}
        planTargets={planTargets}
        onDragChange={logic.setDragging}
        onAttackDrop={logic.openAttackSide}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Назад к настройкам"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Карта</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.poToggle}
            onPress={() => setShowLandPo(value => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showLandPo }}
            accessibilityLabel="Показывать общественный порядок земель"
          >
            <View style={[styles.checkbox, showLandPo && styles.checkboxOn]}>
              {showLandPo ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.poToggleText}>ОП земель</Text>
          </TouchableOpacity>
          <DataFreshnessBadge
            keys={[
              queryKeys.settlements(),
              queryKeys.regions(),
              queryKeys.players(),
              queryKeys.armies(),
            ]}
            style={styles.badge}
          />
        </View>
      </View>

      {logic.mode === 'move' ? (
        <View style={[styles.moveBanner, { top: HEADER_HEIGHT + 8 }]}>
          <Text style={styles.moveText}>
            Куда передвинуть армию «{logic.selectedArmy?.army.name ?? ''}»? Нажмите на карте: по
            городу армия встанет в город. Затем выберите, сколько шагов она потратит.
          </Text>
          <TouchableOpacity
            style={styles.moveCancel}
            onPress={logic.cancelMove}
            accessibilityRole="button"
            accessibilityLabel="Отменить перемещение"
          >
            <Text style={styles.moveCancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {logic.dragging ? (
        <View style={[styles.dragBanner, { top: HEADER_HEIGHT + 8 }]} pointerEvents="none">
          <Text style={styles.dragText}>
            Отпустите армию на городе или на другой армии — затем выберите сторону сражения.
            Отпустите на пустом месте, чтобы отменить.
          </Text>
        </View>
      ) : null}

      {showLegend ? (
        <View style={[styles.legend, { bottom: bottomInset + 16 }]} pointerEvents="none">
          <Text style={styles.legendTitle}>Крепость</Text>
          {FORTRESS_COLORS.map((color, index) => (
            <View key={color} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{FORTRESS_NAMES[index]}</Text>
            </View>
          ))}
          <Text style={styles.legendNote}>корона — столица, башня — город</Text>
          {showLandPo ? (
            <Text style={styles.legendNote}>
              общественный порядок земли — в скобках у названия: красный минус, зелёный 0 и
              выше
            </Text>
          ) : null}

          <Text style={[styles.legendTitle, styles.legendTitleArmies]}>Армии</Text>
          {SHIELD_LEGEND.map(item => (
            <View key={item.key} style={styles.legendRow}>
              <Image
                source={SHIELD_LEGEND_ICONS[item.key]}
                style={styles.legendShield}
                resizeMode="contain"
              />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
          <Text style={styles.legendNote}>двойное нажатие — новая армия</Text>
        </View>
      ) : null}

      {logic.isLoading && logic.cities.length === 0 ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator color={MAP_COLORS.accent} />
          <Text style={styles.centerText}>Загрузка карты…</Text>
        </View>
      ) : null}

      {!logic.isLoading && logic.cities.length === 0 ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <Text style={styles.centerText}>
            {logic.isOffline
              ? 'Нет связи с сервером — карта недоступна'
              : 'На карте нет городов: координаты не заданы'}
          </Text>
        </View>
      ) : null}

      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, panelStyle]}>
        {logic.selectedArmy ? (
          <ArmyPanel
            item={logic.selectedArmy}
            busy={logic.busy}
            error={logic.actionError}
            steps={logic.selectedArmySteps}
            side={landscape ? 'right' : 'bottom'}
            onClose={logic.clearSelection}
            onRecruit={logic.openRecruit}
            onMove={handleMovePress}
          />
        ) : logic.selected ? (
          <CityPanel
            city={logic.selected}
            players={logic.players}
            busy={logic.busy}
            error={logic.actionError}
            side={landscape ? 'right' : 'bottom'}
            onClose={logic.clearSelection}
            onSetOwner={logic.setOwner}
            onBuildFortress={logic.buildFortress}
            onUpgradeFortress={logic.upgradeFortress}
          />
        ) : null}
      </Animated.View>

      <RecruitSheet
        visible={logic.recruitOpen}
        item={logic.selectedArmy}
        troopTypes={logic.troopTypes}
        resources={logic.resources}
        busy={logic.busy}
        error={logic.actionError}
        onClose={logic.closeRecruit}
        onConfirm={logic.purchaseTroops}
      />

      <CreateArmySheet
        visible={logic.createTarget !== null}
        point={logic.createTarget?.point ?? null}
        city={logic.createTarget?.city ?? null}
        defaultName={logic.createTarget?.defaultName ?? ''}
        suggestedOwner={logic.createTarget?.suggestedOwner ?? null}
        countries={logic.countries}
        players={logic.players}
        busy={logic.busy}
        error={logic.actionError}
        onClose={logic.closeCreate}
        onCreate={logic.createArmy}
      />

      {logic.plan.length > 0 && !logic.dragging ? (
        <BattlePlanPanel
          plan={logic.plan}
          bottom={bottomInset + 16}
          busy={logic.busy || startingBattles}
          onStart={startBattles}
          onClear={logic.clearPlan}
          onRemove={logic.removeBattle}
        />
      ) : null}

      <MoveStepsSheet
        visible={logic.pendingMove !== null}
        armyName={logic.selectedArmy?.army.name ?? ''}
        steps={logic.selectedArmySteps}
        destination={destinationLabel(logic.pendingMove)}
        busy={logic.busy}
        onPick={logic.confirmMove}
        onCancel={logic.cancelPendingMove}
      />

      <AttackSideSheet
        visible={logic.pendingAttack !== null}
        armyName={logic.pendingAttack?.armyName ?? ''}
        target={logic.pendingAttack?.target ?? null}
        current={logic.pendingBattle}
        assignedTo={logic.pendingAssignedTo}
        onPick={logic.confirmAttackSide}
        onCancel={logic.cancelAttackSide}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAP_COLORS.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    paddingTop: STATUS_TOP,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAP_COLORS.header,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: MAP_COLORS.text,
    fontSize: 30,
    lineHeight: 34,
    marginTop: -4,
  },
  title: {
    flex: 1,
    color: MAP_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  poToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: MAP_COLORS.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: MAP_COLORS.accent,
    backgroundColor: MAP_COLORS.accent,
  },
  checkMark: {
    color: '#1d1a14',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  poToggleText: {
    color: MAP_COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  moveBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(36,31,24,0.95)',
    borderWidth: 1,
    borderColor: MAP_COLORS.accent,
  },
  moveText: {
    color: MAP_COLORS.text,
    fontSize: 13,
  },
  dragBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(36,31,24,0.95)',
    borderWidth: 1,
    borderColor: MAP_COLORS.target,
  },
  dragText: {
    color: MAP_COLORS.text,
    fontSize: 13,
  },
  moveCancel: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: MAP_COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
  },
  moveCancelText: {
    color: MAP_COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  legend: {
    position: 'absolute',
    left: 16,
    maxWidth: 280,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(36,31,24,0.88)',
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    gap: 4,
  },
  legendTitle: {
    color: MAP_COLORS.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  legendTitleArmies: {
    marginTop: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: MARKER_MAX_DP * 0.45,
    height: MARKER_MAX_DP * 0.45,
    borderRadius: MARKER_MAX_DP * 0.225,
    borderWidth: 1,
    borderColor: '#f4ead8',
  },
  legendShield: {
    width: MARKER_MAX_DP * 0.45,
    height: MARKER_MAX_DP * 0.55,
  },
  legendText: {
    color: MAP_COLORS.text,
    fontSize: 12,
  },
  legendNote: {
    color: MAP_COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  centerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '45%',
    alignItems: 'center',
    gap: 8,
  },
  centerText: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

export default MapScreen;
