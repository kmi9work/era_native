/**
 * Полотно карты: картинка с бэкенда, метки и подписи городов, щиты армий, жесты.
 *
 * Время и движение: пинч/пан двигают shared values Reanimated (без ре-рендера
 * React), на отпускании масштаб и смещение коммитятся в состояние экрана — тогда
 * же пересчитываются размеры меток, щитов и подписей (они не должны расти
 * бесконечно).
 *
 * Нажатия: одиночное ищет сначала щит армии (приоритет у армии), потом город;
 * второе нажатие в пределах 400 мс в той же точке считается двойным — экран
 * предлагает создать армию в этой точке (см. `dispatchTap`).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import ArmyShield from './ArmyShield';
import CityLabel from './CityLabel';
import CityMarker from './CityMarker';
import LandPoLabel from './LandPoLabel';
import MapControls from './MapControls';
import { isDoubleTap, type TapPoint } from './tapDetect';
import { labelLayoutFor } from './cityLayout';
import { landLabelFor } from './landLayout';
import type { MapArmy, MapTap } from './armyLayout';
import { armyTarget, battleKey, cityTarget, type AttackSide, type BattleTarget } from './battlePlan';
import type { Region } from '../../types';
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
  PAN_SLACK_X,
  PAN_SLACK_Y,
  panRange,
} from './mapStyle';
import type { MapCity, MapViewState } from './types';

interface Props {
  cities: MapCity[];
  armies: MapArmy[];
  /** Земли: рядом с их названиями на полотне рисуется общественный порядок. */
  regions: Region[];
  /** Галочка в шапке: показывать общественный порядок земель. */
  showLandPo: boolean;
  selectedId: number | null;
  selectedArmyId: number | null;
  view: MapViewState | null;
  onViewChange: (view: MapViewState) => void;
  onTap: (tap: MapTap) => void;
  onDoubleTap: (tap: MapTap) => void;
  /** Точка, на которую надо навести карту (выбор города/армии, перемещение). */
  focus: { x: number; y: number; key: string } | null;
  imageUrl: string;
  /** Сколько места снизу занято панелью (портрет) — кнопки поднимаются выше. */
  bottomInset: number;
  /** Сдвиг центра при открытой панели справа (ландшафт). */
  rightInset: number;
  /** Армии, уже набранные в сражения: id → сторона (рамка щита). */
  planSides: Record<number, AttackSide>;
  /** Точки набранных сражений: города и армии подсвечиваются на карте. */
  planTargets: { cities: number[]; armies: number[] };
  /** Армию «подняли» долгим нажатием и ведут по карте. */
  onDragChange?: (active: boolean) => void;
  /** Отпустили на цели: армию надо спросить о стороне сражения. */
  onAttackDrop: (payload: { army: MapArmy; target: BattleTarget }) => void;
  /** Отпустили вне цели — перенос отменён. */
  onAttackCancel?: () => void;
}

/** Максимальный зум относительно «вписана» — дальше исходник 2881 px мылит. */
const MAX_ZOOM = 4;

/** Радиус попадания по метке, dp. */
const HIT_RADIUS = 26;

/** Сколько держать палец на щите, чтобы «поднять» армию, мс (решение заказчика). */
const ATTACK_HOLD_MS = 2000;
/** Допустимое дрожание пальца за время удержания, dp: палец не обязан быть неподвижным. */
const ATTACK_HOLD_MAX_DP = 28;
/** Запас попадания при переносе: палец закрывает цель, поэтому он больше тапа. */
const ATTACK_DROP_PAD = 18;
/**
 * Насколько щит «поднят» над пальцем, dp: палец не должен закрывать цель.
 * Размер поднятого щита — ровно как на карте (см. `shieldDp`), не больше.
 */
const GHOST_LIFT_DP = 16;
/** Как часто пересчитывать цель под пальцем при переносе, мс. */
const HOVER_THROTTLE_MS = 40;

