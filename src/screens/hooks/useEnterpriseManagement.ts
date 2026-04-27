import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import ApiService from '../../services/api';

/**
 * Хук для управления предприятиями гильдии.
 * Загружает список предприятий, управляет выбором и удалением.
 */
export interface EnterpriseData {
  id: number;
  plant_level_id: number;
  plant_place_id: number;
  economic_subject_id: number;
  economic_subject_type: string;
  plant_level?: {
    level: number;
    plant_type?: {
      id: number;
      name: string;
    };
    formulas?: any[];
  };
  plant_place?: {
    name: string;
    region_name: string;
  };
  economic_subject?: any;
}

export interface EnterpriseManagementState {
  guildPlants: EnterpriseData[];
  selectedPlant: EnterpriseData | null;
  loading: boolean;
}

export function useEnterpriseManagement() {
  const [state, setState] = useState<EnterpriseManagementState>({
    guildPlants: [],
    selectedPlant: null,
    loading: false,
  });

  const loadGuildPlants = useCallback(async (guildId: number) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const plants = await ApiService.getGuildPlants(guildId);
      const sortedPlants = plants.sort((a, b) => (a.id || 0) - (b.id || 0));
      setState((prev) => ({ ...prev, guildPlants: sortedPlants, loading: false }));
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
      setState((prev) => ({ ...prev, guildPlants: [], loading: false }));
    }
  }, []);

  const selectPlant = useCallback((plant: EnterpriseData) => {
    setState((prev) => ({ ...prev, selectedPlant: plant }));
  }, []);

  const clearSelectedPlant = useCallback(() => {
    setState((prev) => ({ ...prev, selectedPlant: null }));
  }, []);

  const deletePlant = useCallback(async (plant: EnterpriseData): Promise<boolean> => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await ApiService.deletePlant(plant.id);
      // Возвращаем true для успеха — вызывающий код обновит список
      setState((prev) => ({ ...prev, loading: false }));
      return true;
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось удалить предприятие');
      setState((prev) => ({ ...prev, loading: false }));
      return false;
    }
  }, []);

  return {
    state,
    loadGuildPlants,
    selectPlant,
    clearSelectedPlant,
    deletePlant,
  };
}
