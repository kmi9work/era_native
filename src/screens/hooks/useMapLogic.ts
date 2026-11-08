/**
 * Логика экрана «Карта»: сводит поселения, земли, армии и игроков в объекты на
 * карте, держит выбор и выполняет действия мастера.
 *
 * Данные — через единый слой src/data (TTL, опрос в фокусе, инвалидация), а не
 * через прямые запросы в экране: экран только рисует.
 *
 * Армии (решение заказчика): щит на карте без подписи, армия в городе — щит под
 * меткой города. Нажатие на щит открывает панель (состав, набор отрядов,
 * перемещение); двойное нажатие по карте предлагает создать армию в этом месте.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import { useArmies } from '../../data/hooks/useArmies';
import { useAllCountries } from '../../data/hooks/useCountries';
import { usePlayers } from '../../data/hooks/usePlayers';
import { useResources } from '../../data/hooks/useResources';
import { useRegions, useSettlements } from '../../data/hooks/useSettlements';
import { useTroopTypes } from '../../data/hooks/useTroopTypes';
import { useRefetchOnFocus } from '../../data/useRefetchOnFocus';
import { getErrorMessage } from '../../data/apiErrors';
import ApiService from '../../services/api';
import { buildMapArmies, type MapArmy, type MapTap } from '../map/armyLayout';
import { armySteps, stepsAfterSpend } from '../map/armySteps';
import { planConvergePositions } from '../map/battleConverge';
import type { ArmyOwner } from '../map/CreateArmySheet';
import { fortressLevelOf, isCapitalSettlement } from '../map/mapStyle';
import {
  armySideInPlan,
  assignArmyToBattle,
  battleKey,
  defendTargetArmy,
  prunePlan,
  removeArmyFromPlan,
  type AttackSide,
  type BattleTarget,
  type PlannedBattle,
} from '../map/battlePlan';
import {
  clearBattlePlan,
  getBattlePlan,
  setBattlePlan,
  useBattlePlan,
} from '../map/battlePlanStore';
import type { MapCity } from '../map/types';

/** Тип постройки «Кремль» (BuildingType::DEFENCE) — крепость города. */
const DEFENCE_BUILDING_TYPE = 2;

/** Точка на карте, куда «встаёт» создаваемая армия. */
export interface CreateTarget {
  point: { x: number; y: number };
  city: MapCity | null;
  defaultName: string;
  suggestedOwner: ArmyOwner | null;
}

export type MapMode = 'idle' | 'move';

