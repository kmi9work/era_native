/**
 * Экран «Карта»: интерактивная карта городов.
 *
 * Полотно — картинка бэкенда /images/map/map-base.png (без городов и подписей),
 * метки и подписи рисует клиент; цвета меток — крепость (0..3), корона — столица.
 * Нажатие на город открывает панель с данными и действиями мастера.
 * Полное ТЗ: eraofchange/docs/map/TZ-karta.md.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DataFreshnessBadge from '../components/DataFreshnessBadge';
import { queryKeys } from '../data/keys';
import { imagesBaseUrl } from '../services/images';
import CityPanel from './map/CityPanel';
import MapCanvas from './map/MapCanvas';
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

const MapScreen = () => {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const landscape = width >= height;

  const panelWidth = Math.min(420, Math.round(width * 0.4));
  const panelHeight = Math.min(440, Math.round(height * 0.52));

  const logic = useMapLogic();
  const [view, setView] = useState<MapViewState | null>(null);
  const [panelCity, setPanelCity] = useState<MapCity | null>(null);
  const slide = useRef(new Animated.Value(0)).current;

  const imageUrl = `${imagesBaseUrl()}/images/map/map-base.png`;
  const bottomInset = landscape ? 0 : panelCity ? panelHeight : 0;
  const rightInset = landscape && panelCity ? panelWidth : 0;

  // Данные города обновляются после действий (владелец, крепость) — панель
  // должна показать свежий объект, а не снимок на момент выбора.
  useEffect(() => {
    if (logic.selected) setPanelCity(logic.selected);
  }, [logic.selected]);

  useEffect(() => {
    if (logic.selectedId) {
      if (logic.selected) setPanelCity(logic.selected);
      Animated.timing(slide, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setPanelCity(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logic.selectedId]);

  const panelTranslate = landscape
    ? slide.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] })
    : slide.interpolate({ inputRange: [0, 1], outputRange: [panelHeight, 0] });

  const panelStyle = landscape
    ? { transform: [{ translateX: panelTranslate }] }
    : { transform: [{ translateY: panelTranslate }] };

  return (
    <View style={styles.container}>
      <MapCanvas
        cities={logic.cities}
        selectedId={logic.selectedId}
        view={view}
        onViewChange={setView}
        onSelect={logic.select}
        onDeselect={logic.clearSelection}
        imageUrl={imageUrl}
        bottomInset={bottomInset}
        rightInset={rightInset}
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
          <DataFreshnessBadge
            keys={[queryKeys.settlements(), queryKeys.regions(), queryKeys.players()]}
            style={styles.badge}
          />
        </View>
      </View>

      {!panelCity ? (
        <View style={[styles.legend, { bottom: bottomInset + 16 }]} pointerEvents="none">
          <Text style={styles.legendTitle}>Крепость</Text>
          {FORTRESS_COLORS.map((color, index) => (
            <View key={color} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{FORTRESS_NAMES[index]}</Text>
            </View>
          ))}
          <Text style={styles.legendNote}>корона — столица, башня — город</Text>
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

      {panelCity ? (
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, panelStyle]}
        >
          <CityPanel
            city={panelCity}
            players={logic.players}
            busy={logic.busy}
            error={logic.actionError}
            side={landscape ? 'right' : 'bottom'}
            onClose={logic.clearSelection}
            onSetOwner={logic.setOwner}
            onBuildFortress={logic.buildFortress}
            onUpgradeFortress={logic.upgradeFortress}
          />
        </Animated.View>
      ) : null}
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
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  legend: {
    position: 'absolute',
    left: 16,
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
