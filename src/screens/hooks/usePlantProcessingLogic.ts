import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import ApiService from '../../services/api';
import { CONFIG } from '../../config';

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

const resArrayMult = (resArray: any[], n: number): any[] => {
  return resArray.map((res) => ({
    ...res,
    count: res.count * n,
  }));
};

const resArraySum = (array1: any[], array2: any[], sign: number = 1): any[] => {
  const arr2Copy = JSON.parse(JSON.stringify(array2));
  for (const res1 of array1) {
    for (let i = arr2Copy.length - 1; i >= 0; i--) {
      if (res1.identificator === arr2Copy[i].identificator) {
        res1.count += arr2Copy[i].count * sign;
        arr2Copy.splice(i, 1);
      }
    }
  }
  for (const res of arr2Copy) {
    array1.push({ ...res, count: res.count * sign });
  }
  return array1;
};

const isResArrayLess = (resArray1: any[], resArray2: any[]): boolean => {
  for (const res1 of resArray1) {
    const var2 = resArray2.find((res2: any) => res1.identificator === res2.identificator);
    if (!var2) return false;
    if (res1.count > var2.count) return false;
  }
  return true;
};

const countRequest = (
  formula: any,
  request: any[],
  way: string,
): { from: any[]; to: any[] } => {
  let n = 0;
  let bucket = JSON.parse(JSON.stringify(formula[way]));
  const formulaPart = formula[way];

  while (
    isResArrayLess(bucket, request) &&
    isResArrayLess(resArrayMult(formula.to, n + 1), formula.max_product)
  ) {
    bucket = resArraySum(bucket, JSON.parse(JSON.stringify(formulaPart)));
    n += 1;
  }

  const to = resArrayMult(formula.to, n);
  const from = resArrayMult(formula.from, n);

  return { from, to };
};

