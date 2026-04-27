import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import ApiService from '../../services/api';
import { BrotherPrinterService } from '../../services/BrotherPrinterService';
import { usePlantProcessingLogic } from './usePlantProcessingLogic';

/**
 * Хук для подтверждения улучшения предприятия.
 * Загружает данные предприятия, стоимость улучшения,
 * выполняет улучшение и перепечатку штрихкода.
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

  const processing = usePlantProcessingLogic();

  const loadPlantForUpgrade = useCallback(async (plantId: number) => {
    try {
      const data = await ApiService.getPlant(plantId);
      
      if (!data || !data.economic_subject_id) {
        Alert.alert('Ошибка', 'Не удалось загрузить данные предприятия');
        return;
      }

      const plantTypeId = data.plant_level?.plant_type?.id;
      const currentLevel = data.plant_level?.level || 1;

      if (!plantTypeId) {
        Alert.alert('Ошибка', 'Не удалось определить тип предприятия');
        return;
      }

      const levels = await ApiService.getPlantLevels(plantTypeId);
      const nextLevel = levels.find((l: any) => l.level === currentLevel + 1);

      setState({
        plantInfo: data,
        upgradeCost: nextLevel?.price || null,
        isMaxLevel: !nextLevel,
        selectedPlantForUpgrade: data,
      });

      // Загружаем данные для расчёта переработки/добычи
      try {
        await processing.loadPlant(plantId);
      } catch (processingError) {
        console.error('[useUpgradeConfirmation] Processing load error:', processingError);
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось загрузить данные предприятия');
    }
  }, [processing]);

  const performUpgrade = useCallback(async (): Promise<boolean> => {
    if (!state.selectedPlantForUpgrade?.id) {
      Alert.alert('Ошибка', 'Предприятие не выбрано');
      return false;
    }

    try {
      const result = await ApiService.upgradePlant(state.selectedPlantForUpgrade.id);
      Alert.alert('Успех', result.msg || 'Предприятие успешно улучшено!');
      
      // Сброс состояния
      setState({
        plantInfo: null,
        upgradeCost: null,
        isMaxLevel: false,
        selectedPlantForUpgrade: null,
      });
      processing.reset();

      if (onComplete) {
        onComplete();
      }
      return true;
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
      return false;
    }
  }, [state.selectedPlantForUpgrade, onComplete, processing]);

  const reprintBarcode = useCallback(async (
    plantId?: number,
    guildName?: string,
    regionName?: string
  ): Promise<boolean> => {
    const idToUse = plantId || state.selectedPlantForUpgrade?.id;
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
    reprintBarcode,
    clearState,
  };
}
