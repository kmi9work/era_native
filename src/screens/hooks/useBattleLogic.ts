/**
 * Логика экрана «Сражения»: состояние мастера и вся последовательность боя.
 *
 * Сценарий (ТЗ):
 *  1. место — в поле или за город (страна → город);
 *  2. набор армий: атакующие сверху, защищающиеся снизу, плюс дополнительные
 *     отряды в любую армию (только в составе этого боя — бэкенд не трогаем);
 *  3. баффы/дебаффы: город добавляет пехоту защищающимся, крепость даёт бонус
 *     к кубикам и требует пушку, мастер может дать бонус/дебафф армии;
 *  4. бой: к6 у каждого отряда (кроме пушки), попадания по порогам типа,
 *     авто-выбор самых слабых потерь с ручной правкой, анимация удара,
 *     отступление на 4–6 и новый раунд.
 *
 * На бэкенд уходят действия, и все — только после подтверждения мастером:
 * уничтожение разбитых армий (DELETE /armies/:id), уничтожение погибших в бою
 * отрядов (DELETE /troops/:id), передача региона победителю
 * (PATCH /regions/:id/captured_by), когда взята столица государства, и влияние
 * Воеводе за победу (PATCH /armies/award_battle_victory). Захвата отдельного
 * города в API нет: город принадлежит региону.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ApiService from '../../services/api';
import { getErrorMessage } from '../../data/apiErrors';
import { queryClient } from '../../data/queryClient';
import { queryKeys } from '../../data/keys';
import { useAllCountries } from '../../data/hooks/useCountries';
import { usePlayers } from '../../data/hooks/usePlayers';
import { useArmies } from '../../data/hooks/useArmies';
import { useRegions, useSettlements } from '../../data/hooks/useSettlements';
import { buildRoundScene, type SceneTroop } from '../battles/scene/events';
import { useScenePlayer } from '../battles/scene/useScenePlayer';
import {
  armyCountryId,
  armyModifier,
  autoCasualties,
  battleTroopsFromArmy,
  canRetreat,
  effectiveRoll,
  fortressDiceBonus,
  fortressLevelFromSettlement,
  fortressRequiresCannon,
  isCapitalSettlement,
  isHit,
  participates,
  rollDie,
  TROOP_KINDS,
  TROOP_LABEL,
  type TroopKind,
} from '../../services/battleRules';
import type { Army, Settlement } from '../../types';

export type BattleSide = 'attacker' | 'defender';
export type BattleStep = 'place' | 'armies' | 'buffs' | 'battle';
/**
 * Фазы боя. `playing` — сцена проигрывает раунд (удары, потери, лента);
 * время шагов держит `useScenePlayer`, а не таймеры этого хука.
 */
export type BattlePhase = 'rolling' | 'casualties' | 'playing' | 'retreat' | 'finished';
export type BattleOutcome =
  | 'attackers_destroyed'
  | 'defenders_destroyed'
  | 'attackers_retreated'
  | 'defenders_retreated'
  | null;

export interface BattleTroop {
  uid: string;
  kind: TroopKind;
  name: string;
  source: 'backend' | 'added' | 'city';
  /** Порядок добавления: по нему разрешаются равные по силе потери. */
  order: number;
  /**
   * id отряда на бэкенде. Есть только у отрядов, пришедших с сервера: отряды,
   * добавленные мастером в состав боя (`added`) и пехота города (`city`),
   * на бэкенде не существуют — удалять нечего.
   */
  troopId?: number | null;
}

/** Погибший в бою отряд, который есть на бэкенде: удаляется по `troopId`. */
export interface FallenTroop {
  troopId: number;
  kind: TroopKind;
  name: string;
  armyName: string;
  armyUid: string;
  armyId: number | null;
}

export interface BattleArmy {
  uid: string;
  armyId: number | null;
  name: string;
  ownerName: string;
  /** Игрок-владелец армии (если армия игрока, а не государства): нужен для выбора владельца города. */
  ownerPlayerId: number | null;
  countryId: number | null;
  side: BattleSide;
  troops: BattleTroop[];
  bonus: number;
  debuff: number;
  retreated: boolean;
  retreatRoll: number | null;
  /** Гарнизон города: создаётся экраном, на бэкенде такой армии нет. */
  isGarrison?: boolean;
}

/** Строка списка армий на шаге 2. */
export interface AvailableArmy {
  army: Army;
  key: string;
  ownerName: string;
  countryId: number | null;
  troopsLabel: string;
  troopsCount: number;
  used: boolean;
}

const DIE_SPIN_MS = 700;
const ROLL_STAGGER_MS = 140;
const MAX_ARMY_MODIFIER = 3;

const sideLabel = (side: BattleSide) => (side === 'attacker' ? 'Атакующие' : 'Защищающиеся');

