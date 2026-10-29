import { useState, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { getErrorMessage } from '../../data/apiErrors';
import { ensurePlantLevels, getCachedPlantLevelsForType, usePlantLevels } from '../../data/hooks/usePlantLevels';
import { loadPlant as loadPlantFromLayer } from '../../data/hooks/usePlant';
import { useResources } from '../../data/hooks/useResources';
import { useGuilds } from '../../data/hooks/useGuilds';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import ApiService from '../../services/api';
import { CONFIG } from '../../config';
import { feedToPlant, techSchoolsOpenForPlant } from '../../services/plantProduction';

// Все уникальные входные ресурсы из всех формул
const deriveFormulaFrom = (formulas: any[]): any[] => {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const f of (formulas || [])) {
    for (const item of (f.from || [])) {
      if (!seen.has(item.identificator)) {
        seen.add(item.identificator);
        result.push(item);
      }
    }
  }
  return result;
};

// Все уникальные выходные ресурсы из всех формул
const deriveFormulaTo = (formulas: any[]): any[] => {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const f of (formulas || [])) {
    for (const item of (f.to || [])) {
      if (!seen.has(item.identificator)) {
        seen.add(item.identificator);
        result.push(item);
      }
    }
  }
  return result;
};

export interface PlantProcessingData {
  selectedPlant: any;
  isExtractive: boolean;
  /** Технология «Технические училища» открыта — влияет на расчёт переработки. */
  techSchoolsOpen: boolean;
  formulaFrom: any[];
  formulaTo: any[];
  inputFrom: Record<string, string>;
  inputTo: Record<string, string>;
  resultFrom: any[];
  resultTo: any[];
  resultChange: any[];
}

