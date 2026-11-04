/**
 * Полотно карты: картинка с бэкенда, метки и подписи городов, жесты.
 *
 * Время и движение: пинч/пан двигают shared values Reanimated (без ре-рендера
 * React), на отпускании масштаб и смещение коммитятся в состояние экрана — тогда
 * же пересчитываются размеры меток и подписей (они не должны расти бесконечно).
 * Нажатие ловит один Tap-жест и ищет ближайший город в радиусе — так попадать
 * по мелким меткам проще, чем по каждой в отдельности.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import CityLabel from './CityLabel';
import CityMarker from './CityMarker';
import MapControls from './MapControls';
import { labelLayoutFor } from './cityLayout';
import {
  LABEL_ALL_ZOOM,
  LABEL_ALWAYS_FONT,
  LABEL_MAX_DP,
  LABEL_MIN_DP,
  LABEL_SCALE_FACTOR,
  MAP_BASE_SIZE,
  MARKER_MAX_DP,
  MARKER_MIN_DP,
  markerColor,
} from './mapStyle';
import type { MapCity, MapViewState } from './types';

interface Props {
  cities: MapCity[];
  selectedId: number | null;
  view: MapViewState | null;
  onViewChange: (view: MapViewState) => void;
  onSelect: (city: MapCity) => void;
  onDeselect: () => void;
  imageUrl: string;
  /** Сколько места снизу занято панелью (портрет) — кнопки поднимаются выше. */
  bottomInset: number;
  /** Сдвиг центра при открытой панели справа (ландшафт). */
  rightInset: number;
}

/** Максимальный зум относительно «вписана» — дальше исходник 2881 px мылит. */
const MAX_ZOOM = 4;

/** Радиус попадания по метке, dp. */
const HIT_RADIUS = 26;