export function useBattleLogic() {
  const armiesQuery = useArmies();
  const settlementsQuery = useSettlements();
  const regionsQuery = useRegions();
  const allCountriesQuery = useAllCountries();
  const playersQuery = usePlayers();

  const [step, setStep] = useState<BattleStep>('place');
  const [placeKind, setPlaceKindState] = useState<'field' | 'city'>('field');
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [selectedSettlementId, setSelectedSettlementId] = useState<number | null>(null);

  const [battleArmies, setBattleArmies] = useState<BattleArmy[]>([]);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<BattlePhase>('rolling');
  const [rolls, setRolls] = useState<Record<string, number>>({});
  const [spinning, setSpinning] = useState<Record<string, boolean>>({});
  const [retreatSpinning, setRetreatSpinning] = useState<Record<string, boolean>>({});
  const [hits, setHits] = useState<{ attacker: number; defender: number }>({
    attacker: 0,
    defender: 0,
  });
  const [victims, setVictims] = useState<{ attacker: string[]; defender: string[] }>({
    attacker: [],
    defender: [],
  });
  const [outcome, setOutcome] = useState<BattleOutcome>(null);
  const [outcomeConfirmed, setOutcomeConfirmed] = useState(false);
  const [deletedArmyIds, setDeletedArmyIds] = useState<number[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /**
   * Отряды, погибшие в бою и существующие на бэкенде. Копятся по раундам:
   * уничтожаются одним подтверждением мастера в итоге сражения.
   */
  const [fallenTroops, setFallenTroops] = useState<FallenTroop[]>([]);
  const [deletedTroopIds, setDeletedTroopIds] = useState<number[]>([]);
  const [troopDeleteError, setTroopDeleteError] = useState<string | null>(null);
  const [troopsConfirmed, setTroopsConfirmed] = useState(false);
  const [troopDeleteBusy, setTroopDeleteBusy] = useState(false);
  /** Влияние Воеводе за победу: начисляется отдельным действием мастера. */
  const [voevodaBusy, setVoevodaBusy] = useState(false);
  const [voevodaError, setVoevodaError] = useState<string | null>(null);
  const [voevodaAwarded, setVoevodaAwarded] = useState<Array<{
    id: number;
    name: string;
    country_name?: string | null;
    value?: number;
  }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [roundMessage, setRoundMessage] = useState<string | null>(null);
  const [annexationChoice, setAnnexationChoice] = useState<number | null>(null);
  /**
   * Итог передачи региона. Хранится снимком, а не флагом: после успеха слой данных
   * перезапрашивает регионы, регион уже принадлежит победителю, и пересчитанный
   * `annexation` теряет список стран-победителей — текст итога должен пережить это.
   */
  const [annexationResult, setAnnexationResult] = useState<{
    regionName: string;
    countryId: number;
    countryName: string;
  } | null>(null);
  const [annexationBusy, setAnnexationBusy] = useState(false);
  const [annexationError, setAnnexationError] = useState<string | null>(null);
  /**
   * Владелец взятого города: снятие и назначение — отдельные действия, мастер может
   * сделать и то, и другое (сначала присоединить регион, потом назначить владельца).
   * Итог хранится снимком, потому что после PATCH поселения перезапрашиваются.
   */
  const [cityOwnerBusy, setCityOwnerBusy] = useState(false);
  const [cityOwnerError, setCityOwnerError] = useState<string | null>(null);
  const [cityOwnerResult, setCityOwnerResult] = useState<'removed' | 'assigned' | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const uidRef = useRef(0);
  const orderRef = useRef(0);
  /**
   * Итог сражения уже отправлен на бэкенд. Один бой = одно уведомление мастерам:
   * без флага эффект отправки сработал бы на каждом рендере после итога (потери,
   * уничтожение армий, передача региона — всё это меняет зависимости эффекта).
   */
  const battleReportedRef = useRef(false);
  const runRef = useRef(0);
  const rollsRef = useRef<Record<string, number>>({});
  const spinningRef = useRef<Record<string, boolean>>({});
  const rngRef = useRef<() => number>(Math.random);
  const armiesRef = useRef<BattleArmy[]>(battleArmies);
  rollsRef.current = rolls;
  spinningRef.current = spinning;
  armiesRef.current = battleArmies;

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const nextUid = useCallback((prefix: string) => {
    uidRef.current += 1;
    return `${prefix}${uidRef.current}`;
  }, []);

  const nextOrder = useCallback(() => {
    orderRef.current += 1;
    return orderRef.current;
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const timer = setTimeout(fn, delay);
    timersRef.current.push(timer);
  }, []);

  // ─── Сцена раунда ─────────────────────────────────────────────────────────

  /** Потери, подтверждённые мастером: применяются, когда сцена доиграла. */
  const pendingVictimsRef = useRef<{ attacker: string[]; defender: string[] } | null>(null);

  /**
   * Применить подтверждённые потери. Вызывается проигрывателем сцены ровно один
   * раз в конце (или сразу при «Пропустить»), поэтому фишки успевают уехать до
   * того, как отряды исчезнут из состояния.
   */
  const applyCasualties = useCallback(() => {
    const applied = pendingVictimsRef.current;
    if (!applied) return;
    pendingVictimsRef.current = null;

    const removed = new Set([...applied.attacker, ...applied.defender]);

    // Погибшие отряды, существующие на бэкенде, копим до итога сражения:
    // уничтожаются одним подтверждением мастера (DELETE /troops/:id).
    const fallen: FallenTroop[] = [];
    armiesRef.current.forEach(army => {
      army.troops.forEach(troop => {
        if (!removed.has(troop.uid)) return;
        if (typeof troop.troopId !== 'number') return;
        fallen.push({
          troopId: troop.troopId,
          kind: troop.kind,
          name: troop.name,
          armyName: army.name,
          armyUid: army.uid,
          armyId: army.armyId,
        });
      });
    });
    if (fallen.length > 0) {
      setFallenTroops(prev => [...prev, ...fallen]);
    }

    const next = armiesRef.current.map(army => ({
      ...army,
      troops: army.troops.filter(troop => !removed.has(troop.uid)),
    }));

    const present = (side: BattleSide) =>
      next.filter(army => army.side === side && !army.retreated && army.troops.length > 0);
    const troopsLeft = (side: BattleSide) =>
      next.filter(army => army.side === side).reduce((sum, army) => sum + army.troops.length, 0);

    setBattleArmies(next);
    setRolls({});
    setSpinning({});
    setHits({ attacker: 0, defender: 0 });
    setVictims({ attacker: [], defender: [] });

    if (present('attacker').length === 0 || present('defender').length === 0) {
      const attackerGone = present('attacker').length === 0;
      if (attackerGone) {
        setOutcome(troopsLeft('attacker') === 0 ? 'attackers_destroyed' : 'attackers_retreated');
      } else {
        setOutcome(troopsLeft('defender') === 0 ? 'defenders_destroyed' : 'defenders_retreated');
      }
      setPhase('finished');
    } else {
      setPhase('retreat');
      setRoundMessage(null);
    }
  }, []);

  const scene = useScenePlayer({ onComplete: applyCasualties });
  /** Стабильные ссылки на действия сцены: нужны в зависимостях useCallback. */
  const resetScene = scene.reset;
  const startScene = scene.start;
  const skipSceneAction = scene.skip;

  // ─── Справочники ─────────────────────────────────────────────────────────

  const regionsById = useMemo(() => {
    const map = new Map<number, number | null>();
    (regionsQuery.data || []).forEach(region => {
      map.set(region.id, region.country_id ?? region.country?.id ?? null);
    });
    return map;
  }, [regionsQuery.data]);

  const regionCountryId = useCallback(
    (regionId?: number | null): number | null => {
      if (!regionId) return null;
      return regionsById.get(regionId) ?? null;
    },
    [regionsById],
  );

  /**
   * Все государства: GET /countries.json, а не набор стран из регионов.
   * Регионы покрывают только те государства, у которых есть земли (на живом
   * бэкенде это была одна Русь), поэтому список стран берётся отдельным запросом.
   * Регионы остаются запасным вариантом, если справочник не загрузился.
   */
  const countries = useMemo(() => {
    const all = allCountriesQuery.data || [];
    if (all.length > 0) {
      return all
        .map(country => ({ id: country.id, name: country.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }

    const map = new Map<number, { id: number; name: string }>();
    (regionsQuery.data || []).forEach(region => {
      const country = region.country;
      if (country?.id) map.set(country.id, { id: country.id, name: country.name });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [allCountriesQuery.data, regionsQuery.data]);

  const countryName = useCallback(
    (countryId: number | null | undefined): string => {
      if (!countryId) return 'государство не определено';
      return countries.find(country => country.id === countryId)?.name || `государство #${countryId}`;
    },
    [countries],
  );

  const cities = useMemo(() => {
    const settlements = settlementsQuery.data || [];
    if (selectedCountryId === null) return [];
    return settlements
      .filter(settlement => regionCountryId(settlement.region_id) === selectedCountryId)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [settlementsQuery.data, selectedCountryId, regionCountryId]);

  const selectedSettlement: Settlement | null = useMemo(
    () => (settlementsQuery.data || []).find(item => item.id === selectedSettlementId) || null,
    [settlementsQuery.data, selectedSettlementId],
  );

  const fortressLevel = useMemo(
    () => fortressLevelFromSettlement(selectedSettlement),
    [selectedSettlement],
  );
  const isCapital = useMemo(() => isCapitalSettlement(selectedSettlement), [selectedSettlement]);
  const defendingCountryId = useMemo(
    () => regionCountryId(selectedSettlement?.region_id),
    [regionCountryId, selectedSettlement],
  );

  /**
   * Армии с бэкенда для шага 2. Государство выводится из владельца/стоянки:
   * на старом бэкенде поля country_id у армии и country_id у игрока нет.
   */
  const availableArmies: AvailableArmy[] = useMemo(() => {
    const usedArmyIds = new Set(
      battleArmies.map(item => item.armyId).filter((id): id is number => id !== null),
    );
    return (armiesQuery.data || [])
      .map(army => {
        const troops = army.troops || [];
        const kinds = troops
          .map(troop => (troop.troop_type?.name || '').trim())
          .filter(Boolean);
        return {
          army,
          key: `api-${army.id}`,
          ownerName: army.owner?.name || 'без владельца',
          countryId: armyCountryId(army, regionCountryId),
          troopsLabel: kinds.length ? kinds.join(', ') : 'отрядов нет',
          troopsCount: troops.length,
          used: usedArmyIds.has(army.id),
        };
      })
      .sort((a, b) => a.army.name.localeCompare(b.army.name, 'ru'));
  }, [armiesQuery.data, battleArmies, regionCountryId]);

  // ─── Шаг 1. Место ────────────────────────────────────────────────────────

  const setPlaceKind = useCallback((kind: 'field' | 'city') => {
    setPlaceKindState(kind);
    if (kind === 'field') {
      setSelectedCountryId(null);
      setSelectedSettlementId(null);
    }
  }, []);

  const selectCountry = useCallback((countryId: number | null) => {
    setSelectedCountryId(countryId);
    setSelectedSettlementId(null);
  }, []);

  const selectSettlement = useCallback((settlementId: number | null) => {
    setSelectedSettlementId(settlementId);
  }, []);

  const placeReady =
    placeKind === 'field' || (selectedCountryId !== null && selectedSettlementId !== null);

  const placeTitle = useMemo(() => {
    if (placeKind === 'field') return 'Сражение в поле';
    if (!selectedSettlement) return 'Сражение за город';
    return `За город ${selectedSettlement.name}`;
  }, [placeKind, selectedSettlement]);

  // ─── Шаг 2. Армии ────────────────────────────────────────────────────────

  const addArmy = useCallback(
    (army: Army, side: BattleSide) => {
      setBattleArmies(prev => {
        if (prev.some(item => item.armyId === army.id)) return prev;
        const uid = nextUid('army');
        const startOrder = orderRef.current;
        const troops = battleTroopsFromArmy(army, startOrder, uid);
        orderRef.current = startOrder + troops.length;
        return [
          ...prev,
          {
            uid,
            armyId: army.id,
            name: army.name,
            ownerName: army.owner?.name || 'без владельца',
            ownerPlayerId:
              army.owner_type === 'Player' && army.owner?.id ? army.owner.id : null,
            countryId: armyCountryId(army, regionCountryId),
            side,
            troops,
            bonus: 0,
            debuff: 0,
            retreated: false,
            retreatRoll: null,
          },
        ];
      });
    },
    [nextUid, regionCountryId],
  );

  const removeArmy = useCallback((armyUid: string) => {
    setBattleArmies(prev => prev.filter(item => item.uid !== armyUid));
  }, []);

  const changeSide = useCallback((armyUid: string, side: BattleSide) => {
    setBattleArmies(prev =>
      prev.map(item => (item.uid === armyUid ? { ...item, side } : item)),
    );
  }, []);

  const addTroop = useCallback(
    (armyUid: string, kind: TroopKind) => {
      const uid = nextUid('troop');
      const order = nextOrder();
      setBattleArmies(prev =>
        prev.map(item =>
          item.uid === armyUid
            ? {
                ...item,
                troops: [
                  ...item.troops,
                  { uid, kind, name: TROOP_LABEL[kind], source: 'added', order, troopId: null },
                ],
              }
            : item,
        ),
      );
    },
    [nextOrder, nextUid],
  );

  const removeTroop = useCallback((armyUid: string, troopUid: string) => {
    setBattleArmies(prev =>
      prev.map(item =>
        item.uid === armyUid
          ? { ...item, troops: item.troops.filter(troop => troop.uid !== troopUid) }
          : item,
      ),
    );
  }, []);

  const changeBonus = useCallback((armyUid: string, delta: number) => {
    setBattleArmies(prev =>
      prev.map(item =>
        item.uid === armyUid
          ? { ...item, bonus: Math.min(MAX_ARMY_MODIFIER, Math.max(0, item.bonus + delta)) }
          : item,
      ),
    );
  }, []);

  const changeDebuff = useCallback((armyUid: string, delta: number) => {
    setBattleArmies(prev =>
      prev.map(item =>
        item.uid === armyUid
          ? { ...item, debuff: Math.min(MAX_ARMY_MODIFIER, Math.max(0, item.debuff + delta)) }
          : item,
      ),
    );
  }, []);

  const attackers = useMemo(
    () => battleArmies.filter(item => item.side === 'attacker'),
    [battleArmies],
  );
  const defenders = useMemo(
    () => battleArmies.filter(item => item.side === 'defender'),
    [battleArmies],
  );
  const troopsBySide = useMemo(
    () => ({
      attacker: battleArmies
        .filter(army => army.side === 'attacker' && !army.retreated)
        .reduce((sum, army) => sum + army.troops.length, 0),
      defender: battleArmies
        .filter(army => army.side === 'defender' && !army.retreated)
        .reduce((sum, army) => sum + army.troops.length, 0),
    }),
    [battleArmies],
  );
  const totalTroops = useMemo(
    () => battleArmies.reduce((sum, army) => sum + army.troops.length, 0),
    [battleArmies],
  );

  /** Предупреждение: крепость есть, пушки у нападающих нет. Не блокирует бой. */
  const cannonWarning = useMemo(() => {
    if (placeKind !== 'city' || !fortressRequiresCannon(fortressLevel)) return null;
    const hasCannon = attackers.some(army => army.troops.some(troop => troop.kind === 'cannon'));
    if (hasCannon) return null;
    return `У нападающих нет пушки, а город защищает крепость ${fortressLevel} уровня — напасть нельзя. Сражение не заблокировано, но мастера это предупреждение.`;
  }, [attackers, fortressLevel, placeKind]);

  // ─── Переходы между шагами ───────────────────────────────────────────────

  const resetBattleState = useCallback(() => {
    runRef.current += 1;
    pendingVictimsRef.current = null;
    battleReportedRef.current = false;
    resetScene();
    setRolls({});
    setSpinning({});
    setRetreatSpinning({});
    setHits({ attacker: 0, defender: 0 });
    setVictims({ attacker: [], defender: [] });
    setPhase('rolling');
    setRound(1);
    setOutcome(null);
    setOutcomeConfirmed(false);
    setDeletedArmyIds([]);
    setDeleteError(null);
    setFallenTroops([]);
    setDeletedTroopIds([]);
    setTroopDeleteError(null);
    setTroopsConfirmed(false);
    setTroopDeleteBusy(false);
    setVoevodaBusy(false);
    setVoevodaError(null);
    setVoevodaAwarded(null);
    setRoundMessage(null);
    setAnnexationChoice(null);
    setAnnexationResult(null);
    setAnnexationBusy(false);
    setAnnexationError(null);
    setCityOwnerBusy(false);
    setCityOwnerError(null);
    setCityOwnerResult(null);
  }, [resetScene]);

  /** Пехота от города: по одной в каждую защищающуюся армию (только в городском бою). */
  const ensureCityInfantry = useCallback(() => {
    if (placeKind !== 'city') return;
    const current = armiesRef.current;
    const needInfantry = current.some(
      army => army.side === 'defender' && !army.troops.some(troop => troop.source === 'city'),
    );
    if (!needInfantry) return;

    const next = current.map(army => {
      if (army.side !== 'defender') return army;
      if (army.troops.some(troop => troop.source === 'city')) return army;
      const uid = nextUid('city');
      const order = nextOrder();
      return {
        ...army,
        troops: [
          ...army.troops,
          {
            uid,
            kind: 'infantry' as TroopKind,
            name: 'Пехота (город)',
            source: 'city' as const,
            order,
            troopId: null,
          },
        ],
      };
    });
    setBattleArmies(next);
  }, [nextOrder, nextUid, placeKind]);

  const goNext = useCallback(() => {
    if (step === 'place') {
      if (!placeReady) return;
      if (placeKind === 'city' && selectedSettlement) {
        // Город защищается сам: в защищающихся сразу стоит его гарнизон — одна пехота.
        // Это позволяет вести бой «один город против одной армии», не выбирая защитника.
        const garrison: BattleArmy = {
          uid: nextUid('garrison'),
          armyId: null,
          isGarrison: true,
          name: `Гарнизон (${selectedSettlement.name})`,
          ownerName: 'город',
          ownerPlayerId: null,
          countryId: defendingCountryId,
          side: 'defender',
          troops: [
            {
              uid: nextUid('city'),
              kind: 'infantry',
              name: 'Пехота (город)',
              source: 'city',
              order: nextOrder(),
              troopId: null,
            },
          ],
          bonus: 0,
          debuff: 0,
          retreated: false,
          retreatRoll: null,
        };
        setBattleArmies(prev => [garrison, ...prev.filter(army => !army.isGarrison)]);
      } else {
        setBattleArmies(prev => prev.filter(army => !army.isGarrison));
      }
      setStep('armies');
      return;
    }
    if (step === 'armies') {
      // Бой без одной из сторон не имеет смысла: нужна хотя бы одна армия сверху и снизу.
      if (attackers.length === 0 || defenders.length === 0) return;
      setStep('buffs');
      return;
    }
    if (step === 'buffs') {
      ensureCityInfantry();
      resetBattleState();
      setStep('battle');
    }
  }, [
    attackers.length,
    defenders.length,
    defendingCountryId,
    ensureCityInfantry,
    nextOrder,
    nextUid,
    placeKind,
    placeReady,
    resetBattleState,
    selectedSettlement,
    step,
  ]);

  const goBack = useCallback(() => {
    if (step === 'armies') {
      setStep('place');
      return;
    }
    if (step === 'buffs') {
      setStep('armies');
      return;
    }
    if (step === 'battle') {
      // Возврат в баффы: убираем пехоту, добавленную городом, и обнуляем раунд.
      // У гарнизона города эта пехота — единственная, её не трогаем.
      setBattleArmies(prev =>
        prev.map(army => ({
          ...army,
          troops: army.troops.filter(troop => army.isGarrison || troop.source !== 'city'),
          retreated: false,
          retreatRoll: null,
        })),
      );
      resetBattleState();
      setStep('buffs');
    }
  }, [resetBattleState, step]);

  const resetAll = useCallback(() => {
    setStep('place');
    setPlaceKindState('field');
    setSelectedCountryId(null);
    setSelectedSettlementId(null);
    setBattleArmies([]);
    orderRef.current = 0;
    uidRef.current = 0;
    resetBattleState();
  }, [resetBattleState]);

  // ─── Шаг 4. Броски ───────────────────────────────────────────────────────

  const fortressBonusFor = useCallback(
    (army: BattleArmy): number => (army.side === 'defender' ? fortressDiceBonus(fortressLevel) : 0),
    [fortressLevel],
  );

  const modifierFor = useCallback(
    (army: BattleArmy): number => armyModifier(army.bonus, army.debuff),
    [],
  );

  const effectiveFor = useCallback(
    (army: BattleArmy, roll: number): number =>
      effectiveRoll(roll, {
        modifier: modifierFor(army),
        fortressBonus: fortressBonusFor(army),
      }),
    [fortressBonusFor, modifierFor],
  );

  /**
   * Сколько отрядов стороны обязано погибнуть в этом раунде: попадания
   * ПРОТИВНИКА, но не больше, чем у стороны живых отрядов.
   *
   * Раньше выбор потерь ограничивался `hits[side]` — попаданиями самой стороны,
   * и при `hits.attacker < hits.defender` мастер не мог проставить нужное число
   * меток (снять метку получалось, вернуть — нет).
   */
  const lossLimit = useCallback(
    (side: BattleSide): number => {
      const incoming = side === 'attacker' ? hits.defender : hits.attacker;
      const alive = side === 'attacker' ? troopsBySide.attacker : troopsBySide.defender;
      return Math.max(0, Math.min(incoming, alive));
    },
    [hits, troopsBySide],
  );

  /** Попадания, полученные стороной (их нанесли отряды противоположной). */
  const incomingHits = useMemo(
    () => ({ attacker: hits.defender, defender: hits.attacker }),
    [hits],
  );

  const participants = useMemo(() => {
    const list: Array<{ armyUid: string; side: BattleSide; troop: BattleTroop }> = [];
    battleArmies.forEach(army => {
      if (army.retreated) return;
      army.troops.forEach(troop => {
        if (!participates(troop.kind)) return;
        list.push({ armyUid: army.uid, side: army.side, troop });
      });
    });
    return list;
  }, [battleArmies]);

  const scheduleRoll = useCallback(
    (uids: string[], baseDelay: number) => {
      const run = runRef.current;
      uids.forEach((uid, index) => {
        if (rollsRef.current[uid] !== undefined || spinningRef.current[uid]) return;
        setSpinning(prev => ({ ...prev, [uid]: true }));
        spinningRef.current[uid] = true;
        const delay = baseDelay + index * ROLL_STAGGER_MS + DIE_SPIN_MS;
        schedule(() => {
          if (runRef.current !== run) return;
          const value = rollDie(rngRef.current);
          setSpinning(prev => ({ ...prev, [uid]: false }));
          spinningRef.current[uid] = false;
          setRolls(prev => (prev[uid] !== undefined ? prev : { ...prev, [uid]: value }));
        }, delay);
      });
    },
    [schedule],
  );

  const rollTroop = useCallback(
    (uid: string) => {
      if (phase !== 'rolling') return;
      const army = battleArmies.find(item => item.troops.some(troop => troop.uid === uid));
      if (!army || army.retreated) return;
      scheduleRoll([uid], 0);
    },
    [battleArmies, phase, scheduleRoll],
  );

  const rollArmy = useCallback(
    (armyUid: string) => {
      if (phase !== 'rolling') return;
      const uids = participants.filter(item => item.armyUid === armyUid).map(item => item.troop.uid);
      scheduleRoll(uids, 0);
    },
    [participants, phase, scheduleRoll],
  );

  /** Есть ли ещё не брошенные отряды: по этому признаку активна кнопка «Ход». */
  const canRollAll = useMemo(
    () => phase === 'rolling' && participants.some(item => rolls[item.troop.uid] === undefined),
    [participants, phase, rolls],
  );

  /**
   * «Ход» — один жест мастера на весь раунд: волна кубиков по всем отрядам обеих
   * сторон (шаг между кубиками задаёт `scheduleRoll`). Дальше попадания считает
   * существующий эффект, а бой показывает сцена.
   */
  const rollAll = useCallback(() => {
    if (phase !== 'rolling') return;
    const uids = participants
      .filter(item => rollsRef.current[item.troop.uid] === undefined)
      .map(item => item.troop.uid);
    scheduleRoll(uids, 0);
  }, [participants, phase, scheduleRoll]);

  // Когда все кубики обеих сторон легли — считаем попадания и авто-выбор потерь.
  useEffect(() => {
    if (step !== 'battle' || phase !== 'rolling') return;
    if (participants.length === 0) {
      // Участвующих отрядов нет вовсе (одни пушки) — попаданий быть не может.
      setRoundMessage('Отрядов, участвующих в бою, нет — обе армии сохранились.');
      setPhase('retreat');
      return;
    }
    const allRolled = participants.every(item => rolls[item.troop.uid] !== undefined);
    if (!allRolled) return;

    const armyByUid = new Map(battleArmies.map(army => [army.uid, army]));
    const rollOf = (uid: string, army: BattleArmy) => effectiveFor(army, rolls[uid]);
    let attackerHits = 0;
    let defenderHits = 0;
    participants.forEach(item => {
      const army = armyByUid.get(item.armyUid);
      if (!army) return;
      if (isHit(item.troop.kind, rollOf(item.troop.uid, army))) {
        if (item.side === 'attacker') attackerHits += 1;
        else defenderHits += 1;
      }
    });

    if (attackerHits === 0 && defenderHits === 0) {
      setRoundMessage('Попаданий нет — обе армии сохранились, можно отступать.');
      setPhase('retreat');
      return;
    }

    const attackerTroops = battleArmies
      .filter(army => army.side === 'attacker' && !army.retreated)
      .flatMap(army => army.troops);
    const defenderTroops = battleArmies
      .filter(army => army.side === 'defender' && !army.retreated)
      .flatMap(army => army.troops);

    // Попадания атакующих убивают защищающихся и наоборот.
    const defenderVictims = autoCasualties(defenderTroops, attackerHits).map(troop => troop.uid);
    const attackerVictims = autoCasualties(attackerTroops, defenderHits).map(troop => troop.uid);

    setHits({ attacker: attackerHits, defender: defenderHits });
    setVictims({ attacker: attackerVictims, defender: defenderVictims });
    setRoundMessage(null);
    setPhase('casualties');
  }, [battleArmies, effectiveFor, participants, phase, rolls, step]);

  /**
   * Ручная правка авто-выбора: касание фишки снимает или ставит метку потери.
   * Предел — `lossLimit(side)`: пока меток меньше, новая добавляется, а когда
   * предел достигнут, новая метка заменяет самую старую.
   */
  const toggleVictim = useCallback(
    (side: BattleSide, uid: string) => {
      if (phase !== 'casualties') return;
      const limit = lossLimit(side);
      if (limit <= 0) return;
      setVictims(prev => {
        const current = prev[side];
        if (current.includes(uid)) {
          return { ...prev, [side]: current.filter(item => item !== uid) };
        }
        const next = current.length >= limit ? [...current.slice(1), uid] : [...current, uid];
        return { ...prev, [side]: next };
      });
    },
    [lossLimit, phase],
  );

  const victimsReady =
    victims.attacker.length === lossLimit('attacker') &&
    victims.defender.length === lossLimit('defender');

  /**
   * Подтверждение потерь: отряды НЕ удаляются сразу — сначала сцена проигрывает
   * удары и смерти (`useScenePlayer`), а по её завершении `applyCasualties`
   * применяет потери. Так фишка успевает уехать и погаснуть до исчезновения.
   */
  const confirmCasualties = useCallback(() => {
    if (phase !== 'casualties' || !victimsReady) return;
    const applied = { attacker: [...victims.attacker], defender: [...victims.defender] };
    pendingVictimsRef.current = applied;

    const snapshot = (side: BattleSide): SceneTroop[] =>
      battleArmies
        .filter(army => army.side === side && !army.retreated)
        .flatMap(army =>
          army.troops.map(troop => {
            const raw = rolls[troop.uid];
            const value = raw === undefined ? null : effectiveFor(army, raw);
            return {
              uid: troop.uid,
              side,
              armyUid: army.uid,
              armyName: army.name,
              troopName: troop.name,
              kind: troop.kind,
              value,
              hit: value !== null && isHit(troop.kind, value),
            };
          }),
        );

    const built = buildRoundScene({
      round,
      attackers: snapshot('attacker'),
      defenders: snapshot('defender'),
      hits,
      victims: applied,
    });

    setPhase('playing');
    startScene(built.steps);
  }, [
    battleArmies,
    effectiveFor,
    hits,
    phase,
    rolls,
    round,
    startScene,
    victims,
    victimsReady,
  ]);

  const skipScene = useCallback(() => {
    if (phase !== 'playing') return;
    skipSceneAction();
  }, [phase, skipSceneAction]);

  // ─── Отступление ─────────────────────────────────────────────────────────

  const retreatArmy = useCallback(
    (armyUid: string) => {
      if (phase !== 'retreat') return;
      if (retreatSpinning[armyUid]) return;
      const army = battleArmies.find(item => item.uid === armyUid);
      if (!army || army.retreated || army.retreatRoll !== null) return;
      const run = runRef.current;
      setRetreatSpinning(prev => ({ ...prev, [armyUid]: true }));
      schedule(() => {
        if (runRef.current !== run) return;
        const value = rollDie(rngRef.current);
        setRetreatSpinning(prev => ({ ...prev, [armyUid]: false }));
        setBattleArmies(prev =>
          prev.map(item =>
            item.uid === armyUid
              ? { ...item, retreatRoll: value, retreated: canRetreat(value) }
              : item,
          ),
        );
      }, DIE_SPIN_MS);
    },
    [battleArmies, phase, retreatSpinning, schedule],
  );

  const nextRound = useCallback(() => {
    if (phase !== 'retreat') return;
    const withReset = armiesRef.current.map(army => ({ ...army, retreatRoll: null }));
    setBattleArmies(withReset);

    const stillPresent = (side: BattleSide) =>
      withReset.filter(army => army.side === side && !army.retreated && army.troops.length > 0);
    const attackerGone = stillPresent('attacker').length === 0;
    const defenderGone = stillPresent('defender').length === 0;

    if (attackerGone || defenderGone) {
      setOutcome(attackerGone ? 'attackers_retreated' : 'defenders_retreated');
      setPhase('finished');
      return;
    }

    runRef.current += 1;
    setRolls({});
    setSpinning({});
    setRetreatSpinning({});
    setHits({ attacker: 0, defender: 0 });
    setVictims({ attacker: [], defender: [] });
    setRound(value => value + 1);
    setRoundMessage(null);
    setPhase('rolling');
  }, [phase]);

  /**
   * Закончить сражение в перерыве между раундами: мастер решает, кто уходит.
   *
   * Три сценария (заказчик):
   *  1. бой в чистом поле — итог сражения с подтверждениями (уничтожение
   *     погибших отрядов/разбитых армий, влияние Воеводе);
   *  2. была осада и атакующие уходят — то же, что и в п. 1;
   *  3. бой за город и защищающиеся отступают — тот же итог плюс блок передачи
   *     и снятия владельца города (`capturedCity`).
   *
   * Раунд не переигрывается: сцена сбрасывается, бросок отступления не нужен —
   * уход по решению мастера, а не по правилу 4–6.
   */
  const finishBattle = useCallback(
    (side: BattleSide) => {
      if (phase !== 'retreat') return;
      runRef.current += 1;
      pendingVictimsRef.current = null;
      resetScene();
      setRolls({});
      setSpinning({});
      setRetreatSpinning({});
      setHits({ attacker: 0, defender: 0 });
      setVictims({ attacker: [], defender: [] });
      setRoundMessage(null);
      setBattleArmies(prev => prev.map(army => ({ ...army, retreatRoll: null })));
      setOutcome(side === 'attacker' ? 'attackers_retreated' : 'defenders_retreated');
      setPhase('finished');
    },
    [phase, resetScene],
  );

  // ─── Итог: подтверждение уничтожения армий ───────────────────────────────

  const armiesToDestroy = useMemo(() => {
    if (outcome !== 'attackers_destroyed' && outcome !== 'defenders_destroyed') return [];
    const side: BattleSide = outcome === 'attackers_destroyed' ? 'attacker' : 'defender';
    return battleArmies
      .filter(army => army.side === side && !army.retreated && army.troops.length === 0)
      .map(army => ({ uid: army.uid, armyId: army.armyId, name: army.name, ownerName: army.ownerName }));
  }, [battleArmies, outcome]);

  const confirmOutcome = useCallback(async () => {
    if (busy || outcomeConfirmed) return;
    setBusy(true);
    setDeleteError(null);
    const ids = armiesToDestroy
      .map(army => army.armyId)
      .filter((id): id is number => typeof id === 'number');
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await ApiService.deleteArmy(id);
        setDeletedArmyIds(prev => [...prev, id]);
      } catch (error) {
        errors.push(getErrorMessage(error, `армия #${id}`));
      }
    }
    if (ids.length > 0) {
      queryClient.invalidate([queryKeys.armies()]);
    }
    setDeleteError(errors.length ? errors.join('; ') : null);
    setOutcomeConfirmed(true);
    setBusy(false);
  }, [armiesToDestroy, busy, outcomeConfirmed]);

  /**
   * Погибшие отряды, которые надо удалить на бэкенде: исключаем отряды армий,
   * которые удаляются целиком (вместе с армией уходят и её отряды) и уже
   * удалённые в этом бою.
   */
  const troopsToDestroy = useMemo(() => {
    const destroyedArmyUids = new Set(armiesToDestroy.map(army => army.uid));
    return fallenTroops.filter(troop => !destroyedArmyUids.has(troop.armyUid));
  }, [armiesToDestroy, fallenTroops]);

  /**
   * Уничтожение погибших отрядов на бэкенде — отдельное подтверждение мастера.
   * Армия, удалённая целиком, уносит свои отряды сама (dependent: :destroy),
   * поэтому её отряды в этот список не попадают.
   */
  const confirmTroopDestruction = useCallback(async () => {
    if (troopDeleteBusy || troopsConfirmed) return;
    setTroopDeleteBusy(true);
    setTroopDeleteError(null);

    const ids: number[] = [];
    troopsToDestroy.forEach(troop => {
      if (!deletedTroopIds.includes(troop.troopId) && !ids.includes(troop.troopId)) {
        ids.push(troop.troopId);
      }
    });

    const errors: string[] = [];
    for (const id of ids) {
      try {
        await ApiService.deleteTroop(id);
        setDeletedTroopIds(prev => [...prev, id]);
      } catch (error) {
        errors.push(getErrorMessage(error, `отряд #${id}`));
      }
    }
    if (ids.length > 0) {
      queryClient.invalidate([queryKeys.armies()]);
    }
    setTroopDeleteError(errors.length ? errors.join('; ') : null);
    setTroopsConfirmed(true);
    setTroopDeleteBusy(false);
  }, [deletedTroopIds, troopDeleteBusy, troopsConfirmed, troopsToDestroy]);

  /**
   * Взятый город: что мастер может с ним сделать в конце боя. Появляется, когда
   * защищающиеся разбиты ИЛИ сами оставили город (п. 3 «закончить сражение»), —
   * владелец города показывается независимо от того, столица это или нет.
   */
  const capturedCity = useMemo(() => {
    if (outcome !== 'defenders_destroyed' && outcome !== 'defenders_retreated') return null;
    if (placeKind !== 'city' || !selectedSettlement) return null;

    // Игроки, чьи армии нападали: их показываем первыми в выборе владельца.
    const attackerPlayerIds: number[] = [];
    attackers.forEach(army => {
      if (army.ownerPlayerId !== null && !attackerPlayerIds.includes(army.ownerPlayerId)) {
        attackerPlayerIds.push(army.ownerPlayerId);
      }
    });

    return {
      settlementId: selectedSettlement.id,
      name: selectedSettlement.name,
      regionId: selectedSettlement.region_id ?? null,
      isCapital,
      owner: selectedSettlement.player
        ? { id: selectedSettlement.player.id, name: selectedSettlement.player.name }
        : null,
      attackerPlayerIds,
    };
  }, [attackers, isCapital, outcome, placeKind, selectedSettlement]);

  /**
   * Присоединение региона: взята столица государства, значит регион столицы можно
   * передать победителю. Победитель — государство атакующих армий; если союзников
   * было несколько, мастер выбирает страну. Отдельного API захвата города нет,
   * поэтому передаётся регион целиком (`PATCH /regions/:id/captured_by`).
   *
   * Армии защищающегося на бэкенде не блокируют предложение: по правилам, пока
   * армии противника не уничтожены, взятие столицы — оккупация, и мастер решает
   * сам (экран показывает, сколько армий у государства осталось).
   */
  const annexation = useMemo(() => {
    // Регион присоединяется только за взятие столицы силой; когда защищающиеся
    // сами оставили город, мастер решает по владельцу (и регион — в веб-админке).
    if (outcome !== 'defenders_destroyed') return null;
    if (!capturedCity || !capturedCity.isCapital) return null;
    if (defendingCountryId === null) return null;
    const regionId = capturedCity.regionId;
    if (regionId === null) return null;

    // Страны-победители: государства атакующих армий, кроме самого защищающегося
    // (бой внутри одного государства регион никуда не передаёт).
    const attackerCountryIds: number[] = [];
    attackers.forEach(army => {
      const id = army.countryId;
      if (id === null || id === defendingCountryId) return;
      if (!attackerCountryIds.includes(id)) attackerCountryIds.push(id);
    });

    // Армии защищающегося государства, которые бой не уничтожил (для справки мастера).
    const destroyedIds = new Set(
      battleArmies
        .filter(army => army.side === 'defender' && army.armyId !== null)
        .map(army => army.armyId as number),
    );
    const remainingArmyCount = (armiesQuery.data || []).filter(army => {
      if (destroyedIds.has(army.id)) return false;
      return armyCountryId(army, regionCountryId) === defendingCountryId;
    }).length;

    const region = (regionsQuery.data || []).find(item => item.id === regionId) || null;

    return {
      regionId,
      regionName: region?.name || `регион #${regionId}`,
      defendingCountryId,
      defendingCountryName: countryName(defendingCountryId),
      capitalName: capturedCity.name,
      attackerCountries: attackerCountryIds.map(id => ({ id, name: countryName(id) })),
      remainingArmyCount,
    };
  }, [
    armiesQuery.data,
    attackers,
    battleArmies,
    capturedCity,
    countryName,
    defendingCountryId,
    outcome,
    regionCountryId,
    regionsQuery.data,
  ]);

  /** Кому передаём регион: выбор мастера, а если победитель один — сразу он. */
  const annexationTarget = useMemo(() => {
    if (!annexation) return null;
    if (annexationChoice !== null) return annexationChoice;
    return annexation.attackerCountries.length === 1 ? annexation.attackerCountries[0].id : null;
  }, [annexation, annexationChoice]);

  const chooseAnnexationCountry = useCallback((countryId: number) => {
    setAnnexationChoice(countryId);
    setAnnexationError(null);
  }, []);

  /**
   * Передать регион победителю. Решение мастера уходит на бэкенд тем же вызовом,
   * что делает веб-админка ([1] — войной), поэтому регион переходит стране сразу
   * и оформлять его в админке больше не нужно.
   */
  const confirmAnnexation = useCallback(async (): Promise<number | null> => {
    if (!annexation || annexationTarget === null || annexationResult || annexationBusy) return null;
    const target = annexationTarget;
    const regionName = annexation.regionName;
    setAnnexationBusy(true);
    setAnnexationError(null);
    try {
      await ApiService.captureRegion(annexation.regionId, target, true);
      // Снимок итога — до инвалидации: после неё регион уже чужой и `annexation`
      // пересчитается без стран-победителей.
      setAnnexationResult({ regionName, countryId: target, countryName: countryName(target) });
      queryClient.invalidate([
        queryKeys.regions(),
        queryKeys.settlements(),
        queryKeys.allCountries(),
        queryKeys.armies(),
      ]);
      return target;
    } catch (error) {
      setAnnexationError(getErrorMessage(error, 'Присоединение региона'));
      return null;
    } finally {
      setAnnexationBusy(false);
    }
  }, [annexation, annexationBusy, annexationResult, annexationTarget, countryName]);

  const annexationDone = annexationResult !== null;

  // ─── Владелец взятого города ─────────────────────────────────────────────

  /** Игроки для выбора владельца: все, но нападавшие — первыми. */
  const ownerChoices = useMemo(() => {
    if (!capturedCity) return [];
    return (playersQuery.data || [])
      .map(player => ({
        id: player.id,
        name: player.name,
        countryName:
          player.country?.name || (player.country_id ? countryName(player.country_id) : ''),
        attacked: capturedCity.attackerPlayerIds.includes(player.id),
      }))
      .sort((a, b) => {
        // Нападавшие первыми: чаще всего владельцем становится тот, кто взял город.
        if (a.attacked !== b.attacked) return a.attacked ? -1 : 1;
        return a.name.localeCompare(b.name, 'ru');
      });
  }, [capturedCity, countryName, playersQuery.data]);

  /**
   * Смена владельца города одним вызовом (тот же, что в веб-админке):
   * `playerId = null` снимает владельца. Поселения инвалидируются, поэтому строка
   * «Владелец» обновляется из данных, а не из нажатия.
   */
  const changeCityOwner = useCallback(
    async (playerId: number | null): Promise<boolean> => {
      if (!capturedCity || cityOwnerBusy) return false;
      setCityOwnerBusy(true);
      setCityOwnerError(null);
      try {
        await ApiService.setSettlementOwner(capturedCity.settlementId, playerId);
        setCityOwnerResult(playerId === null ? 'removed' : 'assigned');
        queryClient.invalidate([queryKeys.settlements()]);
        return true;
      } catch (error) {
        setCityOwnerError(getErrorMessage(error, 'Смена владельца города'));
        return false;
      } finally {
        setCityOwnerBusy(false);
      }
    },
    [capturedCity, cityOwnerBusy],
  );

  const removeCityOwner = useCallback(() => changeCityOwner(null), [changeCityOwner]);

  const assignCityOwner = useCallback(
    (playerId: number) => changeCityOwner(playerId),
    [changeCityOwner],
  );

  // ─── Итог сражения мастерам (уведомление) ────────────────────────────────

  /**
   * Итог сражения уходит на бэкенд, как только результат определился: бой
   * считается на клиенте, поэтому без этого запроса о нём знает только планшет.
   * Сервер рассылает полноэкранное окно мастерам сражений и политики (в том
   * числе мастеру политики в вебе — era_front).
   *
   * Отправка одноразовая (`battleReportedRef`) и НЕ блокирует итог: если связи
   * нет, бой всё равно разыгран, а мастера увидят его из прочих изменений.
   */
  useEffect(() => {
    if (!outcome || battleReportedRef.current) return;
    battleReportedRef.current = true;

    const winnerSide: 'attacker' | 'defender' =
      outcome === 'attackers_destroyed' || outcome === 'attackers_retreated'
        ? 'defender'
        : 'attacker';
    const label = (army: BattleArmy) => `${army.name} (${army.ownerName})`;
    // Государство победителя — акцент окна в вебе и на планшете. В городском бою
    // это государство города, в поле — государство армий выигравшей стороны.
    const winnerCountryId =
      winnerSide === 'attacker'
        ? attackers.find(army => army.countryId !== null)?.countryId ?? defendingCountryId
        : defenders.find(army => army.countryId !== null)?.countryId ?? defendingCountryId;

    ApiService.reportBattle({
      attackers: attackers.map(army => ({ label: label(army) })),
      defenders: defenders.map(army => ({ label: label(army) })),
      winner_side: winnerSide,
      outcome,
      place: placeKind === 'city' ? selectedSettlement?.name ?? null : 'В поле',
      round,
      fallen_troops: fallenTroops.length,
      winner_country_id: winnerCountryId,
    }).catch(() => {
      // Нет связи — окно мастерам не появится, но бой уже посчитан и записан
      // действиями мастера (уничтожение армий, передача региона).
    });
  }, [
    attackers,
    defendingCountryId,
    defenders,
    fallenTroops.length,
    outcome,
    placeKind,
    round,
    selectedSettlement,
  ]);

  // ─── Влияние Воеводе за победу ───────────────────────────────────────────

  /**
   * Победившие армии, существующие на бэкенде: гарнизон города и отряды,
   * добавленные мастером в состав боя, армиями на сервере не являются.
   */
  const winnerArmies = useMemo(() => {
    if (!outcome) return [];
    const winnerSide: BattleSide =
      outcome === 'attackers_destroyed' || outcome === 'attackers_retreated'
        ? 'defender'
        : 'attacker';

    return battleArmies
      .filter(army => army.side === winnerSide && army.armyId !== null)
      .map(army => ({
        uid: army.uid,
        armyId: army.armyId as number,
        name: army.name,
        ownerName: army.ownerName,
      }));
  }, [battleArmies, outcome]);

  /**
   * Разбитые армии проигравшей стороны, существующие на бэкенде.
   *
   * За каждую из них Воевода победителя получает +4, а Воевода проигравшего — −1.
   * Гарнизон (`armyId === null`) и отошедшие без потерь армии (`retreated`) не
   * считаются: бонус даётся только за реально разбитую армию.
   */
  const defeatedArmies = useMemo(() => {
    if (!outcome) return [];
    const loserSide: BattleSide =
      outcome === 'attackers_destroyed' || outcome === 'attackers_retreated'
        ? 'attacker'
        : 'defender';

    return battleArmies
      .filter(
        army =>
          army.side === loserSide &&
          army.armyId !== null &&
          !army.retreated &&
          army.troops.length === 0,
      )
      .map(army => ({
        uid: army.uid,
        armyId: army.armyId as number,
        name: army.name,
        ownerName: army.ownerName,
      }));
  }, [battleArmies, outcome]);

  /**
   * Влияние Воеводе за сражение. Бой на этом экране считается на клиенте, поэтому
   * серверный `Army#attack` (веб-админка) не вызывается и без явного вызова
   * Воевода оставался без бонуса. Сервер начисляет +4 за КАЖДУЮ разбитую армию
   * противника совету Воеводы победителя и −1 за каждую разбитую армию совету
   * Воеводы проигравшего; гарнизон армией не считается. Возвращает список
   * начислений и штрафов — по нему видно, кому что ушло.
   */
  const awardVoevodaInfluence = useCallback(async () => {
    if (voevodaBusy || voevodaAwarded) return;
    const ids = winnerArmies.map(army => army.armyId);
    if (ids.length === 0) {
      setVoevodaAwarded([]);
      setVoevodaError('Ни одной победившей армии нет на бэкенде — начислять некому.');
      return;
    }

    setVoevodaBusy(true);
    setVoevodaError(null);
    try {
      const result = await ApiService.awardBattleVictory(
        ids,
        defeatedArmies.map(army => army.armyId),
      );
      setVoevodaAwarded(result?.awarded ?? []);
      queryClient.invalidate([queryKeys.players()]);
    } catch (error) {
      setVoevodaError(getErrorMessage(error, 'Влияние Воеводе'));
    } finally {
      setVoevodaBusy(false);
    }
  }, [defeatedArmies, voevodaAwarded, voevodaBusy, winnerArmies]);

  // ─── Значения для карточек ───────────────────────────────────────────────

  const troopView = useCallback(
    (army: BattleArmy, troop: BattleTroop) => {
      const raw = rolls[troop.uid];
      const spinningNow = !!spinning[troop.uid];
      const value = raw === undefined ? null : effectiveFor(army, raw);
      return {
        raw: raw ?? null,
        value,
        isHit: value === null ? false : isHit(troop.kind, value),
        spinning: spinningNow,
        participates: participates(troop.kind),
        modifier: modifierFor(army),
        bonus: army.bonus,
        debuff: army.debuff,
        fortressBonus: fortressBonusFor(army),
      };
    },
    [effectiveFor, fortressBonusFor, modifierFor, rolls, spinning],
  );

  /** Строки ленты боя: тексты уже проигранных шагов сцены. */
  const sceneLog = useMemo(() => scene.applied.map(step => step.text), [scene.applied]);

  return {
    // данные
    armiesQuery,
    settlementsQuery,
    regionsQuery,
    countries,
    cities,
    countryName,
    selectedSettlement,
    defendingCountryId,
    fortressLevel,
    isCapital,
    // шаг 1
    step,
    placeKind,
    setPlaceKind,
    selectedCountryId,
    selectCountry,
    selectedSettlementId,
    selectSettlement,
    placeReady,
    placeTitle,
    /** Для шага 2: нужны армии с обеих сторон. */
    battleReady: attackers.length > 0 && defenders.length > 0,
    // шаг 2
    availableArmies,
    battleArmies,
    attackers,
    defenders,
    totalTroops,
    troopsBySide,
    addArmy,
    removeArmy,
    changeSide,
    addTroop,
    removeTroop,
    troopKinds: TROOP_KINDS,
    troopLabel: TROOP_LABEL,
    // шаг 3
    changeBonus,
    changeDebuff,
    cannonWarning,
    // переходы
    goNext,
    goBack,
    resetAll,
    // шаг 4
    round,
    phase,
    rolls,
    spinning,
    retreatSpinning,
    hits,
    /** Сколько попаданий получила каждая сторона: крупные цифры на сцене. */
    incomingHits,
    /** Сколько отрядов сторона обязана потерять в раунде (предел меток). */
    lossLimit,
    victims,
    victimsReady,
    outcome,
    outcomeConfirmed,
    deletedArmyIds,
    deleteError,
    busy,
    roundMessage,
    annexation,
    annexationChoice,
    setAnnexationChoice: chooseAnnexationCountry,
    annexationTarget,
    annexationResult,
    annexationDone,
    annexationBusy,
    annexationError,
    confirmAnnexation,
    /** Взятый город и действия с его владельцем. */
    capturedCity,
    ownerChoices,
    cityOwnerBusy,
    cityOwnerError,
    cityOwnerResult,
    removeCityOwner,
    assignCityOwner,
    armiesToDestroy,
    /** Погибшие отряды к уничтожению на бэкенде (DELETE /troops/:id). */
    troopsToDestroy,
    troopsConfirmed,
    troopDeleteBusy,
    troopDeleteError,
    deletedTroopIds,
    confirmTroopDestruction,
    /** «Закончить сражение» в перерыве между раундами (кто уходит). */
    finishBattle,
    /** Влияние Воеводе за победу: армии-победители и результат начисления. */
    winnerArmies,
    /** Разбитые армии проигравшей стороны (за каждую +4 победителю, −1 проигравшему). */
    defeatedArmies,
    voevodaBusy,
    voevodaError,
    voevodaAwarded,
    awardVoevodaInfluence,
    rollTroop,
    rollArmy,
    rollAll,
    canRollAll,
    /** Сцена раунда: шаги, активный шаг, скорость, «Пропустить». */
    scene,
    sceneLog,
    skipScene,
    toggleVictim,
    confirmCasualties,
    retreatArmy,
    nextRound,
    confirmOutcome,
    troopView,
    sideLabel,
    /** Подмена генератора бросков — только для тестов. */
    setRng: (rng: () => number) => {
      rngRef.current = rng;
    },
  };
}

export type BattleLogic = ReturnType<typeof useBattleLogic>;