export const usePlantProcessingLogic = () => {
  const [state, setState] = useState<PlantProcessingData>({
    selectedPlant: null,
    isExtractive: false,
    techSchoolsOpen: false,
    formulaFrom: [],
    formulaTo: [],
    inputFrom: {},
    inputTo: {},
    resultFrom: [],
    resultTo: [],
    resultChange: [],
  });

  // Справочники живут в слое данных: TTL, опрос и дедупликация — там же.
  const levelsQuery = usePlantLevels();
  const resourcesQuery = useResources();
  useGuilds();

  const resources = useMemo(() => (resourcesQuery.data as any[]) ?? [], [resourcesQuery.data]);
  const [, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);

  const getIsExtractive = useCallback((plant: any): boolean => {
    return plant?.plant_level?.plant_type?.plant_category?.is_extractive || false;
  }, []);

  const getResourceInfo = useCallback(
    (identificator: string) => {
      const resource = resources.find((r) => r.identificator === identificator);
      const configuredBase = (CONFIG.BACKEND_URL || '').replace(/\/+$/, '').replace(/\/backend$/i, '');
      const baseURL = configuredBase || ApiService.getBaseUrl();
      return {
        name: resource?.name || identificator,
        imageUrl: `${baseURL}/images/resources/${identificator}.png`,
      };
    },
    [resources],
  );

  const getMaxResourceCount = useCallback(
    (resource: any, isFrom: boolean) => {
      if (!state.selectedPlant?.plant_level?.formulas) return 0;
      const formulas = state.selectedPlant.plant_level.formulas;
      let maxCount = 0;

      if (isFrom) {
        formulas.forEach((formula: any) => {
          const resourceItem = formula.from?.find((r: any) => r.identificator === resource.identificator);
          if (resourceItem && resourceItem.count && formula.max_product && Array.isArray(formula.max_product)) {
            const maxProductItem = formula.max_product[0];
            if (maxProductItem && maxProductItem.count) {
              const toItem = formula.to?.find((t: any) => t.identificator === maxProductItem.identificator);
              if (toItem && toItem.count) {
                const contribution = (resourceItem.count * maxProductItem.count) / toItem.count;
                maxCount += contribution;
              }
            }
          }
        });
      } else {
        formulas.forEach((formula: any) => {
          const resourceItem = formula.to?.find((r: any) => r.identificator === resource.identificator);
          if (resourceItem && formula.max_product && Array.isArray(formula.max_product)) {
            const maxProductItem = formula.max_product.find(
              (mp: any) => mp.identificator === resource.identificator,
            );
            if (maxProductItem && maxProductItem.count) {
              maxCount = Math.max(maxCount, Math.floor(maxProductItem.count));
            }
          }
        });
      }
      return Math.floor(maxCount);
    },
    [state.selectedPlant],
  );

  /**
   * Свежие данные предприятия + формулы его уровня.
   * Предприятие — ключ ['plant', id] с TTL 0 (всегда свежее), уровни — из кэша ['plantLevels].
   */
  const fetchPlantDetails = useCallback(
    async (plantId: number) => {
      const data = await loadPlantFromLayer(plantId);

      if (!data.plant_level) {
        throw new Error('У предприятия нет уровня');
      }

      const currentLevel = data.plant_level.level;
      const plantTypeId = data.plant_level?.plant_type?.id;

      if (!plantTypeId) {
        throw new Error('Не удалось определить тип предприятия');
      }

      // Справочник уровней: один запрос на всех (дедупликация в слое), выборка по типу — из кэша.
      await ensurePlantLevels();
      const allLevels = getCachedPlantLevelsForType(plantTypeId);
      const fullPlantLevel = allLevels.find((pl: any) => pl.level === currentLevel);

      if (!fullPlantLevel) {
        throw new Error(`Уровень ${currentLevel} для типа предприятия не найден`);
      }

      const isExtractive = getIsExtractive(data);
      // «Технические училища» — по государству ЗЕМЕЛЬ предприятия (признак из ответа
      // предприятия, приоритетнее глобального справочника уровней) и только для
      // перерабатывающих: добывающим бонус не прибавляется и плашка не показывается.
      const techSchoolsOpen = !isExtractive && techSchoolsOpenForPlant(data, fullPlantLevel);

      // Список гильдий тоже берём из слоя, а не из локальной копии.
      if (queryClient.getQueryData(queryKeys.guilds()) === undefined) {
        await queryClient.refetch([queryKeys.guilds()], { force: true });
      }
      const guildsData = (queryClient.getQueryData<any[]>(queryKeys.guilds()) ?? []);
      const guild = data.economic_subject_id
        ? guildsData.find((g: any) => g.id === data.economic_subject_id) || null
        : null;

      let formulaFromData: any[] = [];
      let formulaToData: any[] = deriveFormulaTo(fullPlantLevel.formulas);

      if (isExtractive) {
        formulaFromData = [];
      } else {
        if (!fullPlantLevel.formulas || fullPlantLevel.formulas.length === 0) {
          throw new Error('У предприятия нет формул переработки');
        }
        formulaFromData = deriveFormulaFrom(fullPlantLevel.formulas);
        formulaToData = deriveFormulaTo(fullPlantLevel.formulas);
      }

      const defaultInputFrom: Record<string, string> = {};
      const defaultInputTo: Record<string, string> = {};

      (formulaFromData || []).forEach((item: any) => {
        if (item?.identificator) {
          defaultInputFrom[item.identificator] = '';
        }
      });

      (formulaToData || []).forEach((item: any) => {
        if (item?.identificator) {
          defaultInputTo[item.identificator] = '';
        }
      });

      return {
        plant: {
          ...data,
          plant_level: {
            ...data.plant_level,
            formulas: fullPlantLevel.formulas,
          },
        },
        guild,
        isExtractive,
        techSchoolsOpen,
        formulaFrom: formulaFromData || [],
        formulaTo: formulaToData || [],
        defaultInputFrom,
        defaultInputTo,
        fullPlantLevel,
      };
    },
    [getIsExtractive],
  );

  const loadPlant = useCallback(
    async (plantId: number) => {
      // Предотвращаем ТОЛЬКО параллельные вызовы, но разрешаем повторную загрузку
      if (isLoadingRef.current) {
        return;
      }

      isLoadingRef.current = true;
      setIsLoading(true);

      try {
        const details = await fetchPlantDetails(plantId);

        setState({
          selectedPlant: details.plant,
          isExtractive: details.isExtractive,
          techSchoolsOpen: details.techSchoolsOpen,
          formulaFrom: details.formulaFrom,
          formulaTo: details.formulaTo,
          inputFrom: details.defaultInputFrom,
          inputTo: details.defaultInputTo,
          resultFrom: [],
          resultTo: [],
          resultChange: [],
        });
      } catch (error: any) {
        console.error('[usePlantProcessingLogic] Error loading plant:', error);
        Alert.alert('Ошибка', getErrorMessage(error, 'Не удалось загрузить данные предприятия'));
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [fetchPlantDetails],
  );

  const setInputFromValue = useCallback((key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      inputFrom: { ...prev.inputFrom, [key]: value },
    }));
  }, []);

  const setInputToValue = useCallback((key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      inputTo: { ...prev.inputTo, [key]: value },
    }));
  }, []);

  const normalizeResourceArray = useCallback((array: any[] = []): any[] => {
    return array.filter((item) => item && typeof item.count === 'number' && item.count !== 0);
  }, []);

  const calculateFrom = useCallback(() => {
    const formulas = state.selectedPlant?.plant_level?.formulas;
    if (!formulas?.length) return;

    const targetArray = Object.keys(state.inputFrom)
      .map((identificator) => ({
        identificator,
        count: parseFloat(state.inputFrom[identificator]),
        name:
          state.formulaFrom.find((r: any) => r.identificator === identificator)?.name || identificator,
      }))
      .filter((item) => Number.isFinite(item.count) && item.count > 0);

    if (targetArray.length === 0) return;

    // Единый расчёт (с эффектом «Технических училищ») — src/services/plantProduction.ts
    const { from, to, change } = feedToPlant(formulas, targetArray, 'from', {
      techSchoolsOpen: state.techSchoolsOpen,
    });

    setState((prev) => ({
      ...prev,
      resultFrom: normalizeResourceArray(from),
      resultTo: normalizeResourceArray(to),
      resultChange: normalizeResourceArray(change),
    }));
  }, [
    state.selectedPlant,
    state.inputFrom,
    state.formulaFrom,
    state.techSchoolsOpen,
    normalizeResourceArray,
  ]);

  const calculateTo = useCallback(() => {
    const formulas = state.selectedPlant?.plant_level?.formulas;
    if (!formulas?.length) return;

    const targetArray = Object.keys(state.inputTo)
      .map((identificator) => ({
        identificator,
        count: parseFloat(state.inputTo[identificator]),
        name:
          state.formulaTo.find((r: any) => r.identificator === identificator)?.name || identificator,
      }))
      .filter((item) => Number.isFinite(item.count) && item.count > 0);

    if (targetArray.length === 0) return;

    const { from, to, change } = feedToPlant(formulas, targetArray, 'to', {
      techSchoolsOpen: state.techSchoolsOpen,
    });

    setState((prev) => ({
      ...prev,
      resultFrom: normalizeResourceArray(from),
      resultTo: normalizeResourceArray(to),
      resultChange: normalizeResourceArray(change),
    }));
  }, [
    state.selectedPlant,
    state.inputTo,
    state.formulaTo,
    state.techSchoolsOpen,
    normalizeResourceArray,
  ]);

  const reset = useCallback(() => {
    const defaultInputFrom: Record<string, string> = {};
    const defaultInputTo: Record<string, string> = {};
    state.formulaFrom.forEach((item: any) => {
      if (item?.identificator) {
        defaultInputFrom[item.identificator] = '';
      }
    });
    state.formulaTo.forEach((item: any) => {
      if (item?.identificator) {
        defaultInputTo[item.identificator] = '';
      }
    });
    setState({
      selectedPlant: state.selectedPlant,
      isExtractive: state.isExtractive,
      techSchoolsOpen: state.techSchoolsOpen,
      formulaFrom: state.formulaFrom,
      formulaTo: state.formulaTo,
      inputFrom: defaultInputFrom,
      inputTo: defaultInputTo,
      resultFrom: [],
      resultTo: [],
      resultChange: [],
    });
  }, [state.selectedPlant, state.isExtractive, state.techSchoolsOpen, state.formulaFrom, state.formulaTo]);

  return {
    state,
    loadPlant,
    setInputFromValue,
    setInputToValue,
    calculateFrom,
    calculateTo,
    reset,
    getResourceInfo,
    getMaxResourceCount,
    // Свежесть справочников — для индикации мастеру (Д7/§5).
    levelsUpdatedAt: levelsQuery.updatedAt,
    levelsIsStale: levelsQuery.isStale,
    resourcesUpdatedAt: resourcesQuery.updatedAt,
  };
};