export interface PlantProcessingData {
  selectedPlant: any;
  isExtractive: boolean;
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
    formulaFrom: [],
    formulaTo: [],
    inputFrom: {},
    inputTo: {},
    resultFrom: [],
    resultTo: [],
    resultChange: [],
  });

  const [allPlantLevels, setAllPlantLevels] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [guilds, setGuilds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const initializedRef = useRef(false);
  const lastLoadedPlantIdRef = useRef<number | null>(null);
  const lastHandledBarcodeRef = useRef<string | null>(null);
  
  // Refs для хранения актуальных данных вместо замыкания
  const allPlantLevelsRef = useRef<any[]>([]);
  const guildsRef = useRef<any[]>([]);
  
  // Обновляем refs при изменении состояния
  useEffect(() => {
    allPlantLevelsRef.current = allPlantLevels;
  }, [allPlantLevels]);
  
  useEffect(() => {
    guildsRef.current = guilds;
  }, [guilds]);

  // Загрузка справочных данных
  const loadAllPlantLevels = useCallback(async () => {
    try {
      const data = await ApiService.getAllPlantLevels();
      setAllPlantLevels(data);
    } catch (error: any) {
      // ignore
    }
  }, []);

  const loadResources = useCallback(async () => {
    try {
      const data = await ApiService.getAllResources();
      setResources(data);
    } catch (error: any) {
      // ignore
    }
  }, []);

  const loadGuilds = useCallback(async () => {
    try {
      const data = await ApiService.getGuilds();
      const sortedData = data.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setGuilds(sortedData);
    } catch (error: any) {
      // ignore
    }
  }, []);

  // Инициализация всех справочных данных
  const initialize = useCallback(async () => {
    await Promise.all([loadAllPlantLevels(), loadResources(), loadGuilds()]);
  }, [loadAllPlantLevels, loadResources, loadGuilds]);

  const getIsExtractive = useCallback((plant: any): boolean => {
    return plant?.plant_level?.plant_type?.plant_category?.is_extractive || false;
  }, []);

  const getResourceInfo = useCallback(
    (identificator: string) => {
      const resource = resources.find((r) => r.identificator === identificator);
      const configuredBase = (CONFIG.BACKEND_URL || '').replace(/\/+$/, '').replace(/\/backend$/i, '');
      const baseURL = configuredBase || ApiService['api'].defaults.baseURL || 'http://192.168.1.101:3000';
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

  const fetchPlantDetails = useCallback(
    async (plantId: number, plantLevelsData: any[] = allPlantLevelsRef.current, guildsData: any[] = guildsRef.current) => {
      const data = await ApiService.getPlant(plantId);

      if (!data.plant_level) {
        throw new Error('У предприятия нет уровня');
      }

      const currentLevel = data.plant_level.level;
      const plantTypeId = data.plant_level?.plant_type?.id;
      
      if (!plantTypeId) {
        throw new Error('Не удалось определить тип предприятия');
      }
      
      // Всегда загружаем СВЕЖИЕ данные уровня предприятия через API
      const allLevels = await ApiService.getPlantLevels(plantTypeId);
      const fullPlantLevel = allLevels.find((pl: any) => pl.level === currentLevel);
      
      if (!fullPlantLevel) {
        throw new Error(`Уровень ${currentLevel} для типа предприятия не найден`);
      }

      const isExtractive = getIsExtractive(data);
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
      if (isLoading) {
        return;
      }

      setIsLoading(true);

      try {
        // Инициализируем данные если ещё не загружены
        if (!initializedRef.current) {
          initializedRef.current = true;
          await initialize();
        }
        
        // Загружаем данные гильдий для определения режима
        let guildsData = guildsRef.current;
        if (guildsData.length === 0) {
          await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
          guildsData = guildsRef.current;
        }

        const details = await fetchPlantDetails(plantId, [], guildsData);

        setState({
          selectedPlant: details.plant,
          isExtractive: details.isExtractive,
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
        Alert.alert('Ошибка', error.message || 'Не удалось загрузить данные предприятия');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPlantDetails, initialize, isLoading],
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

  const calculateFrom = useCallback(() => {
    if (!state.selectedPlant?.plant_level?.formulas?.length) return;

    const inputValues: Record<string, number> = {};
    for (const key of Object.keys(state.inputFrom)) {
      const val = parseFloat(state.inputFrom[key]);
      inputValues[key] = isNaN(val) ? 0 : val;
    }

    const targetArray = Object.entries(inputValues)
      .filter(([, v]) => v > 0)
      .map(([identificator, count]) => {
        const res = state.formulaFrom.find((r: any) => r.identificator === identificator);
        return { identificator, count, name: res?.name || identificator };
      });

    if (targetArray.length === 0) return;

    let totalFrom: any[] = [];
    let totalTo: any[] = [];

    for (const formula of state.selectedPlant.plant_level.formulas) {
      const hasMatchingInput = formula.from?.some((f: any) =>
        targetArray.some((t) => t.identificator === f.identificator)
      );
      if (!hasMatchingInput) continue;

      const result = countRequest(formula, targetArray, 'from');
      totalFrom = resArraySum(totalFrom, result.from);
      totalTo = resArraySum(totalTo, result.to);
    }

    const resultChange = resArraySum(
      JSON.parse(JSON.stringify(totalTo)),
      totalFrom,
      -1,
    );

    setState((prev) => ({
      ...prev,
      resultFrom: normalizeResourceArray(totalFrom),
      resultTo: normalizeResourceArray(totalTo),
      resultChange: normalizeResourceArray(resultChange),
    }));
  }, [state.selectedPlant, state.inputFrom, state.formulaFrom]);

  const calculateTo = useCallback(() => {
    if (!state.selectedPlant?.plant_level?.formulas?.length) return;

    const inputValues: Record<string, number> = {};
    for (const key of Object.keys(state.inputTo)) {
      const val = parseFloat(state.inputTo[key]);
      inputValues[key] = isNaN(val) ? 0 : val;
    }

    const targetArray = Object.entries(inputValues)
      .filter(([, v]) => v > 0)
      .map(([identificator, count]) => {
        const res = state.formulaTo.find((r: any) => r.identificator === identificator);
        return { identificator, count, name: res?.name || identificator };
      });

    if (targetArray.length === 0) return;

    let totalFrom: any[] = [];
    let totalTo: any[] = [];

    for (const formula of state.selectedPlant.plant_level.formulas) {
      const hasMatchingOutput = formula.to?.some((f: any) =>
        targetArray.some((t) => t.identificator === f.identificator)
      );
      if (!hasMatchingOutput) continue;

      const result = countRequest(formula, targetArray, 'to');
      totalFrom = resArraySum(totalFrom, result.from);
      totalTo = resArraySum(totalTo, result.to);
    }

    const resultChange = resArraySum(
      JSON.parse(JSON.stringify(totalTo)),
      totalFrom,
      -1,
    );

    setState((prev) => ({
      ...prev,
      resultFrom: normalizeResourceArray(totalFrom),
      resultTo: normalizeResourceArray(totalTo),
      resultChange: normalizeResourceArray(resultChange),
    }));
  }, [state.selectedPlant, state.inputTo, state.formulaTo]);

  const normalizeResourceArray = useCallback((array: any[] = []): any[] => {
    return array.filter((item) => item && typeof item.count === 'number' && item.count !== 0);
  }, []);

  const reset = useCallback(() => {
    setState({
      selectedPlant: state.selectedPlant,
      isExtractive: state.isExtractive,
      formulaFrom: state.formulaFrom,
      formulaTo: state.formulaTo,
      inputFrom: {},
      inputTo: {},
      resultFrom: [],
      resultTo: [],
      resultChange: [],
    });
    // Восстанавливаем пустые объекты по умолчанию
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
      formulaFrom: state.formulaFrom,
      formulaTo: state.formulaTo,
      inputFrom: defaultInputFrom,
      inputTo: defaultInputTo,
      resultFrom: [],
      resultTo: [],
      resultChange: [],
    });
  }, [state.selectedPlant, state.isExtractive, state.formulaFrom, state.formulaTo]);

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
  };
};
