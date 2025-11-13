import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import ApiService from '../../services/api';
import { useBarcodeScannerContext } from '../../context/BarcodeScannerContext';

type Step = 'guild' | 'plant' | 'processing' | 'multi';

interface MultiEntry {
  plantId: number;
  plant: any;
  guild: any | null;
  isExtractive: boolean;
  formulaFrom: any[];
  formulaTo: any[];
  inputFrom: Record<string, string>;
  inputTo: Record<string, string>;
  resultFrom: any[];
  resultTo: any[];
  resultChange: any[];
  fullPlantLevel: any;
}

interface MultiTotals {
  resultFrom: any[];
  resultTo: any[];
  resultChange: any[];
}

export const useProcessingScreenLogic = (onClose: () => void) => {
  const [step, setStep] = useState<Step>('guild');
  const [loading, setLoading] = useState(false);

  const [guilds, setGuilds] = useState<any[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<any>(null);

  const [guildPlants, setGuildPlants] = useState<any[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<any>(null);

  const [formulaFrom, setFormulaFrom] = useState<any[]>([]);
  const [formulaTo, setFormulaTo] = useState<any[]>([]);

  const [inputFrom, setInputFrom] = useState<{ [key: string]: string }>({});
  const [inputTo, setInputTo] = useState<{ [key: string]: string }>({});

  const [resultTo, setResultTo] = useState<any[]>([]);
  const [resultFrom, setResultFrom] = useState<any[]>([]);
  const [resultChange, setResultChange] = useState<any[]>([]);

  const [multiEntries, setMultiEntries] = useState<MultiEntry[]>([]);
  const [multiTotals, setMultiTotals] = useState<MultiTotals>({
    resultFrom: [],
    resultTo: [],
    resultChange: [],
  });

  const [allPlantLevels, setAllPlantLevels] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [activeEffects, setActiveEffects] = useState<any[]>([]);

  const { addListener } = useBarcodeScannerContext();
  const lastHandledBarcodeRef = useRef<string | null>(null);

  const loadAllPlantLevels = useCallback(async () => {
    try {
      const data = await ApiService.getAllPlantLevels();
      setAllPlantLevels(data);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось загрузить уровни предприятий');
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

  const loadActiveEffects = useCallback(async () => {
    try {
      const data = await (ApiService as any).getActiveGuildEffects();
      setActiveEffects(data);
    } catch (error: any) {
      // ignore
    }
  }, []);

  const normalizeGuildReference = useCallback((guild: any) => {
    if (!guild) {
      return { id: null, name: null };
    }

    if (typeof guild === 'object') {
      const rawId = guild.id ?? guild.guild_id ?? guild.economic_subject_id ?? guild.value_id ?? guild.target_id;
      const id =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string' && /^\d+$/.test(rawId.trim())
          ? parseInt(rawId, 10)
          : null;
      const rawName = guild.name ?? guild.label ?? guild.title ?? guild.value ?? guild.display;

      return {
        id,
        name: typeof rawName === 'string' ? rawName : null,
      };
    }

    if (typeof guild === 'number' && Number.isFinite(guild)) {
      return { id: guild, name: null };
    }

    if (typeof guild === 'string') {
      const trimmed = guild.trim();
      if (/^\d+$/.test(trimmed)) {
        return { id: parseInt(trimmed, 10), name: null };
      }
      return { id: null, name: trimmed };
    }

    return { id: null, name: String(guild) };
  }, []);

  const extractTargetId = useCallback((target: any): number | null => {
    if (!target) return null;

    if (typeof target === 'object') {
      const rawId = target.id ?? target.guild_id ?? target.value_id ?? target.target_id ?? target.raw_id ?? target.value;
      if (typeof rawId === 'number' && Number.isFinite(rawId)) {
        return rawId;
      }
      if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) {
        return parseInt(rawId, 10);
      }
      return null;
    }

    if (typeof target === 'number' && Number.isFinite(target)) {
      return target;
    }

    if (typeof target === 'string' && /^\d+$/.test(target.trim())) {
      return parseInt(target, 10);
    }

    return null;
  }, []);

  const extractTargetName = useCallback((target: any): string | null => {
    if (!target) return null;

    if (typeof target === 'object') {
      const rawName = target.name ?? target.label ?? target.value ?? target.display ?? target.raw;
      if (typeof rawName === 'string' && rawName.trim().length > 0 && !/^\d+$/.test(rawName.trim())) {
        return rawName;
      }
      return null;
    }

    if (typeof target === 'string' && target.trim().length > 0 && !/^\d+$/.test(target.trim())) {
      return target;
    }

    return null;
  }, []);

  const isTargetMatchingGuild = useCallback(
    (target: any, guildRef: { id: number | null; name: string | null }) => {
      if (!guildRef.id && !guildRef.name) {
        return false;
      }

      const targetId = extractTargetId(target);
      if (targetId !== null && guildRef.id !== null && targetId === guildRef.id) {
        return true;
      }

      const targetName = extractTargetName(target);
      if (targetName && guildRef.name && targetName === guildRef.name) {
        return true;
      }

      return false;
    },
    [extractTargetId, extractTargetName],
  );

  const hasEffectForGuild = useCallback(
    (effectName: string, guild: any): boolean => {
      if (!guild) {
        return false;
      }

      const guildRef = normalizeGuildReference(guild);
      if (!guildRef.id && !guildRef.name) {
        return false;
      }

      return activeEffects.some((effect: any) => {
        if (effect.effect !== effectName) {
          return false;
        }

        const targets = Array.isArray(effect.targets)
          ? effect.targets
          : effect.targets !== undefined && effect.targets !== null
          ? [effect.targets]
          : [];

        return targets.some((target: any) => isTargetMatchingGuild(target, guildRef));
      });
    },
    [activeEffects, isTargetMatchingGuild, normalizeGuildReference],
  );

  const hasHigherExtractionYield = useCallback(
    (guild: any): boolean => hasEffectForGuild('higher_extraction_yield', guild),
    [hasEffectForGuild],
  );

  const hasHigherProductionYield = useCallback(
    (guild: any): boolean => hasEffectForGuild('higher_production_yield', guild),
    [hasEffectForGuild],
  );

  const isTechSchoolsOpenForLevel = useCallback(
    (plantLevelId?: number | null): boolean => {
      if (!plantLevelId) {
        return false;
      }
      const fullPlantLevel = allPlantLevels.find((pl) => pl.id === plantLevelId);
      return fullPlantLevel?.tech_schools_open === true || fullPlantLevel?.tech_schools_open === 1;
    },
    [allPlantLevels],
  );

  const isTechSchoolsOpen = useCallback((): boolean => {
    const plantLevelId = selectedPlant?.plant_level?.id;
    return isTechSchoolsOpenForLevel(plantLevelId);
  }, [isTechSchoolsOpenForLevel, selectedPlant?.plant_level?.id]);

  const getResourceInfo = useCallback(
    (identificator: string) => {
      const resource = resources.find((r) => r.identificator === identificator);
      const baseURL = ApiService['api'].defaults.baseURL || 'http://192.168.1.101:3000';
      return {
        name: resource?.name || identificator,
        imageUrl: `${baseURL}/images/resources/${identificator}.png`,
      };
    },
    [resources],
  );

  const getEntryMaxResourceCount = useCallback(
    (entry: MultiEntry, resource: any): number => {
      if (!entry || !entry.plant?.plant_level?.formulas) {
        return 0;
      }

      const formulas = entry.plant.plant_level.formulas || [];
      if (formulas.length === 0) {
        return 0;
      }

      let maxCount = 0;

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

      return Math.floor(maxCount);
    },
    [],
  );

  const logMulti = useCallback(() => {
    // no-op: отладка выключена
  }, []);

  const mergeResourceArrays = useCallback((target: any[], source: any[] = [], sign: number = 1): any[] => {
    const map = new Map<string, any>();

    target.forEach((item: any) => {
      if (!item?.identificator) {
        return;
      }
      map.set(item.identificator, { ...item });
    });

    source.forEach((item: any) => {
      if (!item?.identificator) {
        return;
      }
      const key = item.identificator;
      const existing = map.get(key);
      const delta = (item.count || 0) * sign;

      if (existing) {
        existing.count = (existing.count || 0) + delta;
        if (!existing.name && item.name) {
          existing.name = item.name;
        }
      } else {
        map.set(key, {
          ...item,
          count: delta,
        });
      }
    });

    return Array.from(map.values()).filter((item) => (item.count || 0) !== 0);
  }, []);

  const normalizeResourceArray = useCallback((array: any[] = []): any[] => {
    return array.filter((item) => item && typeof item.count === 'number');
  }, []);

  const sortGuildPlants = useCallback((data: any[]) => {
    return [...data].sort((a, b) => {
      const nameA = a.plant_level?.plant_type?.name || '';
      const nameB = b.plant_level?.plant_type?.name || '';
      return nameA.localeCompare(nameB);
    });
  }, []);

  const loadGuilds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ApiService.getGuilds();
      const sortedData = data.sort((a, b) => a.name.localeCompare(b.name));
      setGuilds(sortedData);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const resArrayMult = useCallback((resArray: any[], n: number): any[] => {
    return resArray.map((res) => ({
      ...res,
      count: res.count * n,
    }));
  }, []);

  const resArraySum = useCallback((array1: any[], array2: any[], sign: number = 1): any[] => {
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
  }, []);

  const isResArrayLess = useCallback((resArray1: any[], resArray2: any[]): boolean => {
    for (const res1 of resArray1) {
      const var2 = resArray2.find((res2: any) => res1.identificator === res2.identificator);
      if (!var2) return false;
      if (res1.count > var2.count) return false;
    }
    return true;
  }, []);

  const countRequest = useCallback(
    (formula: any, request: any[], way: string): { from: any[]; to: any[] } => {
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
    },
    [isResArrayLess, resArrayMult, resArraySum],
  );

  const getMaxResourceCount = useCallback(
    (resource: any, isFrom: boolean) => {
      if (!selectedPlant?.plant_level?.formulas) return 0;

      const formulas = selectedPlant.plant_level.formulas;
      let maxCount = 0;

      const isProcessing = selectedPlant?.plant_level?.plant_type?.plant_category?.id === 2;
      const hasEffect = isProcessing && selectedGuild && hasHigherProductionYield(selectedGuild);
      const innovationMultiplier = hasEffect ? 2 : 1;
      const techSchoolsOpenState = isProcessing && isTechSchoolsOpen();
      const techSchoolsMultiplier = techSchoolsOpenState ? 1.5 : 1;
      const effectMultiplier = innovationMultiplier * techSchoolsMultiplier;

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
              maxCount = Math.max(maxCount, Math.floor(maxProductItem.count * effectMultiplier));
            }
          }
        });
      }

      return Math.floor(maxCount);
    },
    [hasHigherProductionYield, isTechSchoolsOpen, selectedGuild, selectedPlant],
  );

  const fetchPlantDetails = useCallback(
    async (plantId: number) => {
      const data = await ApiService.getPlant(plantId);

      if (!data.plant_level) {
        throw new Error('У предприятия нет уровня');
      }

      const plantLevelId = data.plant_level.id;
      const fullPlantLevel = allPlantLevels.find((pl) => pl.id === plantLevelId);

      if (!fullPlantLevel) {
        throw new Error('Информация об уровне предприятия не найдена');
      }

      const isExtractive = data.plant_level.plant_type?.plant_category?.id === 1;

      const guild = data.economic_subject_id
        ? guilds.find((g) => g.id === data.economic_subject_id) || null
        : null;

      let formulaFromData: any[] = [];
      let formulaToData: any[] = fullPlantLevel.formula_to || [];

      let enrichedPlant: any;

      if (isExtractive) {
        enrichedPlant = {
          ...data,
          plant_level: {
            ...data.plant_level,
            formulas: fullPlantLevel.formulas || [],
            formula_conversion: {
              from: [],
              to: fullPlantLevel.formula_to || [],
            },
          },
          economic_subject_id: data.economic_subject_id,
          economic_subject_type: data.economic_subject_type,
        };
        formulaFromData = [];
      } else {
        if (!fullPlantLevel.formulas || fullPlantLevel.formulas.length === 0) {
          throw new Error('У предприятия нет формул переработки');
        }

        if (!fullPlantLevel.formula_from || !fullPlantLevel.formula_to) {
          throw new Error('У предприятия нет формул переработки');
        }

        enrichedPlant = {
          ...data,
          plant_level: {
            ...data.plant_level,
            formulas: fullPlantLevel.formulas,
            formula_conversion: {
              from: fullPlantLevel.formula_from,
              to: fullPlantLevel.formula_to,
            },
          },
          economic_subject_id: data.economic_subject_id,
          economic_subject_type: data.economic_subject_type,
        };

        formulaFromData = fullPlantLevel.formula_from || [];
        formulaToData = fullPlantLevel.formula_to || [];
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
        plant: enrichedPlant,
        guild,
        isExtractive,
        formulaFrom: formulaFromData || [],
        formulaTo: formulaToData || [],
        defaultInputFrom,
        defaultInputTo,
        fullPlantLevel,
      };
    },
    [allPlantLevels, guilds],
  );

  const loadPlantAndNavigateToProcessing = useCallback(
    async (plantId: string) => {
      setLoading(true);
      try {
        const numericId = parseInt(plantId, 10);
        if (Number.isNaN(numericId)) {
          throw new Error('Некорректный идентификатор предприятия');
        }

        if (guilds.length === 0) {
          await loadGuilds();
        }

        const details = await fetchPlantDetails(numericId);

        if (details.guild) {
          setSelectedGuild(details.guild);

          if (!selectedGuild || selectedGuild.id !== details.guild.id || guildPlants.length === 0) {
            try {
              const plantsData = await ApiService.getGuildPlants(details.guild.id);
              setGuildPlants(sortGuildPlants(plantsData));
            } catch (plantsError: any) {
              // Игнорируем ошибку, предприятия можно будет загрузить вручную из интерфейса
            }
          }
        } else {
          setSelectedGuild(null);
        }

        setSelectedPlant(details.plant);
        setFormulaFrom(details.formulaFrom);
        setFormulaTo(details.formulaTo);
        setInputFrom(details.defaultInputFrom);
        setInputTo(details.defaultInputTo);

        setStep('processing');
      } catch (error: any) {
        const errorMessage = error.message || 'Не удалось загрузить предприятие';
        const isNotFound =
          errorMessage.toLowerCase().includes('не найдено') || errorMessage.toLowerCase().includes('not found');

        if (isNotFound) {
          Alert.alert('Ошибка', errorMessage, [
            {
              text: 'ОК',
              onPress: () => setStep('guild'),
            },
          ]);
        } else {
          Alert.alert('Ошибка', errorMessage);
        }
      } finally {
        setLoading(false);
      }
    },
    [fetchPlantDetails, guildPlants, guilds, loadGuilds, selectedGuild, sortGuildPlants],
  );

  const resetMultiTotals = useCallback(() => {
    setMultiTotals({
      resultFrom: [],
      resultTo: [],
      resultChange: [],
    });
  }, []);

  const addPlantToMulti = useCallback(
    async (plantId: string) => {
      const numericId = parseInt(plantId, 10);
      if (Number.isNaN(numericId)) {
        Alert.alert('Ошибка', 'Некорректный штрихкод');
        return;
      }

      setLoading(true);
      try {
        if (guilds.length === 0) {
          await loadGuilds();
        }

        const details = await fetchPlantDetails(numericId);

        const extractionMultiplier =
          details.isExtractive && details.guild && hasHigherExtractionYield(details.guild) ? 2 : 1;

        const initialResultTo = details.isExtractive
          ? (details.formulaTo || []).map((resource: any) => ({
              ...resource,
              count: Math.floor((resource.count || 0) * extractionMultiplier),
            }))
          : [];

        const newEntry: MultiEntry = {
          plantId: numericId,
          plant: details.plant,
          guild: details.guild,
          isExtractive: details.isExtractive,
          formulaFrom: details.formulaFrom || [],
          formulaTo: details.formulaTo || [],
          inputFrom: { ...details.defaultInputFrom },
          inputTo: { ...details.defaultInputTo },
          resultFrom: [],
          resultTo: initialResultTo,
          resultChange: [],
          fullPlantLevel: details.fullPlantLevel,
        };

        setMultiEntries((prev) => {
          if (prev.some((entry) => entry.plantId === numericId)) {
            return prev;
          }
          return [...prev, newEntry];
        });

        resetMultiTotals();
      } catch (error: any) {
        const message = error?.message || 'Не удалось загрузить предприятие';
        Alert.alert('Ошибка', message);
      } finally {
        setLoading(false);
      }
    },
    [fetchPlantDetails, guilds, hasHigherExtractionYield, loadGuilds, resetMultiTotals],
  );

  const handleOpenMultiMode = useCallback(() => {
    if (selectedPlant) {
      const plantId = selectedPlant.id;

      const plantLevelId = selectedPlant.plant_level?.id;
      const fullPlantLevel = plantLevelId
        ? allPlantLevels.find((pl) => pl.id === plantLevelId)
        : null;

      const isExtractive = selectedPlant.plant_level?.plant_type?.plant_category?.id === 1;
      const extractionMultiplier =
        isExtractive && selectedGuild && hasHigherExtractionYield(selectedGuild) ? 2 : 1;

      const initialResultTo = isExtractive
        ? (formulaTo || []).map((resource: any) => ({
            ...resource,
            count: Math.floor((resource.count || 0) * extractionMultiplier),
          }))
        : [];

      const entryFromCurrent: MultiEntry = {
        plantId,
        plant: selectedPlant,
        guild: selectedGuild,
        isExtractive,
        formulaFrom: formulaFrom ? [...formulaFrom] : [],
        formulaTo: formulaTo ? [...formulaTo] : [],
        inputFrom: { ...inputFrom },
        inputTo: { ...inputTo },
        resultFrom: [],
        resultTo: initialResultTo,
        resultChange: [],
        fullPlantLevel: fullPlantLevel || null,
      };

      setMultiEntries((prev) => {
        if (prev.some((entry) => entry.plantId === plantId)) {
          return prev;
        }
        return [...prev, entryFromCurrent];
      });
      resetMultiTotals();
    }

    setStep('multi');
  }, [
    allPlantLevels,
    formulaFrom,
    formulaTo,
    hasHigherExtractionYield,
    inputFrom,
    inputTo,
    resetMultiTotals,
    selectedGuild,
    selectedPlant,
  ]);

  const removeMultiEntry = useCallback(
    (plantId: number) => {
      setMultiEntries((prev) => prev.filter((entry) => entry.plantId !== plantId));
      resetMultiTotals();
    },
    [resetMultiTotals],
  );

  const clearMultiEntries = useCallback(() => {
    setMultiEntries([]);
    resetMultiTotals();
  }, [resetMultiTotals]);

  const setMultiEntryInputFromValue = useCallback(
    (plantId: number, identificator: string, value: string) => {
      setMultiEntries((prev) =>
        prev.map((entry) =>
          entry.plantId === plantId
            ? {
                ...entry,
                inputFrom: {
                  ...entry.inputFrom,
                  [identificator]: value,
                },
              }
            : entry,
        ),
      );
      resetMultiTotals();
    },
    [resetMultiTotals],
  );

  const calculateMultiFrom = useCallback(() => {
    setMultiEntries((prevEntries) => {
      if (prevEntries.length === 0) {
        Alert.alert('Список пуст', 'Добавьте предприятия с помощью сканирования.');
        return prevEntries;
      }

      let aggregatedResultTo: any[] = [];
      let aggregatedResultFrom: any[] = [];
      let aggregatedResultChange: any[] = [];

      const updatedEntries = prevEntries.map((entry) => {
        // отладка отключена

        if (entry.isExtractive) {
          const extractionMultiplier = entry.guild && hasHigherExtractionYield(entry.guild) ? 2 : 1;
          const resultTo = (entry.formulaTo || []).map((resource: any) => ({
            ...resource,
            count: Math.floor((resource.count || 0) * extractionMultiplier),
          }));

          aggregatedResultTo = mergeResourceArrays(aggregatedResultTo, normalizeResourceArray(resultTo));

          // отладка отключена

          return {
            ...entry,
            resultFrom: [],
            resultTo,
            resultChange: [],
          };
        }

        const formulas = entry.plant?.plant_level?.formulas || [];
        if (formulas.length === 0) {
          // отладка отключена
          return {
            ...entry,
            resultFrom: [],
            resultTo: [],
            resultChange: [],
          };
        }

        const requestArray = Object.entries(entry.inputFrom || {})
          .map(([identificator, value]) => {
            const matchedResource = entry.formulaFrom.find((r: any) => r.identificator === identificator);
            return {
              identificator,
              count: parseInt((value as string) || '0', 10),
              name: matchedResource?.name || matchedResource?.identificator || identificator,
            };
          })
          .filter((item) => item.count > 0);

        if (requestArray.length === 0) {
          // отладка отключена
          return {
            ...entry,
            resultFrom: [],
            resultTo: [],
            resultChange: [],
          };
        }

        const requestCopy = JSON.parse(JSON.stringify(requestArray));
        let resultingFrom: any[] = [];
        let resultingTo: any[] = [];

        formulas.forEach((formula: any) => {
          const { from, to } = countRequest(formula, requestCopy, 'from');
          if (from.length > 0) {
            resArraySum(resultingFrom, from);
            resArraySum(requestCopy, from, -1);
          }
          if (to.length > 0) {
            resArraySum(resultingTo, to);
          }
        });

        const isProcessing = entry.plant?.plant_level?.plant_type?.plant_category?.id === 2;
        const hasProductionEffect = isProcessing && entry.guild && hasHigherProductionYield(entry.guild);
        const techSchoolsOpenState = isTechSchoolsOpenForLevel(entry.plant?.plant_level?.id);
        const effectBonus = (hasProductionEffect ? 2 : 1) * (techSchoolsOpenState ? 1.5 : 1);

        resultingTo = resultingTo.map((res: any) => ({
          ...res,
          count: Math.floor((res.count || 0) * effectBonus),
        }));

        const leftovers = requestCopy.filter((item: any) => item.count > 0).map((item: any) => ({ ...item }));

        aggregatedResultTo = mergeResourceArrays(aggregatedResultTo, normalizeResourceArray(resultingTo));
        aggregatedResultChange = mergeResourceArrays(aggregatedResultChange, normalizeResourceArray(leftovers));

        // отладка отключена

        return {
          ...entry,
          resultFrom: [],
          resultTo: resultingTo,
          resultChange: leftovers,
        };
      });

      setMultiTotals({
        resultFrom: aggregatedResultFrom,
        resultTo: aggregatedResultTo,
        resultChange: aggregatedResultChange,
      });

      // отладка отключена

      return updatedEntries;
    });
  }, [
    countRequest,
    hasHigherExtractionYield,
    hasHigherProductionYield,
    isTechSchoolsOpenForLevel,
    mergeResourceArrays,
    normalizeResourceArray,
    resArraySum,
  ]);

  const handleBarcodeScanned = useCallback(
    (id: string) => {
      if (step === 'multi') {
        addPlantToMulti(id);
        return;
      }

      const enterpriseId = parseInt(id, 10);
      if (Number.isNaN(enterpriseId)) {
        return;
      }
      loadPlantAndNavigateToProcessing(enterpriseId.toString());
    },
    [addPlantToMulti, loadPlantAndNavigateToProcessing, step],
  );

  useEffect(() => {
    loadAllPlantLevels();
    loadResources();
    loadActiveEffects();
  }, [loadActiveEffects, loadAllPlantLevels, loadResources]);

  useEffect(() => {
    if (step === 'guild') {
      loadGuilds();
    }
  }, [loadGuilds, step]);

  useEffect(() => {
    const unsubscribe = addListener('processing', (code) => {
      if (!code.trim()) {
        return;
      }
      if (lastHandledBarcodeRef.current === code) {
        return;
      }
      lastHandledBarcodeRef.current = code;
      handleBarcodeScanned(code);
      setTimeout(() => {
        if (lastHandledBarcodeRef.current === code) {
          lastHandledBarcodeRef.current = null;
        }
      }, 500);
    });

    return () => {
      unsubscribe();
      lastHandledBarcodeRef.current = null;
    };
  }, [addListener, handleBarcodeScanned, step]);

  const handleSelectGuild = useCallback(
    async (guild: any) => {
      setSelectedGuild(guild);
      setLoading(true);
      try {
        const data = await ApiService.getGuildPlants(guild.id);
        setGuildPlants(sortGuildPlants(data));
        setStep('plant');
      } catch (error: any) {
        Alert.alert('Ошибка', error.message);
      } finally {
        setLoading(false);
      }
    },
    [sortGuildPlants],
  );

  const handleSelectPlant = useCallback(
    async (plant: any) => {
      const isExtractive = plant.plant_level?.plant_type?.plant_category?.id === 1;
      const plantLevelId = plant.plant_level?.id;
      const fullPlantLevel = allPlantLevels.find((pl) => pl.id === plantLevelId);

      if (!fullPlantLevel) {
        Alert.alert('Ошибка', 'Информация об уровне предприятия не найдена');
        return;
      }

      if (isExtractive) {
        const enrichedPlant = {
          ...plant,
          plant_level: {
            ...plant.plant_level,
            formulas: fullPlantLevel.formulas || [],
            formula_conversion: {
              from: [],
              to: fullPlantLevel.formula_to || [],
            },
          },
          economic_subject_id: plant.economic_subject_id,
          economic_subject_type: plant.economic_subject_type,
        };

        setSelectedPlant(enrichedPlant);
        setFormulaFrom([]);
        setFormulaTo(fullPlantLevel.formula_to || []);
        setInputFrom({});
        setInputTo({});
      } else {
        if (!fullPlantLevel.formulas || fullPlantLevel.formulas.length === 0) {
          Alert.alert('Ошибка', 'У предприятия нет формул переработки');
          return;
        }

        if (!fullPlantLevel.formula_from || !fullPlantLevel.formula_to) {
          Alert.alert('Ошибка', 'У предприятия нет формул переработки');
          return;
        }

        const enrichedPlant = {
          ...plant,
          plant_level: {
            ...plant.plant_level,
            formulas: fullPlantLevel.formulas,
            formula_conversion: {
              from: fullPlantLevel.formula_from,
              to: fullPlantLevel.formula_to,
            },
          },
          economic_subject_id: plant.economic_subject_id,
          economic_subject_type: plant.economic_subject_type,
        };

        setSelectedPlant(enrichedPlant);
        setFormulaFrom(fullPlantLevel.formula_from);
        setFormulaTo(fullPlantLevel.formula_to);

        const emptyFrom: { [key: string]: string } = {};
        const emptyTo: { [key: string]: string } = {};

        fullPlantLevel.formula_from.forEach((item: any) => {
          emptyFrom[item.identificator] = '';
        });

        fullPlantLevel.formula_to.forEach((item: any) => {
          emptyTo[item.identificator] = '';
        });

        setInputFrom(emptyFrom);
        setInputTo(emptyTo);
      }

      setStep('processing');
    },
    [allPlantLevels, sortGuildPlants],
  );

  const calculateFrom = useCallback(() => {
    if (!selectedPlant?.plant_level) return;

    const plantLevel = selectedPlant.plant_level;
    const formulas = plantLevel.formulas || [];

    if (formulas.length === 0) {
      Alert.alert('Ошибка', `У предприятия нет формул. Plant level: ${JSON.stringify(plantLevel, null, 2)}`);
      return;
    }

    const emptyTo: { [key: string]: string } = {};
    formulaTo.forEach((item: any) => {
      emptyTo[item.identificator] = '';
    });
    setInputTo(emptyTo);

    const coof = 1;
    const isProcessing = selectedPlant.plant_level?.plant_type?.plant_category?.id === 2;
    const hasInnovationEffect = isProcessing && selectedGuild && hasHigherProductionYield(selectedGuild);
    const innovationBonus = hasInnovationEffect ? 2 : 1;
    const techSchoolsOpenState = isProcessing && isTechSchoolsOpen();
    const techSchoolsBonus = techSchoolsOpenState ? 1.5 : 1;
    const effectBonus = innovationBonus * techSchoolsBonus;

    const requestCopy = Object.entries(inputFrom)
      .map(([identificator, value]) => ({
        identificator,
        count: parseInt((value as string) || '0', 10),
        name: formulaFrom.find((r: any) => r.identificator === identificator)?.name || identificator,
      }))
      .filter((r) => r.count > 0);

    if (requestCopy.length === 0) {
      Alert.alert('Ошибка', 'Введите хотя бы одно значение');
      return;
    }

    let resultingFrom: any[] = [];
    let resultingTo: any[] = [];

    formulas.forEach((formula: any) => {
      const { from, to } = countRequest(formula, requestCopy, 'from');
      resArraySum(requestCopy, from, -1);
      resArraySum(resultingFrom, from);
      resArraySum(resultingTo, to);
    });

    resultingTo.forEach((res) => {
      res.count = Math.floor(res.count * coof * effectBonus);
    });

    setResultTo(resultingTo);
    setResultFrom([]);
    setResultChange(requestCopy);
  }, [
    countRequest,
    formulaFrom,
    formulaTo,
    hasHigherProductionYield,
    inputFrom,
    isTechSchoolsOpen,
    resArraySum,
    selectedGuild,
    selectedPlant?.plant_level,
  ]);

  const calculateTo = useCallback(() => {
    if (!selectedPlant?.plant_level) return;

    const plantLevel = selectedPlant.plant_level;
    const formulas = plantLevel.formulas || [];

    if (formulas.length === 0) {
      Alert.alert('Ошибка', 'У предприятия нет формул');
      return;
    }

    const emptyFrom: { [key: string]: string } = {};
    formulaFrom.forEach((item: any) => {
      emptyFrom[item.identificator] = '';
    });
    setInputFrom(emptyFrom);

    const coof = 1;
    const isProcessing = selectedPlant.plant_level?.plant_type?.plant_category?.id === 2;
    const hasProductionEffect = isProcessing && selectedGuild && hasHigherProductionYield(selectedGuild);
    const innovationDivider = hasProductionEffect ? 2 : 1;
    const techSchoolsOpenState = isProcessing && isTechSchoolsOpen();
    const techSchoolsDivider = techSchoolsOpenState ? 1.5 : 1;
    const productionEffectDivider = innovationDivider * techSchoolsDivider;

    const requestCopy = Object.entries(inputTo)
      .map(([identificator, value]) => ({
        identificator,
        count: Math.ceil(parseInt((value as string) || '0', 10) / coof / productionEffectDivider),
        name: formulaTo.find((r: any) => r.identificator === identificator)?.name || identificator,
      }))
      .filter((r) => r.count > 0);

    if (requestCopy.length === 0) {
      Alert.alert('Ошибка', 'Введите хотя бы одно значение');
      return;
    }

    let resultingFrom: any[] = [];
    let resultingTo: any[] = [];

    formulas.forEach((formula: any) => {
      const { from, to } = countRequest(formula, requestCopy, 'to');
      resArraySum(requestCopy, to, -1);
      resArraySum(resultingFrom, from);
      resArraySum(resultingTo, to);
    });

    const isExtractive = selectedPlant.plant_level?.plant_type?.plant_category?.id === 1;
    const effectBonus = isExtractive && selectedGuild && hasHigherExtractionYield(selectedGuild) ? 2 : 1;

    resultingTo.forEach((res) => {
      res.count = Math.floor(res.count * coof * effectBonus);
    });

    setResultFrom(resultingFrom);
    setResultTo([]);
    setResultChange(requestCopy);
  }, [
    countRequest,
    formulaFrom,
    formulaTo,
    hasHigherExtractionYield,
    hasHigherProductionYield,
    inputTo,
    isTechSchoolsOpen,
    resArraySum,
    selectedGuild,
    selectedPlant?.plant_level,
  ]);

  const setInputFromValue = useCallback((identificator: string, value: string) => {
    setInputFrom((prev) => ({
      ...prev,
      [identificator]: value,
    }));
  }, []);

  const setInputToValue = useCallback((identificator: string, value: string) => {
    setInputTo((prev) => ({
      ...prev,
      [identificator]: value,
    }));
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'guild') {
      onClose();
    } else if (step === 'plant') {
      setStep('guild');
      setSelectedGuild(null);
      setGuildPlants([]);
    } else if (step === 'multi') {
      if (selectedPlant) {
        setStep('processing');
      } else if (selectedGuild) {
        setStep('plant');
      } else {
        setStep('guild');
      }
    } else if (step === 'processing') {
      setStep('plant');
      setSelectedPlant(null);
      setFormulaFrom([]);
      setFormulaTo([]);
      setInputFrom({});
      setInputTo({});
      setResultTo([]);
      setResultFrom([]);
      setResultChange([]);
    }
  }, [onClose, selectedGuild, selectedPlant, step]);

  useEffect(() => {
    loadAllPlantLevels();
    loadResources();
    loadActiveEffects();
  }, [loadActiveEffects, loadAllPlantLevels, loadResources]);

  const processingMeta = useMemo(() => {
    const isExtractive = selectedPlant?.plant_level?.plant_type?.plant_category?.id === 1;
    const hasExtractionEffect = selectedGuild && hasHigherExtractionYield(selectedGuild);
    const displayFormulaTo = isExtractive
      ? formulaTo.map((resource: any) => ({
          ...resource,
          count: Math.floor(resource.count * (hasExtractionEffect ? 2 : 1)),
        }))
      : formulaTo;

    return {
      isExtractive,
      displayFormulaTo,
    };
  }, [formulaTo, hasHigherExtractionYield, selectedGuild, selectedPlant]);

  const processingState = useMemo(
    () => ({
      step,
      loading,
      guilds,
      selectedGuild,
      guildPlants,
      selectedPlant,
      formulaFrom,
      formulaTo,
      inputFrom,
      inputTo,
      resultFrom,
      resultTo,
      resultChange,
    }),
    [
      step,
      loading,
      guilds,
      selectedGuild,
      guildPlants,
      selectedPlant,
      formulaFrom,
      formulaTo,
      inputFrom,
      inputTo,
      resultFrom,
      resultTo,
      resultChange,
    ],
  );

  return {
    state: {
      step: processingState.step,
      loading: processingState.loading,
    },
    selections: {
      guilds: processingState.guilds,
      selectedGuild: processingState.selectedGuild,
      guildPlants: processingState.guildPlants,
      selectedPlant: processingState.selectedPlant,
    },
    formulas: {
      formulaFrom: processingState.formulaFrom,
      formulaTo: processingState.formulaTo,
    },
    inputs: {
      inputFrom: processingState.inputFrom,
      inputTo: processingState.inputTo,
      setInputFromValue,
      setInputToValue,
    },
    results: {
      resultFrom: processingState.resultFrom,
      resultTo: processingState.resultTo,
      resultChange: processingState.resultChange,
    },
    effects: {
      hasHigherExtractionYield,
      hasHigherProductionYield,
    },
    helpers: {
      getResourceInfo,
      getMaxResourceCount,
      getEntryMaxResourceCount,
    },
    processingMeta,
    handlers: {
      handleSelectGuild,
      handleSelectPlant,
      handleBack,
      calculateFrom,
      calculateTo,
      openMultiMode: handleOpenMultiMode,
      removeMultiEntry,
      clearMultiEntries,
      setMultiEntryInputFromValue,
      calculateMultiFrom,
    },
    multi: {
      entries: multiEntries,
      totals: multiTotals,
    },
  };
};

export type ProcessingScreenLogic = ReturnType<typeof useProcessingScreenLogic>;
