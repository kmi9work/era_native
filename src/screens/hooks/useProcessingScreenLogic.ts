import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import ApiService from '../../services/api';
import { useBarcodeScannerContext } from '../../context/BarcodeScannerContext';

type Step = 'guild' | 'plant' | 'processing';

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
      const data = await ApiService.getActiveGuildEffects();
      setActiveEffects(data);
    } catch (error: any) {
      // ignore
    }
  }, []);

  const hasHigherExtractionYield = useCallback(
    (guildName: string): boolean =>
      activeEffects.some(
        (effect: any) => effect.effect === 'higher_extraction_yield' && effect.targets?.includes(guildName),
      ),
    [activeEffects],
  );

  const hasHigherProductionYield = useCallback(
    (guildName: string): boolean =>
      activeEffects.some(
        (effect: any) => effect.effect === 'higher_production_yield' && effect.targets?.includes(guildName),
      ),
    [activeEffects],
  );

  const isTechSchoolsOpen = useCallback((): boolean => {
    if (!selectedPlant?.plant_level) return false;
    const plantLevelId = selectedPlant.plant_level.id;
    const fullPlantLevel = allPlantLevels.find((pl) => pl.id === plantLevelId);
    return fullPlantLevel?.tech_schools_open === true || fullPlantLevel?.tech_schools_open === 1;
  }, [allPlantLevels, selectedPlant]);

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
      const hasEffect = isProcessing && selectedGuild?.name && hasHigherProductionYield(selectedGuild.name);
      const innovationMultiplier = hasEffect ? 1.2 : 1;
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
    [hasHigherProductionYield, isTechSchoolsOpen, selectedGuild?.name, selectedPlant],
  );

  const loadPlantAndNavigateToProcessing = useCallback(
    async (plantId: string) => {
      setLoading(true);
      try {
        const data = await ApiService.getPlant(parseInt(plantId, 10));

        if (!data.plant_level) {
          Alert.alert('Ошибка', 'У предприятия нет уровня');
          setLoading(false);
          return;
        }

        if (guilds.length === 0) {
          await loadGuilds();
        }

        if (data.economic_subject_id) {
          const guild = guilds.find((g) => g.id === data.economic_subject_id);
          if (guild) {
            setSelectedGuild(guild);

            if (!selectedGuild || selectedGuild.id !== guild.id || guildPlants.length === 0) {
              try {
                const plantsData = await ApiService.getGuildPlants(guild.id);
                setGuildPlants(sortGuildPlants(plantsData));
              } catch (plantsError: any) {
                // Игнорируем ошибку, предприятия можно будет загрузить вручную из интерфейса
              }
            }
          }
        }

        const isExtractive = data.plant_level.plant_type?.plant_category?.id === 1;
        const plantLevelId = data.plant_level.id;
        const fullPlantLevel = allPlantLevels.find((pl) => pl.id === plantLevelId);

        if (!fullPlantLevel) {
          Alert.alert('Ошибка', 'Информация об уровне предприятия не найдена');
          setLoading(false);
          return;
        }

        if (isExtractive) {
          const enrichedPlant = {
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

          setSelectedPlant(enrichedPlant);
          setFormulaFrom([]);
          setFormulaTo(fullPlantLevel.formula_to || []);
          setInputFrom({});
          setInputTo({});
        } else {
          if (!fullPlantLevel.formulas || fullPlantLevel.formulas.length === 0) {
            Alert.alert('Ошибка', 'У предприятия нет формул переработки');
            setLoading(false);
            return;
          }

          const enrichedPlant = {
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
    [allPlantLevels, guildPlants, guilds, loadGuilds, selectedGuild, sortGuildPlants],
  );

  const handleBarcodeScanned = useCallback(
    (id: string) => {
      const enterpriseId = parseInt(id, 10);
      loadPlantAndNavigateToProcessing(enterpriseId.toString());
    },
    [loadPlantAndNavigateToProcessing],
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
    const hasInnovationEffect = isProcessing && selectedGuild?.name && hasHigherProductionYield(selectedGuild.name);
    const innovationBonus = hasInnovationEffect ? 1.2 : 1;
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
    selectedGuild?.name,
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
    const hasProductionEffect = isProcessing && selectedGuild?.name && hasHigherProductionYield(selectedGuild.name);
    const innovationDivider = hasProductionEffect ? 1.2 : 1;
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
    const effectBonus = isExtractive && selectedGuild?.name && hasHigherExtractionYield(selectedGuild.name) ? 1.2 : 1;

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
    selectedGuild?.name,
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
  }, [onClose, step]);

  useEffect(() => {
    loadAllPlantLevels();
    loadResources();
    loadActiveEffects();
  }, [loadActiveEffects, loadAllPlantLevels, loadResources]);

  const processingMeta = useMemo(() => {
    const isExtractive = selectedPlant?.plant_level?.plant_type?.plant_category?.id === 1;
    const hasExtractionEffect = selectedGuild?.name && hasHigherExtractionYield(selectedGuild.name);
    const displayFormulaTo = isExtractive
      ? formulaTo.map((resource: any) => ({
          ...resource,
          count: Math.floor(resource.count * (hasExtractionEffect ? 1.2 : 1)),
        }))
      : formulaTo;

    return {
      isExtractive,
      displayFormulaTo,
    };
  }, [formulaTo, hasHigherExtractionYield, selectedGuild?.name, selectedPlant]);

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
    },
    processingMeta,
    handlers: {
      handleSelectGuild,
      handleSelectPlant,
      handleBack,
      calculateFrom,
      calculateTo,
    },
  };
};

export type ProcessingScreenLogic = ReturnType<typeof useProcessingScreenLogic>;
