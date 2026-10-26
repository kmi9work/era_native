import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getErrorMessage } from '../../data/apiErrors';
import { useAvailablePlaces } from '../../data/hooks/useAvailablePlaces';
import { ensurePlantLevels, getCachedPlantLevelsForType, usePlantLevels } from '../../data/hooks/usePlantLevels';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import { AvailablePlaceInfo, PlantLevel, PlantPlace } from '../../types';

/**
 * Хук для строительства новых предприятий.
 * Доступные места — ключ ['availablePlaces', guildId] (TTL 60 с, refetch-on-focus):
 * гильдия уходит параметром запроса, потому что признак `allowed` (разрешение
 * гильдии строить и работать в государстве места) считается по ней.
 * Уровни по типу — выборка из кэша ключа ['plantLevels'] без повторного запроса.
 */
export interface PlantBuildingState {
  availablePlaces: AvailablePlaceInfo[];
  selectedPlantType: AvailablePlaceInfo | null;
  selectedPlace: PlantPlace | null;
  firstLevel: PlantLevel | null;
  loading: boolean;
}

export function usePlantBuilding(guildId?: number | null) {
  const placesQuery = useAvailablePlaces(guildId);
  const levelsQuery = usePlantLevels();

  const [selection, setSelection] = useState<{
    selectedPlantType: AvailablePlaceInfo | null;
    selectedPlace: PlantPlace | null;
    firstLevel: PlantLevel | null;
  }>({
    selectedPlantType: null,
    selectedPlace: null,
    firstLevel: null,
  });

  // Фильтр по категории
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);

  const availablePlaces = useMemo(
    () => ((placesQuery.data as AvailablePlaceInfo[]) ?? []),
    [placesQuery.data],
  );

  // Уникальные категории из availablePlaces
  const plantCategories = useMemo(() => {
    const seen = new Map<number, string>();
    availablePlaces.forEach(p => {
      if (p.plant_category_id != null && p.plant_category != null && !seen.has(p.plant_category_id)) {
        seen.set(p.plant_category_id, p.plant_category);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [availablePlaces]);

  /** Ручное обновление списка мест (pull-to-refresh). */
  const loadAvailablePlaces = useCallback(
    () => queryClient.refetch([queryKeys.availablePlaces(guildId)], { force: true }),
    [guildId],
  );

  const getFilteredPlantTypes = useCallback(() => {
    const filtered = filterCategoryId == null
      ? availablePlaces
      : availablePlaces.filter(p => p.plant_category_id === filterCategoryId);

    return [...filtered].sort((a, b) => {
      const aAvailable = a.available_places.length > 0 ? 1 : 0;
      const bAvailable = b.available_places.length > 0 ? 1 : 0;
      return bAvailable - aAvailable;
    });
  }, [availablePlaces, filterCategoryId]);

  const selectPlantType = useCallback(async (plantTypeInfo: AvailablePlaceInfo): Promise<PlantLevel | null> => {
    setSelection({ selectedPlantType: plantTypeInfo, selectedPlace: null, firstLevel: null });

    try {
      await ensurePlantLevels();
      const levels = getCachedPlantLevelsForType(plantTypeInfo.plant_type_id);
      const first = levels.find((l: PlantLevel) => l.level === 1) || null;

      setSelection(prev => ({
        ...prev,
        firstLevel: first,
        // Если только одно доступное место — выбираем автоматически
        selectedPlace: plantTypeInfo.available_places.length === 1 ? plantTypeInfo.available_places[0] : null,
      }));

      return first;
    } catch (error: any) {
      Alert.alert('Ошибка', getErrorMessage(error));
      return null;
    }
  }, []);

  const selectPlace = useCallback((place: PlantPlace) => {
    setSelection(prev => ({ ...prev, selectedPlace: place }));
  }, []);

  const reset = useCallback(() => {
    setSelection({ selectedPlantType: null, selectedPlace: null, firstLevel: null });
    setFilterCategoryId(null);
  }, []);

  const goBack = useCallback(() => {
    setSelection(prev => {
      if (prev.selectedPlace) return { ...prev, selectedPlace: null };
      if (prev.selectedPlantType) {
        return { selectedPlantType: null, selectedPlace: null, firstLevel: null };
      }
      return prev;
    });
  }, []);

  return {
    state: {
      availablePlaces,
      selectedPlantType: selection.selectedPlantType,
      selectedPlace: selection.selectedPlace,
      firstLevel: selection.firstLevel,
      loading: placesQuery.isLoading,
      refreshing: placesQuery.isFetching,
      isOffline: placesQuery.isOffline,
      updatedAt: placesQuery.updatedAt,
      levelsUpdatedAt: levelsQuery.updatedAt,
    },
    filterCategoryId,
    setFilterCategoryId,
    plantCategories,
    getFilteredPlantTypes,
    loadAvailablePlaces,
    selectPlantType,
    selectPlace,
    reset,
    goBack,
  };
}