/** Кегль исходной карты переводим в единицы полотна. */
const DESIGN_FONT_SCALE = MAP_BASE_SIZE / 2881;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const MapCanvas = ({
  cities,
  selectedId,
  view,
  onViewChange,
  onSelect,
  onDeselect,
  imageUrl,
  bottomInset,
  rightInset,
}: Props) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageReady, setImageReady] = useState(false);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Начало жеста — в shared values: обычный объект в worklet между вызовами
  // не сохраняется надёжно (Reanimated копирует замыкание на UI-поток).
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);

  // Границы масштаба зависят от размера полотна на экране
  const limits = useMemo(() => {
    if (!size.width || !size.height) return { fit: 1, min: 1, max: 1 };
    const fit = Math.min(size.width, size.height) / MAP_BASE_SIZE;
    return { fit, min: fit * 0.9, max: fit * MAX_ZOOM };
  }, [size]);

  const clampView = useCallback(
    (next: MapViewState): MapViewState => {
      const { width, height } = size;
      if (!width || !height) return next;
      const mapWidth = MAP_BASE_SIZE * next.scale;
      const mapHeight = MAP_BASE_SIZE * next.scale;
      let tX = next.tx;
      let tY = next.ty;
      if (mapWidth <= width) {
        tX = (width - mapWidth) / 2;
      } else {
        tX = clamp(tX, width - mapWidth, 0);
      }
      if (mapHeight <= height) {
        tY = (height - mapHeight) / 2;
      } else {
        tY = clamp(tY, height - mapHeight, 0);
      }
      return { scale: next.scale, tx: tX, ty: tY };
    },
    [size],
  );

  const fitView = useCallback((): MapViewState => {
    const { width, height } = size;
    const s = limits.fit;
    return {
      scale: s,
      tx: (width - MAP_BASE_SIZE * s) / 2,
      ty: (height - MAP_BASE_SIZE * s) / 2,
    };
  }, [limits.fit, size]);

  const commit = useCallback(
    (next: MapViewState) => onViewChange(clampView(next)),
    [clampView, onViewChange],
  );

  // Пришло новое состояние извне (кнопки, «вписать», центрирование) — анимируем
  useEffect(() => {
    if (!view) return;
    scale.value = withTiming(view.scale, { duration: 160 });
    tx.value = withTiming(view.tx, { duration: 160 });
    ty.value = withTiming(view.ty, { duration: 160 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Первый расклад: вписываем карту
  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!width || !height) return;
    setSize({ width, height });
    if (!view) {
      const s = Math.min(width, height) / MAP_BASE_SIZE;
      onViewChange({
        scale: s,
        tx: (width - MAP_BASE_SIZE * s) / 2,
        ty: (height - MAP_BASE_SIZE * s) / 2,
      });
    }
  };

  // Центрирование выбранного города (с учётом открытой панели)
  useEffect(() => {
    if (!view || !selectedId || !size.width) return;
    const city = cities.find((c) => c.id === selectedId);
    if (!city) return;
    const visibleWidth = size.width - rightInset;
    const visibleHeight = size.height - bottomInset;
    const next = clampView({
      scale: view.scale,
      tx: visibleWidth / 2 - city.x * MAP_BASE_SIZE * view.scale,
      ty: visibleHeight / 2 - city.y * MAP_BASE_SIZE * view.scale,
    });
    onViewChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(12)
        .onEnd((event, success) => {
          if (!success) return;
          runOnJS(handleTap)(event.x, event.y, scale.value, tx.value, ty.value);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities, size],
  );

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .onBegin(() => {
        startTx.value = tx.value;
        startTy.value = ty.value;
      })
      .onUpdate((event) => {
        tx.value = startTx.value + event.translationX;
        ty.value = startTy.value + event.translationY;
      })
      .onEnd(() => {
        runOnJS(commit)({ scale: scale.value, tx: tx.value, ty: ty.value });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);

  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      .onBegin(() => {
        startScale.value = scale.value;
        startTx.value = tx.value;
        startTy.value = ty.value;
      })
      .onUpdate((event) => {
        const next = Math.min(limits.max, Math.max(limits.min, startScale.value * event.scale));
        const k = next / startScale.value;
        scale.value = next;
        tx.value = event.focalX - (event.focalX - startTx.value) * k;
        ty.value = event.focalY - (event.focalY - startTy.value) * k;
      })
      .onEnd(() => {
        runOnJS(commit)({ scale: scale.value, tx: tx.value, ty: ty.value });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, limits.max, limits.min]);

  const gesture = useMemo(
    () => Gesture.Race(tapGesture, Gesture.Simultaneous(pinchGesture, panGesture)),
    [tapGesture, pinchGesture, panGesture],
  );

  function handleTap(screenX: number, screenY: number, s: number, tX: number, tY: number) {
    let best: MapCity | null = null;
    let bestDistance = HIT_RADIUS;
    for (const city of cities) {
      const x = tX + city.x * MAP_BASE_SIZE * s;
      const y = tY + city.y * MAP_BASE_SIZE * s;
      const distance = Math.hypot(x - screenX, y - screenY);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = city;
      }
    }
    if (best) onSelect(best);
    else onDeselect();
  }

  const translateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Размеры меток и подписей пересчитываем от закоммиченного масштаба
  const currentScale = view?.scale ?? limits.fit;
  const fitScale = limits.fit || 1;
  const zoomRatio = clamp(currentScale / fitScale, 1, MAX_ZOOM);
  const markerDp = MARKER_MIN_DP + ((MARKER_MAX_DP - MARKER_MIN_DP) * (zoomRatio - 1)) / (MAX_ZOOM - 1);
  const markerCanvas = markerDp / currentScale;

  const visibleLabels = cities.filter((city) => {
    const layout = labelLayoutFor(city.name);
    const designFont = layout?.font ?? 16.67;
    return designFont >= LABEL_ALWAYS_FONT || zoomRatio >= LABEL_ALL_ZOOM;
  });

  const zoomBy = (factor: number) => {
    if (!view || !size.width) return;
    const nextScale = clamp(view.scale * factor, limits.min, limits.max);
    const k = nextScale / view.scale;
    const centerX = (size.width - rightInset) / 2;
    const centerY = (size.height - bottomInset) / 2;
    onViewChange(
      clampView({
        scale: nextScale,
        tx: centerX - (centerX - view.tx) * k,
        ty: centerY - (centerY - view.ty) * k,
      }),
    );
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={styles.viewport} onLayout={handleLayout}>
          <Animated.View style={[styles.translateLayer, translateStyle]}>
            <Animated.View style={[styles.canvas, scaleStyle]}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="stretch"
                onLoadEnd={() => setImageReady(true)}
              />
              {cities.map((city) => (
                <CityMarker
                  key={`marker-${city.id}`}
                  x={city.x * MAP_BASE_SIZE}
                  y={city.y * MAP_BASE_SIZE}
                  size={markerCanvas}
                  color={markerColor(city.fortress)}
                  capital={city.capital}
                  selected={city.id === selectedId}
                />
              ))}
              {visibleLabels.map((city) => {
                const layout = labelLayoutFor(city.name);
                const designFont = (layout?.font ?? 16.67) * DESIGN_FONT_SCALE;
                const screenFont = clamp(
                  designFont * currentScale * LABEL_SCALE_FACTOR,
                  LABEL_MIN_DP,
                  LABEL_MAX_DP,
                );
                // Подпись поднимаем над меткой: в исходнике она рассчитана на
                // маркер 47 px полотна, а на экране метка крупнее.
                const extraOffset = Math.max(0, markerCanvas / 2 - 8);
                return (
                  <CityLabel
                    key={`label-${city.id}`}
                    x={(city.x + (layout?.dx ?? 0)) * MAP_BASE_SIZE}
                    y={(city.y + (layout?.dy ?? -0.012)) * MAP_BASE_SIZE - extraOffset}
                    fontSize={screenFont / currentScale}
                    text={city.name}
                  />
                );
              })}
            </Animated.View>
          </Animated.View>
          {!imageReady ? <View style={styles.imagePlaceholder} /> : null}
        </View>
      </GestureDetector>

      <MapControls
        onZoomIn={() => zoomBy(1.4)}
        onZoomOut={() => zoomBy(1 / 1.4)}
        onFit={() => onViewChange(fitView())}
        bottom={bottomInset + 16}
        right={rightInset + 16}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
  translateLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MAP_BASE_SIZE,
    height: MAP_BASE_SIZE,
  },
  canvas: {
    width: MAP_BASE_SIZE,
    height: MAP_BASE_SIZE,
    transformOrigin: '0 0',
  },
  image: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MAP_BASE_SIZE,
    height: MAP_BASE_SIZE,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23,20,15,0.6)',
  },
});

export default MapCanvas;