/** Щит армии: крупнее метки города — армии должны читаться сразу. */
const SHIELD_MIN_DP = 26;
const SHIELD_MAX_DP = 46;
/** Пропорция иконки щита (195 × 240 px в assets/map/shields). */
const SHIELD_ASPECT = 195 / 240;
/** Запас попадания по щиту, dp. */
const SHIELD_HIT_PAD = 6;

/** Кегль исходной карты переводим в единицы полотна. */
const DESIGN_FONT_SCALE = MAP_BASE_SIZE / 2881;

// `clamp` вызывается и с UI-потока (пан), поэтому это worklet, а не просто функция.
const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(max, Math.max(min, value));
};

const MapCanvas = ({
  cities,
  armies,
  regions,
  showLandPo,
  selectedId,
  selectedArmyId,
  view,
  onViewChange,
  onTap,
  onDoubleTap,
  focus,
  imageUrl,
  bottomInset,
  rightInset,
  planSides,
  planTargets,
  onDragChange,
  onAttackDrop,
  onAttackCancel,
}: Props) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageReady, setImageReady] = useState(false);
  /** Армия, которую «подняли» долгим нажатием: щит за пальцем и подсветка цели. */
  const [dragSource, setDragSource] = useState<MapArmy | null>(null);
  /** Цель под пальцем во время переноса: `city:12` / `army:34`. */
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const dragArmyRef = useRef<MapArmy | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const lastHoverAtRef = useRef(0);

  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  /** Видимость «поднятого» щита: только прозрачность, размер не анимируется. */
  const ghostVisible = useSharedValue(0);
  /**
   * Перенос армии активен. Флаг живёт в shared value, а не в состоянии: его
   * читает `onUpdate` пана на UI-потоке, чтобы решить, двигать карту или щит.
   */
  const dragActive = useSharedValue(0);
  /** Точка касания: по ней видно, тащили карту или держали армию на месте. */
  const pressStartX = useSharedValue(-1);
  const pressStartY = useSharedValue(-1);

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /**
   * Размер полотна на экране в shared values: границы пана считаются на
   * UI-потоке, а JS-состояние `size` в worklet не видно.
   */
  const viewWidth = useSharedValue(0);
  const viewHeight = useSharedValue(0);
  // Начало жеста — в shared values: обычный объект в worklet между вызовами
  // не сохраняется надёжно (Reanimated копирует замыкание на UI-поток).
  // Базы ПАНА и ПИНЧА разные: общая пара startTx/startTy перезаписывалась любым
  // касанием, и пинч считал масштаб от чужой точки — карта «росла» из левого
  // верхнего угла полотна (transformOrigin 0 0), где бы ни стояли пальцы.
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartTx = useSharedValue(0);
  const pinchStartTy = useSharedValue(0);
  // Точка захвата пинча (фокус двух пальцев в начале жеста): масштаб считается
  // от неё, а не от текущего фокуса, иначе при сдвиге пальцев карта уезжает.
  const pinchStartFocalX = useSharedValue(0);
  const pinchStartFocalY = useSharedValue(0);

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
      // За край экрана карта уходит на 50 % ширины и 30 % высоты (заказчик):
      // без этого вписанная карта стояла намертво по центру, а у края полотна
      // нельзя было ничего рассмотреть.
      const [minX, maxX] = panRange(width, mapWidth, width * PAN_SLACK_X);
      const [minY, maxY] = panRange(height, mapHeight, height * PAN_SLACK_Y);
      return {
        scale: next.scale,
        tx: clamp(next.tx, minX, maxX),
        ty: clamp(next.ty, minY, maxY),
      };
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
    // Границы пана считаются на UI-потоке — размер нужен и там.
    viewWidth.value = width;
    viewHeight.value = height;
    if (!view) {
      const s = Math.min(width, height) / MAP_BASE_SIZE;
      onViewChange({
        scale: s,
        tx: (width - MAP_BASE_SIZE * s) / 2,
        ty: (height - MAP_BASE_SIZE * s) / 2,
      });
    }
  };

  // Центрирование выбранного объекта (город, армия, точка перемещения)
  useEffect(() => {
    if (!view || !focus || !size.width) return;
    const visibleWidth = size.width - rightInset;
    const visibleHeight = size.height - bottomInset;
    const next = clampView({
      scale: view.scale,
      tx: visibleWidth / 2 - focus.x * MAP_BASE_SIZE * view.scale,
      ty: visibleHeight / 2 - focus.y * MAP_BASE_SIZE * view.scale,
    });
    onViewChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  // --- размеры и положение щитов (в единицах полотна) ---
  const currentScale = view?.scale ?? limits.fit;
  const fitScale = limits.fit || 1;
  const zoomRatio = clamp(currentScale / fitScale, 1, MAX_ZOOM);
  const markerDp =
    MARKER_MIN_DP + ((MARKER_MAX_DP - MARKER_MIN_DP) * (zoomRatio - 1)) / (MAX_ZOOM - 1);
  const markerCanvas = markerDp / currentScale;

  const shieldDp =
    SHIELD_MIN_DP + ((SHIELD_MAX_DP - SHIELD_MIN_DP) * (zoomRatio - 1)) / (MAX_ZOOM - 1);
  const shieldHeight = shieldDp / currentScale;
  const shieldWidth = shieldHeight * SHIELD_ASPECT;

  /** Центр щита в единицах полотна: под городом (стопкой) или в своей точке. */
  const shieldCenter = useCallback(
    (item: MapArmy) => {
      if (item.inCity) {
        const spacing = shieldWidth * 1.02;
        const offsetX = (item.slot - (item.slotCount - 1) / 2) * spacing;
        return {
          x: item.x * MAP_BASE_SIZE + offsetX,
          y:
            item.y * MAP_BASE_SIZE +
            markerCanvas / 2 +
            shieldHeight / 2 +
            2 / currentScale,
        };
      }
      return { x: item.x * MAP_BASE_SIZE, y: item.y * MAP_BASE_SIZE };
    },
    [currentScale, markerCanvas, shieldHeight, shieldWidth],
  );

  const pickTap = useCallback(
    (screenX: number, screenY: number, s: number, tX: number, tY: number): MapTap => {
      const point = {
        x: (screenX - tX) / (MAP_BASE_SIZE * s),
        y: (screenY - tY) / (MAP_BASE_SIZE * s),
      };

      // Щит армии: попадание по прямоугольнику иконки, ближайший к пальцу.
      let armyHit: MapArmy | null = null;
      let armyDistance = Number.POSITIVE_INFINITY;
      for (const item of armies) {
        const center = shieldCenter(item);
        const cx = tX + center.x * s;
        const cy = tY + center.y * s;
        const halfW = (shieldWidth * s) / 2 + SHIELD_HIT_PAD;
        const halfH = (shieldHeight * s) / 2 + SHIELD_HIT_PAD;
        if (Math.abs(screenX - cx) > halfW || Math.abs(screenY - cy) > halfH) continue;
        const distance = Math.hypot(cx - screenX, cy - screenY);
        if (distance < armyDistance) {
          armyDistance = distance;
          armyHit = item;
        }
      }

      // Город — по радиусу, как раньше.
      let cityHit: MapCity | null = null;
      let cityDistance = HIT_RADIUS;
      for (const city of cities) {
        const cx = tX + city.x * MAP_BASE_SIZE * s;
        const cy = tY + city.y * MAP_BASE_SIZE * s;
        const distance = Math.hypot(cx - screenX, cy - screenY);
        if (distance <= cityDistance) {
          cityDistance = distance;
          cityHit = city;
        }
      }

      return { ...point, army: armyHit, city: cityHit };
    },
    [armies, cities, shieldCenter, shieldHeight, shieldWidth],
  );

  const tapHandlerRef = useRef(onTap);
  tapHandlerRef.current = onTap;
  const doubleTapHandlerRef = useRef(onDoubleTap);
  doubleTapHandlerRef.current = onDoubleTap;
  const pickTapRef = useRef(pickTap);
  pickTapRef.current = pickTap;

  // ─── Перенос армии (атака) ────────────────────────────────────────────────
  //
  // Цель переноса ищется с запасом больше тапа: палец сам закрывает точку.
  // Армия, стоящая в городе, целью не считается — сражение всё равно за город
  // (в нём стоит гарнизон), и мастер бьёт по метке, а не по чужому щиту.
  const pickTarget = useCallback(
    (screenX: number, screenY: number, s: number, tX: number, tY: number, excludeArmyId: number) => {
      let armyHit: MapArmy | null = null;
      let armyDistance = Number.POSITIVE_INFINITY;
      for (const item of armies) {
        if (item.army.id === excludeArmyId) continue;
        const center = shieldCenter(item);
        const cx = tX + center.x * s;
        const cy = tY + center.y * s;
        const halfW = (shieldWidth * s) / 2 + ATTACK_DROP_PAD;
        const halfH = (shieldHeight * s) / 2 + ATTACK_DROP_PAD;
        if (Math.abs(screenX - cx) > halfW || Math.abs(screenY - cy) > halfH) continue;
        const distance = Math.hypot(cx - screenX, cy - screenY);
        if (distance < armyDistance) {
          armyDistance = distance;
          armyHit = item;
        }
      }

      if (armyHit && !armyHit.inCity) return armyTarget(armyHit.army);

      let cityHit: MapCity | null = armyHit?.city ?? null;
      if (!cityHit) {
        let cityDistance = HIT_RADIUS + ATTACK_DROP_PAD;
        for (const city of cities) {
          const cx = tX + city.x * MAP_BASE_SIZE * s;
          const cy = tY + city.y * MAP_BASE_SIZE * s;
          const distance = Math.hypot(cx - screenX, cy - screenY);
          if (distance <= cityDistance) {
            cityDistance = distance;
            cityHit = city;
          }
        }
      }

      if (cityHit) return cityTarget(cityHit);
      if (armyHit) return armyTarget(armyHit.army);
      return null;
    },
    [armies, cities, shieldCenter, shieldHeight, shieldWidth],
  );

  /** Прибрать перенос: общий код для дропа, отмены и оборванного жеста. */
  const resetDrag = useCallback(() => {
    dragArmyRef.current = null;
    hoverKeyRef.current = null;
    lastHoverAtRef.current = 0;
    dragActive.value = 0;
    setDragSource(null);
    setHoverKey(null);
    onDragChange?.(false);
  }, [dragActive, onDragChange]);

  /**
   * Поднять армию под пальцем. `pressX/pressY` — точка касания: если палец успел
   * уехать (карту тащили), это не удержание и армия не поднимается.
   */
  const beginDrag = useCallback(
    (
      screenX: number,
      screenY: number,
      pressX: number,
      pressY: number,
      s: number,
      tX: number,
      tY: number,
    ) => {
      if (
        pressX >= 0 &&
        pressY >= 0 &&
        Math.hypot(screenX - pressX, screenY - pressY) > ATTACK_HOLD_MAX_DP
      ) {
        return;
      }
      const tap = pickTapRef.current(screenX, screenY, s, tX, tY);
      const army = tap.army;
      if (!army) return;
      dragActive.value = 1;
      dragArmyRef.current = army;
      hoverKeyRef.current = null;
      lastHoverAtRef.current = 0;
      setDragSource(army);
      setHoverKey(null);
      onDragChange?.(true);
    },
    [dragActive, onDragChange],
  );

  const updateHover = useCallback(
    (screenX: number, screenY: number, s: number, tX: number, tY: number) => {
      const army = dragArmyRef.current;
      if (!army) return;
      const now = Date.now();
      if (now - lastHoverAtRef.current < HOVER_THROTTLE_MS) return;
      lastHoverAtRef.current = now;
      const target = pickTarget(screenX, screenY, s, tX, tY, army.army.id);
      const key = target ? battleKey(target) : null;
      if (hoverKeyRef.current === key) return;
      hoverKeyRef.current = key;
      setHoverKey(key);
    },
    [pickTarget],
  );

  const finishDrag = useCallback(
    (screenX: number, screenY: number, s: number, tX: number, tY: number) => {
      const army = dragArmyRef.current;
      if (!army) return;
      resetDrag();
      const target = pickTarget(screenX, screenY, s, tX, tY, army.army.id);
      if (!target) {
        onAttackCancel?.();
        return;
      }
      onAttackDrop({ army, target });
    },
    [onAttackCancel, onAttackDrop, pickTarget, resetDrag],
  );

  /** Жест оборвался без `onEnd` (второй палец, системный жест) — прибрать перенос. */
  const cancelDrag = useCallback(() => {
    if (!dragArmyRef.current) return;
    resetDrag();
    onAttackCancel?.();
  }, [onAttackCancel, resetDrag]);

  // Двойное нажатие распознаём сами: `Gesture.Exclusive` задерживал одиночный
  // тап на время ожидания второго и на планшете двойное нажатие не срабатывало.
  const lastTapRef = useRef<TapPoint>({ time: 0, x: 0, y: 0 });

  const dispatchTap = useCallback(
    (screenX: number, screenY: number, s: number, tX: number, tY: number) => {
      const previous = lastTapRef.current;
      const next = { time: Date.now(), x: screenX, y: screenY };
      const double = isDoubleTap(previous, next);
      lastTapRef.current = double ? { time: 0, x: screenX, y: screenY } : next;
      const tap = pickTapRef.current(screenX, screenY, s, tX, tY);
      if (double) doubleTapHandlerRef.current(tap);
      else tapHandlerRef.current(tap);
    },
    [],
  );

  const singleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(12)
        .maxDuration(280)
        .onEnd((event, success) => {
          if (!success) return;
          runOnJS(dispatchTap)(event.x, event.y, scale.value, tx.value, ty.value);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatchTap],
  );

  /**
   * Удержание армии: долгое нажатие на щите «поднимает» армию.
   *
   * `maxDistance` здесь ОГРОМНЫЙ, а не 28 dp: активный `LongPressGestureHandler`
   * сам вызывает `cancel()`, как только палец уходит дальше `maxDistance`
   * (`LongPressGestureHandler.kt:147-153`), — и тогда `onFinalize` снимал перенос,
   * а карта снова начинала панорамироваться (ровно тот дефект, что видел заказчик:
   * «движется карта, а не армия»). Допуск до дрожания пальца проверяем САМИ в
   * `beginDrag` по точке касания (`ATTACK_HOLD_MAX_DP`).
   */
  const attackHoldGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(ATTACK_HOLD_MS)
        .maxDistance(1e6)
        .onStart(event => {
          ghostX.value = event.x;
          ghostY.value = event.y;
          ghostVisible.value = withTiming(1, { duration: 90 });
          runOnJS(beginDrag)(
            event.x,
            event.y,
            pressStartX.value,
            pressStartY.value,
            scale.value,
            tx.value,
            ty.value,
          );
        })
        .onEnd(event => {
          // Палец отпустили, не сдвинув: пан так и не активировался — бросок цели
          // считаем здесь (повторный вызов из пана безопасен: перенос уже снят).
          runOnJS(finishDrag)(event.x, event.y, scale.value, tx.value, ty.value);
        })
        .onFinalize(() => {
          ghostVisible.value = withTiming(0, { duration: 80 });
          runOnJS(cancelDrag)();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beginDrag, cancelDrag, finishDrag],
  );

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      // Один хозяин кадра: при втором пальце RNGH сам отменяет активный пан,
      // иначе пан и пинч писали одни и те же tx/ty и последний в кадре
      // обнулял якорь пинча (зум «из левого верхнего угла»).
      .maxPointers(1)
      .onBegin(event => {
        startTx.value = tx.value;
        startTy.value = ty.value;
        pressStartX.value = event.x;
        pressStartY.value = event.y;
      })
      .onUpdate(event => {
        // Армию подняли — палец ведёт щит, а не карту.
        if (dragActive.value === 1) {
          ghostX.value = event.x;
          ghostY.value = event.y;
          runOnJS(updateHover)(event.x, event.y, scale.value, tx.value, ty.value);
          return;
        }
        tx.value = startTx.value + event.translationX;
        ty.value = startTy.value + event.translationY;
        // Границы держим ПРЯМО В ЖЕСТЕ, а не только в commit: иначе карта уезжает
        // в пустоту дальше разрешённого и на отпускании прыжком возвращается.
        if (viewWidth.value > 0 && viewHeight.value > 0) {
          const mapSize = MAP_BASE_SIZE * scale.value;
          const [minX, maxX] = panRange(
            viewWidth.value,
            mapSize,
            viewWidth.value * PAN_SLACK_X,
          );
          const [minY, maxY] = panRange(
            viewHeight.value,
            mapSize,
            viewHeight.value * PAN_SLACK_Y,
          );
          tx.value = clamp(tx.value, minX, maxX);
          ty.value = clamp(ty.value, minY, maxY);
        }
      })
      .onEnd(event => {
        if (dragActive.value === 1) {
          // Карта до подъёма могла сдвинуться на пару dp — фиксируем это положение,
          // иначе общий `view` в состоянии останется старым и карта прыгнет.
          runOnJS(commit)({ scale: scale.value, tx: tx.value, ty: ty.value });
          runOnJS(finishDrag)(event.x, event.y, scale.value, tx.value, ty.value);
          return;
        }
        runOnJS(commit)({ scale: scale.value, tx: tx.value, ty: ty.value });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, finishDrag, updateHover]);

  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      // Базу берём в onStart, а НЕ в onBegin: в onBegin фокус равен позиции
      // первого пальца, и постановка второго дёргает карту на пол-размаха.
      .onStart(event => {
        pinchStartScale.value = scale.value;
        pinchStartTx.value = tx.value;
        pinchStartTy.value = ty.value;
        pinchStartFocalX.value = event.focalX;
        pinchStartFocalY.value = event.focalY;
      })
      .onUpdate(event => {
        const next = Math.min(limits.max, Math.max(limits.min, pinchStartScale.value * event.scale));
        const k = next / pinchStartScale.value;
        scale.value = next;
        // Точка карты, бывшая под пальцами в начале жеста, остаётся под текущим
        // фокусом: tx' = f - (f0 - tx) * k. Перенос двумя пальцами при этом
        // двигает карту сам (f меняется) — это правильный побочный эффект.
        tx.value = event.focalX - (pinchStartFocalX.value - pinchStartTx.value) * k;
        ty.value = event.focalY - (pinchStartFocalY.value - pinchStartTy.value) * k;
      })
      .onEnd(() => {
        runOnJS(commit)({ scale: scale.value, tx: tx.value, ty: ty.value });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, limits.max, limits.min]);

  const gesture = useMemo(
    () =>
      Gesture.Race(
        singleTapGesture,
        Gesture.Simultaneous(attackHoldGesture, pinchGesture, panGesture),
      ),
    [attackHoldGesture, singleTapGesture, pinchGesture, panGesture],
  );

  /**
   * Размер «поднятого» щита — ровно как у щита на карте в текущем масштабе
   * (заказчик: «не нужно, чтобы она становилась больше — просто над пальцем»).
   */
  const ghostBox = useMemo(
    () => ({ width: shieldDp * SHIELD_ASPECT, height: shieldDp }),
    [shieldDp],
  );

  const ghostStyle = useAnimatedStyle(
    () => ({
      opacity: ghostVisible.value,
      transform: [
        // Центр по горизонтали на пальце, щит целиком ВЫШЕ пальца.
        { translateX: ghostX.value - ghostBox.width / 2 },
        { translateY: ghostY.value - ghostBox.height - GHOST_LIFT_DP },
      ],
    }),
    [ghostBox.height, ghostBox.width],
  );

  const translateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const visibleLabels = cities.filter(city => {
    const layout = labelLayoutFor(city.name);
    const designFont = layout?.font ?? 16.67;
    return designFont >= LABEL_ALWAYS_FONT || zoomRatio >= LABEL_ALL_ZOOM;
  });

  /**
   * Общественный порядок земель: названия земель нарисованы на подложке, поэтому
   * клиент дописывает к ним только число — в точке сразу за правым краем
   * названия (см. landLayout.ts). Земля без подписи на полотне или без ОП
   * в ответе сервера число не получает.
   */
  const landPoLabels = useMemo(() => {
    if (!showLandPo) return [];
    return regions.flatMap(region => {
      const layout = landLabelFor(region.name);
      const value = region.show_overall_po;
      if (!layout || value == null || !Number.isFinite(value)) return [];
      return [{ id: region.id, layout, value }];
    });
  }, [regions, showLandPo]);

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
              {cities.map(city => (
                <CityMarker
                  key={`marker-${city.id}`}
                  x={city.x * MAP_BASE_SIZE}
                  y={city.y * MAP_BASE_SIZE}
                  size={markerCanvas}
                  color={markerColor(city.fortress)}
                  capital={city.capital}
                  selected={city.id === selectedId}
                  highlighted={hoverKey === `city:${city.id}`}
                  planned={planTargets.cities.includes(city.id)}
                />
              ))}
              {armies.map(item => {
                const center = shieldCenter(item);
                return (
                  <ArmyShield
                    key={`army-${item.army.id}`}
                    x={center.x}
                    y={center.y}
                    width={shieldWidth}
                    height={shieldHeight}
                    source={item.shield.source}
                    selected={item.army.id === selectedArmyId}
                    side={planSides[item.army.id] ?? null}
                    highlighted={hoverKey === `army:${item.army.id}`}
                    planned={planTargets.armies.includes(item.army.id)}
                    lifted={dragSource?.army.id === item.army.id}
                  />
                );
              })}
              {visibleLabels.map(city => {
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
              {landPoLabels.map(item => {
                const designFont = item.layout.font * DESIGN_FONT_SCALE;
                const screenFont = clamp(
                  designFont * currentScale * LABEL_SCALE_FACTOR,
                  LABEL_MIN_DP,
                  LABEL_MAX_DP,
                );
                return (
                  <LandPoLabel
                    key={`land-po-${item.id}`}
                    x={item.layout.x * MAP_BASE_SIZE}
                    y={item.layout.y * MAP_BASE_SIZE}
                    fontSize={screenFont / currentScale}
                    value={item.value}
                  />
                );
              })}
            </Animated.View>
          </Animated.View>
          {!imageReady ? <View style={styles.imagePlaceholder} /> : null}
          {dragSource ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.ghost, ghostBox, ghostStyle]}
            >
              <Image
                source={dragSource.shield.source}
                style={ghostBox}
                resizeMode="contain"
              />
            </Animated.View>
          ) : null}
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
  /** «Поднятый» щит за пальцем: рисуется вне масштабируемого слоя, размер — как на карте. */
  ghost: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 14,
  },
});

export default MapCanvas;
