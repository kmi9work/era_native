import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getErrorMessage } from '../../data/apiErrors';
import { useGuildPlants } from '../../data/hooks/useGuildPlants';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import { useMutation } from '../../data/useMutation';
import ApiService from '../../services/api';

/**
 * Хук для управления предприятиями гильдии.
 * id гильдии приходит с экрана (параметры маршрута) и сразу становится ключом слоя
 * (['guild', id, 'plants']): TTL 15 с, опрос 30 с в фокусе, после удаления инвалидируются
 * только затронутые ключи.
 * id обязателен именно здесь: если экран держит один ключ, а хук грузит другой
 * (`guild:<id>` против `guild:none`), обновление уходит в ключ без подписчика и на экране
 * загорается «нет связи» при рабочем соединении.
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
  /** идёт любое обновление списка (в том числе фоновое) */
  refreshing: boolean;
  /** нет связи — показаны последние полученные данные */
  isOffline: boolean;
  /** данные устарели по TTL/инвалидации */
  isStale: boolean;
  updatedAt: number | undefined;
  error: unknown;
}

export function useEnterpriseManagement(guildId: number | null | undefined) {
  const [selectedPlant, setSelectedPlant] = useState<EnterpriseData | null>(null);

  const query = useGuildPlants(guildId);

  const guildPlants = useMemo(
    () => [...((query.data as EnterpriseData[]) ?? [])].sort((a, b) => (a.id || 0) - (b.id || 0)),
    [query.data],
  );

  /** Ручное обновление (pull-to-refresh): принудительно перечитывает ключ этой гильдии. */
  const loadGuildPlants = useCallback(async (id: number) => {
    await queryClient.refetch([queryKeys.guildPlants(id)], { force: true });
  }, []);

  const deletion = useMutation<[EnterpriseData], true>(
    async (plant: EnterpriseData) => {
      await ApiService.deletePlant(plant.id);
      return true as const;
    },
    {
      // Мутация не перезагружает всё: освободившееся место в списке доступных.
      invalidatePrefix: [['availablePlaces']],
      onError: (error) => Alert.alert('Ошибка', getErrorMessage(error, 'Не удалось удалить предприятие')),
    },
  );

  const deletePlant = useCallback(
    async (plant: EnterpriseData): Promise<boolean> => {
      const success = await deletion.mutate(plant);
      if (!success) return false;
      // Список предприятий гильдии помечается устаревшим и обновляется, если на него есть подписчик.
      queryClient.invalidatePrefix(['guild']);
      return true;
    },
    [deletion],
  );

  const selectPlant = useCallback((plant: EnterpriseData) => {
    setSelectedPlant(plant);
  }, []);

  const clearSelectedPlant = useCallback(() => {
    setSelectedPlant(null);
  }, []);

  return {
    state: {
      guildPlants,
      selectedPlant,
      loading: query.isLoading,
      refreshing: query.isFetching,
      isOffline: query.isOffline,
      isStale: query.isStale,
      updatedAt: query.updatedAt,
      error: query.error,
    },
    loadGuildPlants,
    selectPlant,
    clearSelectedPlant,
    deletePlant,
  };
}