export const useMapLogic = () => {
  const settlementsQuery = useSettlements();
  const regionsQuery = useRegions();
  const playersQuery = usePlayers();
  const armiesQuery = useArmies();
  const troopTypesQuery = useTroopTypes();
  const resourcesQuery = useResources();
  const countriesQuery = useAllCountries();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedArmyId, setSelectedArmyId] = useState<number | null>(null);
  const [mode, setMode] = useState<MapMode>('idle');
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ x: number; y: number; key: string } | null>(null);
  /**
   * Точка, куда мастер уже ткнул в режиме «Передвинуть». Армия при этом ещё не
   * двигается: сначала вносится расход шагов (кнопки 1..максимум) — см.
   * `MoveStepsSheet`. Старое поведение «тап = сразу перемещение» не давало
   * записать, сколько шагов ушло.
   */
  const [pendingMove, setPendingMove] = useState<{
    city: MapCity | null;
    point: { x: number; y: number };
  } | null>(null);

  // ─── Сражения на карте ───────────────────────────────────────────────────
  /** План сражений — общий с экраном «Сражения» (см. battlePlanStore). */
  const plan = useBattlePlan();
  /** Армию перенесли на цель: спрашиваем сторону, прежде чем добавить в план. */
  const [pendingAttack, setPendingAttack] = useState<{
    armyId: number;
    armyName: string;
    target: BattleTarget;
  } | null>(null);
  /** Перенос идёт: армия «в руке» — панели и легенда на время убираются. */
  const [dragging, setDragging] = useState(false);

  useRefetchOnFocus([
    queryKeys.settlements(),
    queryKeys.regions(),
    queryKeys.players(),
    queryKeys.armies(),
    queryKeys.troopTypes(),
    queryKeys.allCountries(),
  ]);

  const cities = useMemo<MapCity[]>(() => {
    const settlements = settlementsQuery.data ?? [];
    const regions = regionsQuery.data ?? [];
    const byId = new Map<number, (typeof regions)[number]>();
    regions.forEach(region => byId.set(region.id, region));

    return settlements
      .filter(
        settlement =>
          typeof settlement.map_x === 'number' && typeof settlement.map_y === 'number',
      )
      .map(settlement => {
        const region = settlement.region_id ? byId.get(settlement.region_id) : undefined;
        return {
          id: settlement.id,
          name: settlement.name,
          x: settlement.map_x as number,
          y: settlement.map_y as number,
          fortress: fortressLevelOf(settlement),
          capital: isCapitalSettlement(settlement),
          settlement,
          region,
          country: region?.country ?? null,
        };
      });
  }, [settlementsQuery.data, regionsQuery.data]);

  const armies = useMemo<MapArmy[]>(
    () => buildMapArmies(armiesQuery.data ?? [], cities),
    [armiesQuery.data, cities],
  );

  const selected = useMemo(
    () => cities.find(city => city.id === selectedId) ?? null,
    [cities, selectedId],
  );

  const selectedArmy = useMemo(
    () => armies.find(item => item.army.id === selectedArmyId) ?? null,
    [armies, selectedArmyId],
  );

  const players = useMemo(() => playersQuery.data ?? [], [playersQuery.data]);
  const countries = useMemo(() => countriesQuery.data ?? [], [countriesQuery.data]);

  // Армию могли удалить на бэкенде — панель не должна висеть на несуществующей.
  useEffect(() => {
    if (selectedArmyId == null || selectedArmy) return;
    if (armiesQuery.isFetching || armiesQuery.isLoading) return;
    setSelectedArmyId(null);
  }, [armiesQuery.isFetching, armiesQuery.isLoading, selectedArmy, selectedArmyId]);

  const runAction = useCallback(async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      queryClient.invalidate([queryKeys.settlements()]);
    } catch (error) {
      setActionError(getErrorMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setActionError(null);
    setSelectedId(null);
    setSelectedArmyId(null);
    setRecruitOpen(false);
    setMode('idle');
  }, []);

  const select = useCallback((city: MapCity) => {
    setActionError(null);
    setSelectedArmyId(null);
    setRecruitOpen(false);
    setMode('idle');
    setSelectedId(city.id);
    setFocus({ x: city.x, y: city.y, key: `city-${city.id}` });
  }, []);

  const selectArmy = useCallback((item: MapArmy) => {
    setActionError(null);
    setSelectedId(null);
    setRecruitOpen(false);
    setMode('idle');
    setSelectedArmyId(item.army.id);
    setFocus({ x: item.x, y: item.y, key: `army-${item.army.id}` });
  }, []);

  /**
   * Перемещение выбранной армии. `spend` — сколько шагов списать (выбор мастера),
   * `null` — шагов нет вовсе (старый бэкенд без `steps_max`): тогда армия просто
   * едет, как в прежнем поведении, а не залипает на листе, которого нет.
   */
  const performMove = useCallback(
    async (
      destination: { city: MapCity | null; point: { x: number; y: number } },
      spend: number | null,
    ) => {
      if (!selectedArmy) return;
      const army = selectedArmy.army;
      const armyId = army.id;
      const steps = armySteps(army);
      setBusy(true);
      setActionError(null);
      try {
        await ApiService.moveArmy(armyId, {
          settlement_id: destination.city?.id ?? null,
          map_x: destination.city ? null : destination.point.x,
          map_y: destination.city ? null : destination.point.y,
          // Перемещение и шаги — один запрос: армия не может «уехать» без списания.
          steps_spent: steps && spend !== null ? stepsAfterSpend(steps, spend) : undefined,
        });
        queryClient.invalidate([queryKeys.armies()]);
        setPendingMove(null);
        setMode('idle');
        setFocus({
          x: destination.city?.x ?? destination.point.x,
          y: destination.city?.y ?? destination.point.y,
          key: `move-${armyId}-${Date.now()}`,
        });
      } catch (error) {
        setActionError(getErrorMessage(error, 'Не удалось передвинуть армию'));
      } finally {
        setBusy(false);
      }
    },
    [selectedArmy],
  );

  /** Мастер выбрал расход шагов в листе — армия едет. */
  const confirmMove = useCallback(
    async (spend: number) => {
      if (!pendingMove) return;
      await performMove(pendingMove, spend);
    },
    [pendingMove, performMove],
  );

  /** Отмена листа шагов: армия остаётся на месте. */
  const cancelPendingMove = useCallback(() => {
    setPendingMove(null);
    setActionError(null);
  }, []);

  /** Шаги выбранной армии (максимум и остаток считает сервер). */
  const selectedArmySteps = useMemo(() => armySteps(selectedArmy?.army), [selectedArmy]);

  /** Одиночное нажатие по карте: режим перемещения, выбор армии или города. */
  const tap = useCallback(
    (event: MapTap) => {
      if (mode === 'move' && selectedArmy) {
        const destination = { city: event.city, point: { x: event.x, y: event.y } };
        setMode('idle');
        if (!armySteps(selectedArmy.army)) {
          // Шагов сервер не отдал — едем сразу, как раньше.
          void performMove(destination, null);
          return;
        }
        // Место выбрано — спрашиваем расход шагов, армия пока стоит на месте.
        setPendingMove(destination);
        return;
      }
      if (event.army) {
        selectArmy(event.army);
        return;
      }
      if (event.city) {
        select(event.city);
        return;
      }
      clearSelection();
    },
    [clearSelection, mode, performMove, select, selectArmy, selectedArmy],
  );

  /** Ближайший город к точке — для владельца новой армии по умолчанию. */
  const nearestCity = useCallback(
    (point: { x: number; y: number }): MapCity | null => {
      let best: MapCity | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      cities.forEach(city => {
        const distance = (city.x - point.x) ** 2 + (city.y - point.y) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = city;
        }
      });
      return best;
    },
    [cities],
  );

  /** Двойное нажатие по карте — создание армии в предложенном месте. */
  const doubleTap = useCallback(
    (event: MapTap) => {
      if (mode === 'move') return;
      if (event.army) {
        selectArmy(event.army);
        return;
      }
      // Владелец по умолчанию — владелец ближайшего города (обычно армию
      // создают «у себя»), иначе первое государство списка.
      const ownerCity = event.city ?? nearestCity({ x: event.x, y: event.y });
      const cityPlayer = ownerCity?.settlement.player;
      const suggestedOwner: ArmyOwner | null = cityPlayer?.id != null
        ? { type: 'Player', id: cityPlayer.id }
        : ownerCity?.country?.id != null
          ? { type: 'Country', id: ownerCity.country.id }
          : countries[0]
            ? { type: 'Country', id: countries[0].id }
            : null;

      setActionError(null);
      setSelectedId(null);
      setSelectedArmyId(null);
      setCreateTarget({
        point: { x: event.x, y: event.y },
        city: event.city,
        defaultName: `Армия ${(armiesQuery.data?.length ?? 0) + 1}`,
        suggestedOwner,
      });
    },
    [armiesQuery.data?.length, countries, mode, nearestCity, selectArmy],
  );

  const closeCreate = useCallback(() => {
    setCreateTarget(null);
    setActionError(null);
  }, []);

  const createArmy = useCallback(
    async ({ name, owner }: { name: string; owner: ArmyOwner }) => {
      if (!createTarget) return;
      setBusy(true);
      setActionError(null);
      try {
        const army = await ApiService.createArmy({
          name,
          owner_type: owner.type,
          owner_id: owner.id,
          settlement_id: createTarget.city?.id ?? null,
          map_x: createTarget.city ? null : createTarget.point.x,
          map_y: createTarget.city ? null : createTarget.point.y,
        });
        queryClient.invalidate([queryKeys.armies()]);
        setCreateTarget(null);
        setSelectedArmyId(army.id);
        setFocus({
          x: createTarget.city?.x ?? createTarget.point.x,
          y: createTarget.city?.y ?? createTarget.point.y,
          key: `create-${army.id}`,
        });
      } catch (error) {
        setActionError(getErrorMessage(error, 'Не удалось создать армию'));
      } finally {
        setBusy(false);
      }
    },
    [createTarget],
  );

  const openRecruit = useCallback(() => {
    setActionError(null);
    setRecruitOpen(true);
  }, []);

  const closeRecruit = useCallback(() => {
    if (busy) return;
    setRecruitOpen(false);
    setActionError(null);
  }, [busy]);

  /** Второй шаг набора: отряды записываются на бэкенд по одному (как в вебе). */
  const purchaseTroops = useCallback(
    async (troopTypeIds: number[]) => {
      if (!selectedArmy || troopTypeIds.length === 0) return;
      const armyId = selectedArmy.army.id;
      setBusy(true);
      setActionError(null);
      let added = 0;
      try {
        for (const troopTypeId of troopTypeIds) {
          await ApiService.addTroop(armyId, troopTypeId);
          added += 1;
        }
        queryClient.invalidate([queryKeys.armies()]);
        setRecruitOpen(false);
      } catch (error) {
        queryClient.invalidate([queryKeys.armies()]);
        const reason = getErrorMessage(error, 'Не удалось набрать отряды');
        setActionError(
          added > 0 ? `${reason}. Добавлено отрядов: ${added} из ${troopTypeIds.length}` : reason,
        );
      } finally {
        setBusy(false);
      }
    },
    [selectedArmy],
  );

  const startMove = useCallback(() => {
    setActionError(null);
    setPendingMove(null);
    setMode('move');
    setRecruitOpen(false);
    setSelectedId(null);
  }, []);

  const cancelMove = useCallback(() => {
    setMode('idle');
    setActionError(null);
  }, []);

  const setOwner = useCallback(
    async (playerId: number | null) => {
      if (!selected) return;
      await runAction(
        () => ApiService.setSettlementOwner(selected.id, playerId).then(() => undefined),
        'Не удалось сменить владельца города',
      );
    },
    [runAction, selected],
  );

  const buildFortress = useCallback(async () => {
    if (!selected) return;
    await runAction(
      () =>
        ApiService.buildSettlementBuilding(selected.id, DEFENCE_BUILDING_TYPE).then(
          () => undefined,
        ),
      'Не удалось построить крепость',
    );
  }, [runAction, selected]);

  const upgradeFortress = useCallback(async () => {
    if (!selected) return;
    const building = (selected.settlement.buildings ?? []).find(
      item => (item.building_level?.building_type?.id ?? 0) === DEFENCE_BUILDING_TYPE,
    );
    if (!building) {
      await buildFortress();
      return;
    }
    await runAction(
      () => ApiService.upgradeBuilding(building.id).then(() => undefined),
      'Не удалось улучшить крепость',
    );
  }, [buildFortress, runAction, selected]);

  // ─── Сражения: набор и правка плана ──────────────────────────────────────

  /** Сражение точки, на которую сейчас перенесли армию (для вопроса о стороне). */
  const pendingBattle = useMemo<PlannedBattle | null>(() => {
    if (!pendingAttack) return null;
    const key = battleKey(pendingAttack.target);
    return plan.find(battle => battle.key === key) ?? null;
  }, [pendingAttack, plan]);

  /** Где армия числится сейчас: новое назначение перенесёт её из этого сражения. */
  const pendingAssignedTo = useMemo(() => {
    if (!pendingAttack) return null;
    const current = armySideInPlan(plan, pendingAttack.armyId);
    if (!current) return null;
    return { title: current.battle.title, side: current.side };
  }, [pendingAttack, plan]);

  const openAttackSide = useCallback(
    (payload: { army: MapArmy; target: BattleTarget }) => {
      setActionError(null);
      setPendingAttack({
        armyId: payload.army.army.id,
        armyName: payload.army.army.name,
        target: payload.target,
      });
    },
    [],
  );

  const cancelAttackSide = useCallback(() => {
    setPendingAttack(null);
  }, []);

  /** Сторону выбрали: армия встаёт в сражение, атакованная армия — в защиту. */
  const confirmAttackSide = useCallback(
    (side: AttackSide) => {
      if (!pendingAttack) return;
      const base = assignArmyToBattle(
        getBattlePlan(),
        pendingAttack.armyId,
        side,
        pendingAttack.target,
      );
      setBattlePlan(defendTargetArmy(base, pendingAttack.target));
      setPendingAttack(null);
    },
    [pendingAttack],
  );

  const removeBattle = useCallback((key: string) => {
    setBattlePlan(getBattlePlan().filter(battle => battle.key !== key));
  }, []);

  const clearPlan = useCallback(() => {
    clearBattlePlan();
  }, []);

  /**
   * Перед экраном «Сражения»: армии сходятся к месту боя (нападающие слева,
   * защищающиеся справа, без наложений) и получают «шаги потрачены полностью» —
   * участие в сражении забирает остаток года. Координаты и шаги сохраняются на
   * бэкенде: после перезапуска приложения карта показывает то же самое.
   *
   * Сбой отдельной армии не отменяет сражение (бой считается на клиенте) — мастер
   * видит, какие армии переставить не удалось.
   */
  const prepareBattles = useCallback(async () => {
    if (plan.length === 0) return;

    const anchors: Record<string, { x: number; y: number }> = {};
    plan.forEach(battle => {
      if (battle.cityId !== null) {
        const city = cities.find(item => item.id === battle.cityId);
        if (city) anchors[battle.key] = { x: city.x, y: city.y };
      } else if (battle.armyId !== null) {
        const target = armies.find(item => item.army.id === battle.armyId);
        if (target) anchors[battle.key] = { x: target.x, y: target.y };
      }
    });

    const positions = planConvergePositions(plan, anchors);
    if (positions.length === 0) return;

    const byId = new Map(armies.map(item => [item.army.id, item.army]));
    const failed: string[] = [];
    setBusy(true);
    setActionError(null);
    try {
      for (const position of positions) {
        const army = byId.get(position.armyId);
        if (!army) continue;
        const steps = armySteps(army);
        try {
          await ApiService.moveArmy(army.id, {
            settlement_id: null,
            map_x: position.x,
            map_y: position.y,
            // Сражавшаяся армия «выходит» из года: шагов больше нет.
            steps_spent: steps ? steps.max : undefined,
          });
        } catch (error) {
          failed.push(army.name);
        }
      }
      queryClient.invalidate([queryKeys.armies()]);
      if (failed.length > 0) {
        setActionError(
          `Не удалось переставить армии: ${failed.join(', ')} — они остались на прежнем месте.`,
        );
      }
    } finally {
      setBusy(false);
    }
  }, [armies, cities, plan]);

  /** Убрать армию из плана (армию могли удалить или мастер передумал). */
  const unassignArmy = useCallback((armyId: number) => {
    setBattlePlan(removeArmyFromPlan(getBattlePlan(), armyId));
  }, []);

  /**
   * Армию удалили на бэкенде — из плана она должна исчезнуть, иначе «Начать
   * сражения» уведёт на экран с несуществующей армией. Пустой список армий
   * (первая загрузка/сбой) план не трогает.
   */
  useEffect(() => {
    const data = armiesQuery.data;
    if (!data || data.length === 0) return;
    const current = getBattlePlan();
    if (current.length === 0) return;
    const next = prunePlan(
      current,
      data.map(army => army.id),
    );
    if (next !== current) setBattlePlan(next);
  }, [armiesQuery.data]);

  return {
    cities,
    armies,
    regions: regionsQuery.data ?? [],
    players,
    countries,
    troopTypes: troopTypesQuery.data ?? [],
    resources: resourcesQuery.data ?? [],
    selectedId,
    selected,
    selectedArmyId,
    selectedArmy,
    mode,
    focus,
    createTarget,
    recruitOpen,
    busy,
    actionError,
    /** Выбранное место перемещения: армия ещё стоит, спрашиваем расход шагов. */
    pendingMove,
    /** Шаги выбранной армии (максимум/потрачено/осталось) — считает сервер. */
    selectedArmySteps,
    confirmMove,
    cancelPendingMove,
    select,
    selectArmy,
    clearSelection,
    tap,
    doubleTap,
    closeCreate,
    createArmy,
    openRecruit,
    closeRecruit,
    purchaseTroops,
    startMove,
    cancelMove,
    setOwner,
    buildFortress,
    upgradeFortress,
    // сражения на карте
    plan,
    dragging,
    setDragging,
    pendingAttack,
    pendingBattle,
    pendingAssignedTo,
    openAttackSide,
    confirmAttackSide,
    cancelAttackSide,
    removeBattle,
    clearPlan,
    unassignArmy,
    prepareBattles,
    isLoading: settlementsQuery.isLoading || regionsQuery.isLoading || armiesQuery.isLoading,
    isOffline: settlementsQuery.isOffline || regionsQuery.isOffline || armiesQuery.isOffline,
    updatedAt: settlementsQuery.updatedAt,
  };
};
