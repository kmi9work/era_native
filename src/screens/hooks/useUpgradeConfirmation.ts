import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getErrorMessage } from '../../data/apiErrors';
import { loadPlant, usePlant } from '../../data/hooks/usePlant';
import { ensurePlantLevels, getCachedPlantLevelsForType, usePlantLevels } from '../../data/hooks/usePlantLevels';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import { useMutation } from '../../data/useMutation';
import { BrotherPrinterService } from '../../services/BrotherPrinterService';
import ApiService from '../../services/api';
import { usePlantProcessingLogic } from './usePlantProcessingLogic';

/**
 * Хук для подтверждения улучшения предприятия.
 * Предприятие — ключ ['plant', id] (TTL 0, всегда свежее, фоновая перерисовка не мешает вводу),
 * стоимость уровня — из кэша ['plantLevels'], после upgrade/downgrade инвалидируются только
 * затронутые ключи (Д9/§ 5 правило 4).
 */
export interface UpgradeConfirmationState {
  plantInfo: any | null;
  upgradeCost: Record<string, number> | null;
  isMaxLevel: boolean;
  selectedPlantForUpgrade: any | null;
}

export function useUpgradeConfirmation(onComplete?: () => void) {
  const [state, setState] = useState<UpgradeConfirmationState>({
    plantInfo: null,
    upgradeCost: null,
    isMaxLevel: false,
    selectedPlantForUpgrade: null,
  });

  const [plantId, setPlantId] = useState<number | null>(null);
  const plantQuery = usePlant(plantId);
  usePlantLevels();

  const processing = usePlantProcessingLogic();
  const plantIdRef = useRef<number | null>(null);
  // Ссылка на изменяемые зависимости, чтобы loadPlantForUpgrade остался стабильным
  // (иначе эффект экрана с ним в deps зацикливается).
  const processingRef = useRef(processing);
  processingRef.current = processing;

  /** Собирает состояние карточки из свежих данных предприятия и справочника уровней. */
  const applyPlantData = useCallback((data: any) => {
    if (!data) return;
    const plantTypeId = data.plant_level?.plant_type?.id;
    const currentLevel = data.plant_level?.level || 1;

    const levels = plantTypeId ? getCachedPlantLevelsForType(plantTypeId) : [];
    const nextLevel = levels.find((l: any) => l.level === currentLevel + 1);

    setState({
      plantInfo: data,
      upgradeCost: nextLevel?.price || null,
      isMaxLevel: plantTypeId ? !nextLevel : false,
      selectedPlantForUpgrade: data,
    });
  }, []);

  // Экран обновляется сам, когда слой отдаёт новые данные (фокус, опрос, своя мутация).
  useEffect(() => {
    if (plantQuery.data) applyPlantData(plantQuery.data);
  }, [plantQuery.data, applyPlantData]);

  const loadPlantForUpgrade = useCallback(async (id: number) => {
    plantIdRef.current = id;
    setPlantId(id);

    try {
      await ensurePlantLevels();
      const data = await loadPlant(id);

      if (!data || !data.economic_subject_id) {
        Alert.alert('Ошибка', 'Не удалось загрузить данные предприятия');
        return;
      }

      if (!data.plant_level?.plant_type?.id) {
        Alert.alert('Ошибка', 'Не удалось определить тип предприятия');
        return;
      }

      applyPlantData(data);

      // Данные для расчёта переработки/добычи
      try {
        await processingRef.current.loadPlant(id);
      } catch (processingError) {
        console.error('[useUpgradeConfirmation] Processing load error:', processingError);
      }
    } catch (error: any) {
      Alert.alert('Ошибка', getErrorMessage(error, 'Не удалось загрузить данные предприятия'));
    }
  }, [applyPlantData]);

  const upgradeMutation = useMutation<[number], any>(
    (id: number) => ApiService.upgradePlant(id),
    {
      invalidate: (_result, id) => [queryKeys.plant(id), queryKeys.plantLevels()],
      invalidatePrefix: [['availablePlaces']],
      onError: (error) => Alert.alert('Ошибка', getErrorMessage(error)),
    },
  );

  const downgradeMutation = useMutation<[number], any>(
    (id: number) => ApiService.downgradePlant(id),
    {
      invalidate: (_result, id) => [queryKeys.plant(id), queryKeys.plantLevels()],
      invalidatePrefix: [['availablePlaces']],
      onError: (error) => Alert.alert('Ошибка', getErrorMessage(error)),
    },
  );

  const performUpgrade = useCallback(async (): Promise<boolean> => {
    const id = plantIdRef.current ?? state.selectedPlantForUpgrade?.id;
    if (!id) {
      Alert.alert('Ошибка', 'Предприятие не выбрано');
      return false;
    }

    const result = await upgradeMutation.mutate(id);
    if (!result) return false;

    Alert.alert('Успех', result.msg || 'Предприятие успешно улучшено!');

    // Уровень предприятия меняется во всех списках гильдий — инвалидируем по префиксу.
    queryClient.invalidatePrefix(['guild']);

    setState({
      plantInfo: null,
      upgradeCost: null,
      isMaxLevel: false,
      selectedPlantForUpgrade: null,
    });
    processing.reset();

    if (onComplete) onComplete();
    return true;
  }, [state.selectedPlantForUpgrade, upgradeMutation, processing, onComplete]);

  const performDowngrade = useCallback(async (): Promise<boolean> => {
    const id = plantIdRef.current ?? state.selectedPlantForUpgrade?.id;
    if (!id) {
      Alert.alert('Ошибка', 'Предприятие не выбрано');
      return false;
    }

    const result = await downgradeMutation.mutate(id);
    if (!result) return false;

    Alert.alert('Успех', result.msg || 'Уровень предприятия уменьшен!');
    queryClient.invalidatePrefix(['guild']);

    // Перезагружаем данные предприятия (свежие данные придут через слой)
    await loadPlantForUpgrade(id);
    return true;
  }, [state.selectedPlantForUpgrade, downgradeMutation, loadPlantForUpgrade]);

  const reprintBarcode = useCallback(async (
    plantIdArg?: number,
    guildName?: string,
    regionName?: string
  ): Promise<boolean> => {
    const idToUse = plantIdArg || state.selectedPlantForUpgrade?.id;
    const gName = guildName || state.selectedPlantForUpgrade?.economic_subject?.name || 'Неизвестная гильдия';
    let rName = regionName;
    if (!rName && state.selectedPlantForUpgrade?.plant_place) {
      rName = state.selectedPlantForUpgrade.plant_place.name ||
              state.selectedPlantForUpgrade.plant_place.region_name ||
              'Неизвестный регион';
    }
    if (!rName) rName = 'Неизвестный регион';

    if (!idToUse) {
      Alert.alert('Ошибка', 'Не удалось определить ID предприятия');
      return false;
    }

    const printResult = await BrotherPrinterService.printBarcode(idToUse, gName, rName);

    if (printResult.success) {
      Alert.alert('Успех', `Штрихкод успешно напечатан!\nID: ${idToUse}`);
      return true;
    } else {
      Alert.alert('Ошибка печати', printResult.error || 'Не удалось напечатать штрихкод');
      return false;
    }
  }, [state.selectedPlantForUpgrade]);

  const clearState = useCallback(() => {
    setState({
      plantInfo: null,
      upgradeCost: null,
      isMaxLevel: false,
      selectedPlantForUpgrade: null,
    });
    processing.reset();
  }, [processing]);

  return {
    state,
    processing,
    loadPlantForUpgrade,
    performUpgrade,
    performDowngrade,
    reprintBarcode,
    clearState,
    // Свежесть карточки предприятия и справочника уровней (для индикации мастеру)
    plantUpdatedAt: plantQuery.updatedAt,
    isOffline: plantQuery.isOffline,
  };
}
