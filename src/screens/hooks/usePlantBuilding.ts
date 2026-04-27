import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import ApiService from '../../services/api';
import { AvailablePlaceInfo, PlantLevel, PlantPlace } from '../../types';

/**
 * Хук для строительства новых предприятий.
 * Управляет загрузкой доступных мест, фильтрацией по категориям,
 * выбором типа предприятия, места и уровня.
 */
export interface PlantBuildingState {
  availablePlaces: AvailablePlaceInfo[];
  selectedPlantType: AvailablePlaceInfo | null;
  selectedPlace: PlantPlace | null;
  firstLevel: PlantLevel | null;
  loading: boolean;
}

export function usePlantBuilding() {
  const [state, setState] = useState<PlantBuildingState>({
    availablePlaces: [],
    selectedPlantType: null,
    selectedPlace: null,
    firstLevel: null,
    loading: false,
  });

  // Фильтр по категории
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);

  // Уникальные категории из availablePlaces
  const plantCategories = useMemo(() => {
    const seen = new Map<number, string>();
    state.availablePlaces.forEach(p => {
      if (p.plant_category_id != null && p.plant_category != null && !seen.has(p.plant_category_id)) {
        seen.set(p.plant_category_id, p.plant_category);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.availablePlaces]);

  const loadAvailablePlaces = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await ApiService.getAvailablePlaces();
      setState((prev) => ({ ...prev, availablePlaces: data, loading: false }));
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const getFilteredPlantTypes = useCallback(() => {
    const filtered = filterCategoryId == null
      ? state.availablePlaces
      : state.availablePlaces.filter(p => p.plant_category_id === filterCategoryId);

    return filtered.sort((a, b) => {
      const aAvailable = a.available_places.length > 0 ? 1 : 0;
      const bAvailable = b.available_places.length > 0 ? 1 : 0;
      return bAvailable - aAvailable;
    });
  }, [state.availablePlaces, filterCategoryId]);

  const selectPlantType = useCallback(async (plantTypeInfo: AvailablePlaceInfo) => {
    setState((prev) => ({ ...prev, selectedPlantType: plantTypeInfo, selectedPlace: null }));
    
    try {
      const levels = await ApiService.getPlantLevels(plantTypeInfo.plant_type_id);
      const first = levels.find((l: PlantLevel) => l.level === 1);
      
      setState((prev) => ({ ...prev, firstLevel: first || null }));
      
      // Если только одно доступное место — выбираем автоматически
      if (plantTypeInfo.available_places.length === 1) {
        setState((prev) => ({ ...prev, selectedPlace: plantTypeInfo.available_places[0] }));
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    }
  }, []);

  const selectPlace = useCallback((place: PlantPlace) => {
    setState((prev) => ({ ...prev, selectedPlace: place }));
  }, []);

  const reset = useCallback(() => {
    setState({
      availablePlaces: state.availablePlaces,
      selectedPlantType: null,
      selectedPlace: null,
      firstLevel: null,
      loading: false,
    });
    setFilterCategoryId(null);
  }, [state.availablePlaces]);

  const goBack = useCallback(() => {
    if (state.selectedPlace) {
      setState((prev) => ({ ...prev, selectedPlace: null }));
    } else if (state.selectedPlantType) {
      setState((prev) => ({
        ...prev,
        selectedPlantType: null,
        selectedPlace: null,
        firstLevel: null,
      }));
    }
  }, [state.selectedPlace, state.selectedPlantType]);

  return {
    state,
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
