import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { getErrorMessage } from '../../data/apiErrors';
import { fetchGuildPlants } from '../../data/hooks/useGuildPlants';
import { loadPlant } from '../../data/hooks/usePlant';
import { ensurePlantLevels, usePlantLevels } from '../../data/hooks/usePlantLevels';
import { useResources } from '../../data/hooks/useResources';
import { useGuilds } from '../../data/hooks/useGuilds';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import { useBarcodeScannerContext } from '../../context/BarcodeScannerContext';
import ApiService from '../../services/api';
import { feedToPlant, isTechSchoolsOpen } from '../../services/plantProduction';

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
  const [refreshing, setRefreshing] = useState(false);

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

  // Справочники — из слоя данных (ключи ['plantLevels'], ['resources'], ['guilds'])
  const levelsQuery = usePlantLevels();
  const resourcesQuery = useResources();
  const guildsQuery = useGuilds();

  const allPlantLevels = useMemo(() => (levelsQuery.data as any[]) ?? [], [levelsQuery.data]);
  const resources = useMemo(() => (resourcesQuery.data as any[]) ?? [], [resourcesQuery.data]);
  const guilds = useMemo(
    () => [...((guildsQuery.data as any[]) ?? [])].sort((a: any, b: any) => a.name.localeCompare(b.name)),
    [guildsQuery.data],
  );

  const { addListener } = useBarcodeScannerContext();
  const lastHandledBarcodeRef = useRef<string | null>(null);

  const getIsExtractive = useCallback((plant: any): boolean => {
    const isExtractive = plant?.plant_level?.plant_type?.plant_category?.is_extractive || false;
    return isExtractive;
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Ручное обновление: тянем список гильдий через слой (force игнорирует TTL)
      await queryClient.refetch([queryKeys.guilds()], { force: true });
    } catch (error: any) {
      // ignore
    } finally {
      setRefreshing(false);
    }
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
      // Гильдии приходят из слоя; forced-refetch обновляет кэш ключа ['guilds'].
      await queryClient.refetch([queryKeys.guilds()], { force: true });
    } catch (error: any) {
      Alert.alert('Ошибка', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const getMaxResourceCount = useCallback(
    (resource: any, isFrom: boolean) => {
      if (!selectedPlant?.plant_level?.formulas) return 0;
      const formulas = selectedPlant.plant_level.formulas;
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
              maxCount = Math.max(maxCount, maxProductItem.count);
            }
          }
        });
      }

      return Math.floor(maxCount);
    },
    [selectedPlant],
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

  const mergeResourceArrays = useCallback((target: any[], source: any[] = [], sign: number = 1): any[] => {
    const map = new Map<string, any>();
    target.forEach((item: any) => {
      if (!item?.identificator) return;
      map.set(item.identificator, { ...item });
    });
    source.forEach((item: any) => {
      if (!item?.identificator) return;
      const key = item.identificator;
      const existing = map.get(key);
      const delta = (item.count || 0) * sign;
      if (existing) {
        existing.count = (existing.count || 0) + delta;
        if (!existing.name && item.name) {
          existing.name = item.name;
        }
      } else {
        map.set(key, { ...item, count: delta });
      }
    });
    return Array.from(map.values()).filter((item) => (item.count || 0) !== 0);
  }, []);

  const normalizeResourceArray = useCallback((array: any[] = []): any[] => {
    return array.filter((item) => item && typeof item.count === 'number');
  }, []);

  const fetchPlantDetails = useCallback(
    async (plantId: number) => {
      // Предприятие — всегда свежее, через слой (ключ ['plant', id], TTL 0, отмена предыдущего запроса)
      const data = await loadPlant(plantId);

      if (!data.plant_level) {
        throw new Error('У предприятия нет уровня');
      }

      const plantLevelId = data.plant_level.id;
      // Уровни берём из кэша слоя; если справочник ещё не загружен — догружаем через слой.
      const cachedLevels = allPlantLevels.find((pl) => pl.id === plantLevelId)
        ? allPlantLevels
        : await ensurePlantLevels();
      const fullPlantLevel = cachedLevels.find((pl) => pl.id === plantLevelId);

      if (!fullPlantLevel) {
        throw new Error('Информация об уровне предприятия не найдена');
      }

      const isExtractive = getIsExtractive(data);

      const guild = data.economic_subject_id
        ? guilds.find((g) => g.id === data.economic_subject_id) || null
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

      const enrichedPlant = {
        ...data,
        plant_level: {
          ...data.plant_level,
          formulas: fullPlantLevel.formulas || [],
        },
        economic_subject_id: data.economic_subject_id,
        economic_subject_type: data.economic_subject_type,
      };

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
    [allPlantLevels, guilds, getIsExtractive],
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
              const plantsData = await fetchGuildPlants(details.guild.id);
              setGuildPlants(sortGuildPlants(plantsData));
            } catch (plantsError: any) {
              // ignore
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

        const initialResultTo = details.isExtractive
          ? (details.formulaTo || []).map((resource: any) => ({
              ...resource,
              count: resource.count || 0,
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
    [fetchPlantDetails, guilds, loadGuilds, resetMultiTotals],
  );

  const handleOpenMultiMode = useCallback(() => {
    if (selectedPlant) {
      const plantId = selectedPlant.id;
      const plantLevelId = selectedPlant.plant_level?.id;
      const fullPlantLevel = plantLevelId
        ? allPlantLevels.find((pl) => pl.id === plantLevelId)
        : null;

      const isExtractive = getIsExtractive(selectedPlant);

      const initialResultTo = isExtractive
        ? (formulaTo || []).map((resource: any) => ({
            ...resource,
            count: resource.count || 0,
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
  }, [allPlantLevels, formulaFrom, formulaTo, inputFrom, inputTo, resetMultiTotals, selectedGuild, selectedPlant, getIsExtractive]);

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
        if (entry.isExtractive) {
          const resultTo = (entry.formulaTo || []).map((resource: any) => ({
            ...resource,
            count: resource.count || 0,
          }));

          aggregatedResultTo = mergeResourceArrays(aggregatedResultTo, normalizeResourceArray(resultTo));

          return {
            ...entry,
            resultFrom: [],
            resultTo,
            resultChange: [],
          };
        }

        const formulas = entry.plant?.plant_level?.formulas || [];
        if (formulas.length === 0) {
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
          return {
            ...entry,
            resultFrom: [],
            resultTo: [],
            resultChange: [],
          };
        }

        // Единый расчёт: последовательный расход сырья + эффект «Технических училищ».
        const { from, to, change } = feedToPlant(formulas, requestArray, 'from', {
          techSchoolsOpen: isTechSchoolsOpen(entry.plant?.plant_level),
        });

        aggregatedResultTo = mergeResourceArrays(aggregatedResultTo, normalizeResourceArray(to));
        aggregatedResultChange = mergeResourceArrays(
          aggregatedResultChange,
          normalizeResourceArray(change),
        );

        return {
          ...entry,
          resultFrom: from,
          resultTo: to,
          resultChange: change,
        };
      });

      setMultiTotals({
        resultFrom: aggregatedResultFrom,
        resultTo: aggregatedResultTo,
        resultChange: aggregatedResultChange,
      });

      return updatedEntries;
    });
  }, [mergeResourceArrays, normalizeResourceArray]);

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

  // Справочники (уровни предприятий, ресурсы, гильдии) грузит слой данных при появлении
  // подписчиков usePlantLevels()/useResources()/useGuilds() — локальных «загрузок на монтирование» нет.

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
        const data = await fetchGuildPlants(guild.id);
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
      const isExtractive = getIsExtractive(plant);
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
          },
          economic_subject_id: plant.economic_subject_id,
          economic_subject_type: plant.economic_subject_type,
        };

        setSelectedPlant(enrichedPlant);
        setFormulaFrom([]);
        setFormulaTo(deriveFormulaTo(fullPlantLevel.formulas));
        setInputFrom({});
        setInputTo({});
      } else {
        if (!fullPlantLevel.formulas || fullPlantLevel.formulas.length === 0) {
          Alert.alert('Ошибка', 'У предприятия нет формул переработки');
          return;
        }

        const enrichedPlant = {
          ...plant,
          plant_level: {
            ...plant.plant_level,
            formulas: fullPlantLevel.formulas,
          },
          economic_subject_id: plant.economic_subject_id,
          economic_subject_type: plant.economic_subject_type,
        };

        const derivedFormulaFrom = deriveFormulaFrom(fullPlantLevel.formulas);
        const derivedFormulaTo = deriveFormulaTo(fullPlantLevel.formulas);

        setSelectedPlant(enrichedPlant);
        setFormulaFrom(derivedFormulaFrom);
        setFormulaTo(derivedFormulaTo);

        const emptyFrom: { [key: string]: string } = {};
        const emptyTo: { [key: string]: string } = {};

        derivedFormulaFrom.forEach((item: any) => {
          emptyFrom[item.identificator] = '';
        });

        derivedFormulaTo.forEach((item: any) => {
          emptyTo[item.identificator] = '';
        });

        setInputFrom(emptyFrom);
        setInputTo(emptyTo);
      }

      setStep('processing');
    },
    [allPlantLevels, getIsExtractive],
  );

  const calculateFrom = useCallback(() => {
    if (!selectedPlant?.plant_level) return;

    const formulas = selectedPlant.plant_level.formulas || [];
    if (formulas.length === 0) {
      Alert.alert('Ошибка', 'У предприятия нет формул');
      return;
    }

    const emptyTo: { [key: string]: string } = {};
    formulaTo.forEach((item: any) => {
      emptyTo[item.identificator] = '';
    });
    setInputTo(emptyTo);

    const request = Object.entries(inputFrom)
      .map(([identificator, value]) => ({
        identificator,
        count: parseInt((value as string) || '0', 10),
        name: formulaFrom.find((r: any) => r.identificator === identificator)?.name || identificator,
      }))
      .filter((r) => r.count > 0);

    if (request.length === 0) {
      Alert.alert('Ошибка', 'Введите хотя бы одно значение');
      return;
    }

    const { to, change } = feedToPlant(formulas, request, 'from', {
      techSchoolsOpen: isTechSchoolsOpen(selectedPlant?.plant_level),
    });

    setResultTo(to);
    setResultFrom([]);
    setResultChange(change);
  }, [formulaFrom, formulaTo, inputFrom, selectedPlant?.plant_level]);

  const calculateTo = useCallback(() => {
    if (!selectedPlant?.plant_level) return;

    const formulas = selectedPlant.plant_level.formulas || [];
    if (formulas.length === 0) {
      Alert.alert('Ошибка', 'У предприятия нет формул');
      return;
    }

    const emptyFrom: { [key: string]: string } = {};
    formulaFrom.forEach((item: any) => {
      emptyFrom[item.identificator] = '';
    });
    setInputFrom(emptyFrom);

    const request = Object.entries(inputTo)
      .map(([identificator, value]) => ({
        identificator,
        count: parseInt((value as string) || '0', 10),
        name: formulaTo.find((r: any) => r.identificator === identificator)?.name || identificator,
      }))
      .filter((r) => r.count > 0);

    if (request.length === 0) {
      Alert.alert('Ошибка', 'Введите хотя бы одно значение');
      return;
    }

    const { from, change } = feedToPlant(formulas, request, 'to', {
      techSchoolsOpen: isTechSchoolsOpen(selectedPlant?.plant_level),
    });

    setResultFrom(from);
    setResultTo([]);
    setResultChange(change);
  }, [formulaFrom, formulaTo, inputTo, selectedPlant?.plant_level]);

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

  const getResourceInfo = useCallback(
    (identificator: string) => {
      const resource = resources.find((r) => r.identificator === identificator);
      const baseURL = ApiService.getBaseUrl() || 'http://192.168.1.101:3000';
      return {
        name: resource?.name || identificator,
        imageUrl: `${baseURL}/images/resources/${identificator}.png`,
      };
    },
    [resources],
  );

  const processingMeta = useMemo(() => {
    const isExtractive = getIsExtractive(selectedPlant);
    const displayFormulaTo = isExtractive
      ? (formulaTo || []).map((resource: any) => ({
          ...resource,
          count: resource.count || 0,
        }))
      : formulaTo;
    return {
      isExtractive,
      displayFormulaTo,
    };
  }, [selectedPlant, getIsExtractive, formulaTo]);

  return {
    state: {
      step: step,
      loading: loading,
      refreshing: refreshing,
      onRefresh: onRefresh,
    },
    selections: {
      guilds: guilds,
      selectedGuild: selectedGuild,
      guildPlants: guildPlants,
      selectedPlant: selectedPlant,
    },
    formulas: {
      formulaFrom: formulaFrom,
      formulaTo: formulaTo,
    },
    inputs: {
      inputFrom: inputFrom,
      inputTo: inputTo,
      setInputFromValue: setInputFromValue,
      setInputToValue: setInputToValue,
    },
    results: {
      resultFrom: resultFrom,
      resultTo: resultTo,
      resultChange: resultChange,
    },
    helpers: {
      getResourceInfo: getResourceInfo,
      getMaxResourceCount: getMaxResourceCount,
      getEntryMaxResourceCount: getEntryMaxResourceCount,
    },
    processingMeta: processingMeta,
    handlers: {
      handleSelectGuild: handleSelectGuild,
      handleSelectPlant: handleSelectPlant,
      handleBack: handleBack,
      calculateFrom: calculateFrom,
      calculateTo: calculateTo,
      openMultiMode: handleOpenMultiMode,
      removeMultiEntry: removeMultiEntry,
      clearMultiEntries: clearMultiEntries,
      setMultiEntryInputFromValue: setMultiEntryInputFromValue,
      calculateMultiFrom: calculateMultiFrom,
    },
    multi: {
      entries: multiEntries,
      totals: multiTotals,
    },
  };
};

export type ProcessingScreenLogic = ReturnType<typeof useProcessingScreenLogic>;
