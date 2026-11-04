/**
 * Логика экрана «Карта»: сводит поселения, земли и игроков в города на карте,
 * держит выбор и выполняет действия мастера (владелец, крепость).
 *
 * Данные — через единый слой src/data (TTL, опрос в фокусе, инвалидация), а не
 * через прямые запросы в экране: экран только рисует.
 */
import { useCallback, useMemo, useState } from 'react';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import { usePlayers } from '../../data/hooks/usePlayers';
import { useRegions, useSettlements } from '../../data/hooks/useSettlements';
import { useRefetchOnFocus } from '../../data/useRefetchOnFocus';
import { getErrorMessage } from '../../data/apiErrors';
import ApiService from '../../services/api';
import { fortressLevelOf, isCapitalSettlement } from '../map/mapStyle';
import type { MapCity } from '../map/types';

/** Тип постройки «Кремль» (BuildingType::DEFENCE) — крепость города. */
const DEFENCE_BUILDING_TYPE = 2;

export const useMapLogic = () => {
  const settlementsQuery = useSettlements();
  const regionsQuery = useRegions();
  const playersQuery = usePlayers();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useRefetchOnFocus([queryKeys.settlements(), queryKeys.regions(), queryKeys.players()]);

  const cities = useMemo<MapCity[]>(() => {
    const settlements = settlementsQuery.data ?? [];
    const regions = regionsQuery.data ?? [];
    const byId = new Map<number, (typeof regions)[number]>();
    regions.forEach((region) => byId.set(region.id, region));

    return settlements
      .filter(
        (settlement) =>
          typeof settlement.map_x === 'number' && typeof settlement.map_y === 'number',
      )
      .map((settlement) => {
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

  const selected = useMemo(
    () => cities.find((city) => city.id === selectedId) ?? null,
    [cities, selectedId],
  );

  const invalidateSettlements = () => {
    queryClient.invalidate([queryKeys.settlements()]);
  };

  const runAction = useCallback(async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      invalidateSettlements();
    } catch (error) {
      setActionError(getErrorMessage(error, fallback));
    } finally {
      setBusy(false);
    }
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
      (item) => (item.building_level?.building_type?.id ?? 0) === DEFENCE_BUILDING_TYPE,
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

  return {
    cities,
    players: playersQuery.data ?? [],
    selectedId,
    selected,
    select: (city: MapCity) => {
      setActionError(null);
      setSelectedId(city.id);
    },
    clearSelection: () => {
      setActionError(null);
      setSelectedId(null);
    },
    busy,
    actionError,
    setOwner,
    buildFortress,
    upgradeFortress,
    isLoading: settlementsQuery.isLoading || regionsQuery.isLoading,
    isOffline: settlementsQuery.isOffline || regionsQuery.isOffline,
    updatedAt: settlementsQuery.updatedAt,
  };
};
