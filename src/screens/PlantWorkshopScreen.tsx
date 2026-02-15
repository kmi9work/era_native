import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import ApiService from '../services/api';
import { Guild, AvailablePlaceInfo, PlantLevel, PlantPlace, Country, Resource } from '../types';
import ResourceItem from './ResourceItem';
import { BrotherPrinterService } from '../services/BrotherPrinterService';
import ScannerStatusBadge from '../components/ScannerStatusBadge';
import { useBarcodeScannerContext } from '../context/BarcodeScannerContext';
import CaravanService from '../services/CaravanService';
import { CONFIG } from '../config';
import { gameConfig } from '../config/game';

interface PlantWorkshopScreenProps {
  onClose: () => void;
  initialStep?: 'guild' | 'scenario' | 'newPlant' | 'upgrade' | 'market';
}

const PlantWorkshopScreen: React.FC<PlantWorkshopScreenProps> = ({ onClose, initialStep = 'guild' }) => {
  const [step, setStep] = useState<'guild' | 'scenario' | 'newPlant' | 'upgrade' | 'market'>(initialStep);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<any[]>([]);

  const { addListener } = useBarcodeScannerContext();
  const lastHandledBarcodeRef = useRef<string | null>(null);

  // Для нового предприятия
  const [availablePlaces, setAvailablePlaces] = useState<AvailablePlaceInfo[]>([]);
  // null = "Все", иначе id категории с бэка (PlantCategory)
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);
  const [selectedPlantType, setSelectedPlantType] = useState<AvailablePlaceInfo | null>(null);
  const [_plantLevels, setPlantLevels] = useState<PlantLevel[]>([]);
  const [firstLevel, setFirstLevel] = useState<PlantLevel | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlantPlace | null>(null);

  // Для улучшения
  const [plantId, setPlantId] = useState('');
  const [_plantInfo, setPlantInfo] = useState<any>(null);
  const [upgradeCost, setUpgradeCost] = useState<Record<string, number> | null>(null);
  const [guildPlants, setGuildPlants] = useState<any[]>([]);
  const [selectedPlantForUpgrade, setSelectedPlantForUpgrade] = useState<any>(null);

  // Для рынка
  const [marketGuilds, setMarketGuilds] = useState<Guild[]>([]);
  const [selectedMarketGuild, setSelectedMarketGuild] = useState<number | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
  const [marketResources, setMarketResources] = useState<{ off_market: Resource[]; to_market: Resource[] }>({ off_market: [], to_market: [] });
  const [resourcesPlSells, setResourcesPlSells] = useState<Array<{ identificator: string; count: number | null; name?: string }>>([]);
  const [resourcesPlBuys, setResourcesPlBuys] = useState<Array<{ identificator: string; count: number | null; name?: string }>>([]);
  const [showMarketForm, setShowMarketForm] = useState(false);
  const [viaVyatka, setViaVyatka] = useState(false);
  const [isCarProtected, setIsCarProtected] = useState(false);
  const [guildRobberyProbabilities, setGuildRobberyProbabilities] = useState<Record<number, { probability: number; robbed?: boolean }>>({});
  const [resToPlayer, setResToPlayer] = useState<Array<{ name: string; identificator: string; count: number }>>([]);
  const [totalPurchaseCost, setTotalPurchaseCost] = useState(0);
  const [totalSaleIncome, setTotalSaleIncome] = useState(0);
  const [caravanPending, setCaravanPending] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [newRelations, setNewRelations] = useState(false);
  const [contrabandConfirmed, setContrabandConfirmed] = useState(false);

  // Рынок без страны (Artel): нет выбора страны, ресурсы с country_id == null
  const isGameArtel = gameConfig.isActive('artel') || countries.length === 0;
  const selectedCountryObj = useMemo(
    () => (selectedCountry != null ? countries.find(c => c.id === selectedCountry) : undefined),
    [countries, selectedCountry],
  );
  const isEmbargoActiveForSelected = useMemo(() => {
    if (isGameArtel) return false;
    return (selectedCountryObj?.params?.embargo || 0) > 0;
  }, [isGameArtel, selectedCountryObj]);

  // Список категорий из ответа бэка (PlantCategory) — уникальные по id
  const plantCategoriesFromBackend = useMemo(() => {
    const seen = new Map<number, string>();
    availablePlaces.forEach(p => {
      if (p.plant_category_id != null && p.plant_category != null && !seen.has(p.plant_category_id)) {
        seen.set(p.plant_category_id, p.plant_category);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [availablePlaces]);

  useEffect(() => {
    loadGuilds();
    loadResources();
    if (initialStep === 'market') {
      loadMarketData().catch(error => {
        console.error('Ошибка загрузки данных рынка:', error);
      });
    }
  }, [initialStep, loadMarketData]);

  const loadGuilds = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getGuilds();
      // Сортируем гильдии по ID
      const sortedData = data.sort((a, b) => a.id - b.id);
      setGuilds(sortedData);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      const data = await ApiService.getAllResources();
      setResources(data);
    } catch (error: any) {}
  };

  const getResourceInfo = (identificator: string) => {
    const resource = resources.find(r => r.identificator === identificator);
    const baseURL = ApiService['api'].defaults.baseURL || 'http://192.168.1.101:3000';
    return {
      name: resource?.name || identificator,
      imageUrl: `${baseURL}/images/resources/${identificator}.png`
    };
  };

  const getClosedTechnologyNames = useCallback(
    (info?: AvailablePlaceInfo | null) =>
      (info?.technology_requirements || [])
        .filter(req => !req.open)
        .map(req => `«${req.name}»`),
    [],
  );

  const handleSelectGuild = (guild: Guild) => {
    setSelectedGuild(guild);
    setStep('scenario');
  };

  // Функция для загрузки предприятия по ID и перехода к улучшению
  const loadPlantAndNavigateToUpgrade = useCallback(async (plantId: string) => {
    try {
      const data = await ApiService.getPlant(parseInt(plantId));
      
      if (data && data.economic_subject_id) {
        const economicSubject = data.economic_subject;

        // Находим гильдию по ID (список мог ещё не успеть загрузиться)
        let guild = guilds.find(g => g.id === data.economic_subject_id);
        
        if (!guild && economicSubject) {
          const derivedGuild: Guild = {
            id: economicSubject.id ?? data.economic_subject_id,
            name: economicSubject.name || economicSubject.title || `Гильдия #${data.economic_subject_id}`,
          };
          guild = derivedGuild;
          setGuilds(prev => {
            const exists = prev.some(g => g.id === derivedGuild.id);
            return exists ? prev : [...prev, derivedGuild];
          });
        }

        if (guild) {
          setSelectedGuild(guild);
        } else {
          Alert.alert('Ошибка', 'Не удалось найти гильдию для предприятия');
          return;
        }
        
        // Устанавливаем данные предприятия
        setPlantInfo(data);
        setSelectedPlantForUpgrade(data);
        
        // Загружаем стоимость улучшения
        const plantTypeId = data.plant_level?.plant_type?.id;
        if (plantTypeId) {
          const levels = await ApiService.getPlantLevels(plantTypeId);
          const currentLevel = data.plant_level?.level || 1;
          const nextLevel = levels.find(l => l.level === currentLevel + 1);
          
          if (nextLevel) {
            setUpgradeCost(nextLevel.price);
          } else {
            Alert.alert('Информация', 'Предприятие уже максимального уровня');
            return;
          }
        }
        
        // Переходим к странице улучшения
        setStep('upgrade');
      } else {
        Alert.alert(
          'Ошибка', 
          'Не удалось загрузить данные предприятия',
          [
            {
              text: 'ОК',
              onPress: () => setStep('guild'),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Ошибка', 
        'Предприятие с таким ID не найдено',
        [
          {
            text: 'ОК',
            onPress: () => setStep('guild'),
          },
        ]
      );
    }
  }, [guilds]);

  // Обработчик завершения сканирования штрихкода
  const handleBarcodeScanned = useCallback((id: string) => {
    const enterpriseId = parseInt(id);
    console.log('[PlantWorkshopScreen] Scan received:', enterpriseId);
    setPlantId(enterpriseId.toString());
    loadPlantAndNavigateToUpgrade(enterpriseId.toString());
    setStep('upgrade'); // Переходим к экрану улучшения
  }, [loadPlantAndNavigateToUpgrade]);

  useEffect(() => {
    console.log('[PlantWorkshopScreen] Register listener');
    const unsubscribe = addListener('plantWorkshop', (code) => {
      console.log('[PlantWorkshopScreen] Listener triggered:', code, 'current step:', step);
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
      console.log('[PlantWorkshopScreen] Unregister listener');
      unsubscribe();
      lastHandledBarcodeRef.current = null;
    };
  }, [addListener, handleBarcodeScanned, step]);

  const handleSelectScenario = async (scenario: 'new' | 'upgrade' | 'market') => {
    if (scenario === 'new') {
      setLoading(true);
      try {
        const data = await ApiService.getAvailablePlaces();
        setAvailablePlaces(data);
        setStep('newPlant');
      } catch (error: any) {
        Alert.alert('Ошибка', error.message);
      } finally {
        setLoading(false);
      }
    } else if (scenario === 'upgrade') {
      // Загружаем предприятия гильдии
      if (selectedGuild) {
        setLoading(true);
        try {
          const plants = await ApiService.getGuildPlants(selectedGuild.id);
          const sortedPlants = plants.sort((a, b) => (a.id || 0) - (b.id || 0));
          setGuildPlants(sortedPlants);
        } catch (error: any) {
        } finally {
          setLoading(false);
        }
      }
      setStep('upgrade');
    } else if (scenario === 'market') {
      // Загружаем данные для рынка
      setLoading(true);
      try {
        await loadMarketData();
        setStep('market');
      } catch (error: any) {
        Alert.alert('Ошибка', error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Загрузка вероятностей ограбления
  const loadRobberyProbabilitiesForGuilds = useCallback(async (guilds: Guild[]) => {
    const probabilities: Record<number, { probability: number; robbed?: boolean }> = {};
    for (const guild of guilds) {
      try {
        const result = await ApiService.checkRobbery(guild.id);
        probabilities[guild.id] = {
          probability: result.probability || 0,
          robbed: result.robbed || false
        };
      } catch (error) {
        console.error(`Ошибка загрузки вероятности ограбления для гильдии ${guild.id}:`, error);
        probabilities[guild.id] = { probability: 0, robbed: false };
      }
    }
    setGuildRobberyProbabilities(probabilities);
  }, []);

  // Загрузка данных для рынка
  const loadMarketData = useCallback(async () => {
    try {
      const [guildsData, countriesData, resourcesData] = await Promise.all([
        ApiService.getGuildsList(),
        ApiService.getForeignCountries(),
        ApiService.getResourcesWithPrices()
      ]);

      setMarketGuilds(guildsData);
      setCountries(countriesData);
      CaravanService.setCountries(countriesData);

      if (resourcesData.prices) {
        setMarketResources(resourcesData.prices);
        CaravanService.setResources(resourcesData.prices);

        // Диагностика: если в Artel-режиме бэкенд отдаёт "обычные" цены со странами,
        // то на клиенте (где страны скрыты) ресурсы отфильтруются и получится пусто.
        if (gameConfig.isActive('artel')) {
          const toMarket = resourcesData.prices?.to_market ?? [];
          const offMarket = resourcesData.prices?.off_market ?? [];
          const hasCountrylessResources = [...toMarket, ...offMarket].some((res: any) => {
            return res?.country_id == null && (res?.country == null || res?.country?.id == null);
          });

          if (!hasCountrylessResources && (toMarket.length > 0 || offMarket.length > 0)) {
            Alert.alert(
              'Artel: рынок не настроен',
              'Бэкенд вернул цены со странами. Для Artel должны приходить ресурсы без страны (country=null). Перезапусти бэкенд в режиме Artel.'
            );
          }
        }
      }

      // Устанавливаем первую страну по умолчанию (для Artel стран нет — selectedCountry остаётся null)
      if (countriesData.length > 0) {
        setSelectedCountry(countriesData[0].id);
      }

      // Загружаем вероятности ограбления после установки гильдий
      await loadRobberyProbabilitiesForGuilds(guildsData);

      // Настраиваем polling: как в era_front — опрашиваем страны (отношения/эмбарго),
      // а цены обновляются вручную кнопкой "Обновить цены".
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      const interval = setInterval(async () => {
        try {
          const newCountries = await ApiService.getForeignCountries();
          setCountries(newCountries);
          CaravanService.setCountries(newCountries);
        } catch (error) {
          console.error('Ошибка обновления данных рынка:', error);
        }
      }, 30000); // 30 секунд
      setPollInterval(interval);
      setNewRelations(false);
      setContrabandConfirmed(false);
    } catch (error: any) {
      throw new Error(error.message || 'Ошибка загрузки данных рынка');
    }
  }, [loadRobberyProbabilitiesForGuilds, pollInterval]);

  const loadRobberyProbabilities = async () => {
    await loadRobberyProbabilitiesForGuilds(marketGuilds);
  };

  // Очистка polling при размонтировании
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  // Отслеживание изменений отношений и эмбарго
  const prevCountriesRef = useRef<Country[]>([]);
  useEffect(() => {
    if (prevCountriesRef.current.length === 0) {
      prevCountriesRef.current = countries;
      return;
    }

    // Проверяем изменения отношений (одним сообщением, как в era_front)
    const relationChanged = countries.some((country) => {
      const prevCountry = prevCountriesRef.current.find(c => c.id === country.id);
      return prevCountry && prevCountry.relations !== country.relations;
    });
    if (relationChanged) {
      setNewRelations(true);
      Alert.alert(
        'Изменение отношений!',
        'Отношения между странами изменились. Закройте рынок, обработайте все пришедшие караваны, обновите ценники, затем нажмите "Обновить цены".',
        [{ text: 'Закрыть' }],
      );
    }

    // Проверяем изменения эмбарго
    countries.forEach((country) => {
      const prevCountry = prevCountriesRef.current.find(c => c.id === country.id);
      if (prevCountry) {
        const prevEmbargo = prevCountry.params?.embargo || 0;
        const currentEmbargo = country.params?.embargo || 0;
        if (prevEmbargo !== currentEmbargo) {
          if (currentEmbargo > 0) {
            Alert.alert('Эмбарго введено!', `${country.name} ввела эмбарго против Руси!`);
          } else {
            Alert.alert('Эмбарго снято!', `${country.name} сняла эмбарго!`);
          }
        }
      }
    });

    prevCountriesRef.current = countries;
  }, [countries]);

  // Обновление массивов ресурсов при изменении страны (или при режиме «рынок без страны»)
  useEffect(() => {
    if (showMarketForm) {
      if (isGameArtel) {
        updateResourcesArrays(null);
      } else if (selectedCountry) {
        updateResourcesArrays(selectedCountry);
      }
    }
  }, [selectedCountry, showMarketForm, isGameArtel, updateResourcesArrays]);

  const handleSelectPlantType = async (plantTypeInfo: AvailablePlaceInfo) => {
    setSelectedPlantType(plantTypeInfo);
    setLoading(true);
    try {
      const levels = await ApiService.getPlantLevels(plantTypeInfo.plant_type_id);
      setPlantLevels(levels);
      const first = levels.find(l => l.level === 1);
      setFirstLevel(first || null);
      
      // Если только одно доступное место - выбираем его автоматически
      if (plantTypeInfo.available_places.length === 1) {
        setSelectedPlace(plantTypeInfo.available_places[0]);
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildPlant = async () => {
    // Если место не выбрано явно, но доступно только одно - используем его
    const placeToUse = selectedPlace || 
      (selectedPlantType && selectedPlantType.available_places.length === 1 
        ? selectedPlantType.available_places[0] 
        : null);

    if (!selectedGuild || !firstLevel || !placeToUse) {
      Alert.alert('Ошибка', 'Не все данные заполнены');
      return;
    }

    setLoading(true);
    let createdPlant: any = null;

    try {
      // Создаем предприятие
      createdPlant = await ApiService.createPlant({
        plant_level_id: firstLevel.id,
        plant_place_id: placeToUse.id,
        economic_subject: `${selectedGuild.id}_Guild`,
      });


      // Проверяем различные возможные форматы ответа
      let plantData = createdPlant;
      
      // Rails может возвращать данные в разных форматах
      if (createdPlant && createdPlant.plant) {
        plantData = createdPlant.plant;
      } else if (createdPlant && createdPlant.data) {
        plantData = createdPlant.data;
      } else {
        plantData = createdPlant;
      }

      // Проверяем, что мы получили корректный ответ
      if (!plantData || typeof plantData.id === 'undefined') {
        const errorMessage = 'Не удалось получить ID созданного предприятия';
        throw new Error(errorMessage);
      }

      // Получаем информацию о гильдии и регионе
      const guildName = selectedGuild?.name || 'Неизвестная гильдия';
      const regionName = placeToUse?.name || 'Неизвестный регион';
      
      // Пытаемся напечатать штрихкод с полной информацией
      const printResult = await BrotherPrinterService.printBarcode(plantData.id, guildName, regionName);
      
      if (printResult.success) {
        Alert.alert(
          'Успех',
          `Предприятие успешно построено!\nID: ${plantData.id}\nШтрихкод напечатан.`,
          [
            {
              text: 'ОК',
              onPress: () => {
                // Сброс состояния
                setSelectedPlantType(null);
                setFirstLevel(null);
                setSelectedPlace(null);
                setStep('guild');
              }
            },
            {
              text: 'Напечатать заново',
              onPress: () => {
                handleReprintBarcode(plantData.id, guildName, regionName);
                // Сброс состояния
                setSelectedPlantType(null);
                setFirstLevel(null);
                setSelectedPlace(null);
                setStep('guild');
              }
            }
          ]
        );
      } else {
        // Печать неудачна - предлагаем выбор
        // Не выводим ошибку в консоль для OpenStreamFailure
        if (!printResult.error || !printResult.error.includes('OpenStreamFailure')) {
          Alert.alert('Ошибка', printResult.error);
        }
        
        Alert.alert(
          'Ошибка печати',
          `Не удалось напечатать штрихкод: ${printResult.error}\n\nПроверьте настройки принтера.\n\nХотите всё равно создать предприятие без печати?`,
          [
            {
              text: 'Отменить',
              style: 'cancel',
              onPress: async () => {
                // Удаляем предприятие
                try {
                  await ApiService.deletePlant(plantData.id);
                } catch (deleteError: any) {}
              }
            },
            {
              text: 'Всё равно создать',
              onPress: () => {
                Alert.alert('Успех', `Предприятие создано!\nID: ${plantData.id}\n\nШтрихкод не был напечатан. Вы можете распечатать его позже.`);
                
                // Сброс состояния
                setSelectedPlantType(null);
                setFirstLevel(null);
                setSelectedPlace(null);
                setStep('guild');
              }
            }
          ],
          { cancelable: false }
        );
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось создать предприятие');
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPlant = async (id?: string) => {
    const idToLoad = id || plantId;
    if (!idToLoad.trim()) {
      Alert.alert('Ошибка', 'Введите ID предприятия');
      return;
    }

    setLoading(true);
    try {
      const data = await ApiService.getPlant(parseInt(idToLoad));
      
      console.log('Plant data received:', JSON.stringify(data, null, 2));
      
      // В ответе plant_type находится внутри plant_level
      let plantTypeId = data.plant_level?.plant_type?.id;
      const currentLevel = data.plant_level?.level || 1;
      
      // Если plant_type.id не найден, пытаемся найти из guildPlants
      if (!plantTypeId) {
        const plantFromList = guildPlants.find(p => p.id === parseInt(idToLoad));
        if (plantFromList?.plant_level?.plant_type?.id) {
          plantTypeId = plantFromList.plant_level.plant_type.id;
          console.log('Found plantTypeId from guildPlants:', plantTypeId);
        }
      }
      
      // Если все еще не найден, пытаемся использовать plant_level_id для получения типа
      if (!plantTypeId && data.plant_level_id) {
        // Пытаемся найти в уже загруженных данных
        const plantFromList = guildPlants.find(p => p.plant_level_id === data.plant_level_id);
        if (plantFromList?.plant_level?.plant_type?.id) {
          plantTypeId = plantFromList.plant_level.plant_type.id;
          console.log('Found plantTypeId from guildPlants by plant_level_id:', plantTypeId);
        }
      }
      
      if (!plantTypeId) {
        console.error('Cannot find plantTypeId. Data structure:', {
          plant_level: data.plant_level,
          plant_level_id: data.plant_level_id,
          guildPlants: guildPlants.map(p => ({ id: p.id, plant_level: p.plant_level }))
        });
        Alert.alert('Ошибка', 'Не удалось определить тип предприятия. Проверьте консоль для деталей.');
        return;
      }
      
      // Получить информацию о стоимости улучшения
      const levels = await ApiService.getPlantLevels(plantTypeId);
      const nextLevel = levels.find(l => l.level === currentLevel + 1);
      
      if (nextLevel) {
        // Переход на экран подтверждения
        setPlantInfo(data);
        setUpgradeCost(nextLevel.price);
        setSelectedPlantForUpgrade(data);
      } else {
        Alert.alert('Информация', 'Предприятие уже максимального уровня');
      }
    } catch (error: any) {
      console.error('Error loading plant:', error);
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlant = async (plant: any) => {
    const formattedId = plant.id.toString();
    setPlantId(formattedId);
    
    // Если у plant уже есть нужные данные, используем их
    const plantTypeId = plant.plant_level?.plant_type?.id;
    const currentLevel = plant.plant_level?.level || 1;
    
    if (plantTypeId) {
      // Используем данные из plant напрямую
      try {
        setLoading(true);
        const levels = await ApiService.getPlantLevels(plantTypeId);
        const nextLevel = levels.find(l => l.level === currentLevel + 1);
        
        if (nextLevel) {
          // Загружаем полные данные предприятия для отображения
          const fullData = await ApiService.getPlant(plant.id);
          setPlantInfo(fullData);
          setUpgradeCost(nextLevel.price);
          setSelectedPlantForUpgrade(fullData);
        } else {
          Alert.alert('Информация', 'Предприятие уже максимального уровня');
        }
      } catch (error: any) {
        console.error('Error loading plant levels:', error);
        // Fallback: используем handleLoadPlant
        handleLoadPlant(formattedId);
      } finally {
        setLoading(false);
      }
    } else {
      // Если данных нет, загружаем через API
      handleLoadPlant(formattedId);
    }
  };

  const handleDeletePlant = async (plant: any) => {
    Alert.alert(
      'Удаление предприятия',
      `Вы уверены, что хотите удалить "${plant.plant_level?.plant_type?.name}" (ID: ${plant.id})?\n\nЭто действие нельзя отменить.`,
      [
        {
          text: 'Отменить',
          style: 'cancel',
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await ApiService.deletePlant(plant.id);
              Alert.alert('Успех', 'Предприятие успешно удалено');
              
              // Обновляем список предприятий
              if (selectedGuild) {
                const plants = await ApiService.getGuildPlants(selectedGuild.id);
                const sortedPlants = plants.sort((a, b) => (a.id || 0) - (b.id || 0));
                setGuildPlants(sortedPlants);
              }
            } catch (error: any) {
              Alert.alert('Ошибка', error.message || 'Не удалось удалить предприятие');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleUpgradePlant = async () => {
    if (!selectedPlantForUpgrade?.id) {
      Alert.alert('Ошибка', 'Предприятие не выбрано');
      return;
    }

    setLoading(true);
    try {
      const result = await ApiService.upgradePlant(selectedPlantForUpgrade.id);
      Alert.alert('Успех', result.msg || 'Предприятие успешно улучшено!');
      
      // Сброс состояния и возврат к выбору гильдии
      setSelectedPlantForUpgrade(null);
      setPlantInfo(null);
      setUpgradeCost(null);
      setPlantId('');
      setStep('guild');
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReprintBarcode = async (plantId?: number, guildName?: string, regionName?: string) => {
    // Если параметры не переданы, используем данные из selectedPlantForUpgrade
    const plantIdToUse = plantId || selectedPlantForUpgrade?.id;
    const guildNameToUse = guildName || selectedGuild?.name || 'Неизвестная гильдия';
    
    // Получаем название региона из plant_place или используем переданное
    let regionNameToUse = regionName;
    if (!regionNameToUse && selectedPlantForUpgrade?.plant_place) {
      regionNameToUse = selectedPlantForUpgrade.plant_place.name || 
                       selectedPlantForUpgrade.plant_place.region_name || 
                       'Неизвестный регион';
    }
    if (!regionNameToUse) {
      regionNameToUse = 'Неизвестный регион';
    }

    if (!plantIdToUse) {
      Alert.alert('Ошибка', 'Не удалось определить ID предприятия');
      return;
    }

    setLoading(true);
    try {
      const printResult = await BrotherPrinterService.printBarcode(plantIdToUse, guildNameToUse, regionNameToUse);
      
      if (printResult.success) {
        Alert.alert('Успех', `Штрихкод успешно напечатан!\nID: ${plantIdToUse}`);
      } else {
        Alert.alert('Ошибка печати', printResult.error || 'Не удалось напечатать штрихкод');
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Ошибка при печати штрихкода');
    } finally {
      setLoading(false);
    }
  };

  // Обработчики для рынка
  const handleSelectGuildForMarket = async (guildId: number) => {
    setSelectedMarketGuild(guildId);
    setShowMarketForm(true);
    setContrabandConfirmed(false);

    if (isGameArtel) {
      updateResourcesArrays(null);
    } else if (selectedCountry) {
      updateResourcesArrays(selectedCountry);
    }
  };

  const handleBackToGuildSelection = () => {
    setSelectedMarketGuild(null);
    setShowMarketForm(false);
    setViaVyatka(false);
    setIsCarProtected(false);
    setContrabandConfirmed(false);
    handleResetMarketForm();
    loadRobberyProbabilities();
  };

  const updateResourcesArrays = useCallback((countryId: number | null) => {
    // При смене страны эмбарго/контрабанда подтверждается заново
    setContrabandConfirmed(false);
    const matchCountry = (res: Resource) =>
      countryId == null
        ? (res.country_id == null && res.country?.id == null)
        : (res.country_id === countryId || res.country?.id === countryId);

    const filteredToMarket = marketResources.to_market.filter(matchCountry);
    const sellsArray = filteredToMarket.map(item => ({
      identificator: item.identificator,
      count: null,
      name: item.name
    }));
    
    // Добавляем золото в resourcesPlSells (как в era_front)
    const goldItem = {
      identificator: 'gold',
      count: null,
      name: 'Золото'
    };
    sellsArray.push(goldItem);
    
    setResourcesPlSells(sellsArray);

    const filteredOffMarket = marketResources.off_market.filter(matchCountry);
    setResourcesPlBuys(
      filteredOffMarket.map(item => ({
        identificator: item.identificator,
        count: null,
        name: item.name
      }))
    );
  }, [marketResources.to_market, marketResources.off_market]);

  const handleCalculateCaravan = () => {
    const effectiveCountryId = isGameArtel ? null : selectedCountry;
    if ((effectiveCountryId == null && !isGameArtel) || !selectedMarketGuild) {
      Alert.alert('Ошибка', isGameArtel ? 'Выберите гильдию' : 'Выберите страну и гильдию');
      return;
    }

    try {
      const result = CaravanService.calculateCaravan(
        effectiveCountryId,
        resourcesPlSells,
        resourcesPlBuys
      );

      setResToPlayer(result.res_to_player);
      setTotalPurchaseCost(result.total_purchase_cost);
      setTotalSaleIncome(result.total_sale_income);

      const country = effectiveCountryId != null ? countries.find(c => c.id === effectiveCountryId) : null;
      const hasEmbargoNow = !!(country?.params?.embargo && country.params.embargo > 0);
      if (hasEmbargoNow && !contrabandConfirmed) {
        Alert.alert(
          'Эта страна ввела эмбарго против Руси!',
          'Для совершения операций с этой страной нужна Контрабанда. Есть карточка контрабанды?',
          [
            {
              text: 'Есть карточка контрабанды!',
              onPress: () => {
                setContrabandConfirmed(true);
                Alert.alert('ОК', 'Контрабанда подтверждена. Теперь можно зарегистрировать караван.');
              },
            },
            { text: 'Закрыть', style: 'cancel' },
          ],
        );
      }

      // Проверяем недостаток золота
      const goldPaid = resourcesPlSells.find(r => r.identificator === 'gold')?.count || 0;
      const netCost = result.total_purchase_cost - result.total_sale_income;
      const shortage = netCost > 0 ? netCost - Number(goldPaid) : 0;

      if (shortage > 0) {
        Alert.alert('Недостаточно золота', `Не хватает ${shortage} золота для покупки. Расчет выполнен, но караван не зарегистрирован.`);
        return;
      }

    } catch (error: any) {
      Alert.alert('Ошибка расчета', error.message);
    }
  };

  const handleShowConfirmDialog = () => {
    if (isEmbargoActiveForSelected && !contrabandConfirmed) {
      Alert.alert(
        'Эмбарго',
        'Для регистрации каравана по этой стране требуется подтвердить контрабанду (кнопка "Есть карточка контрабанды!" при расчёте).',
      );
      return;
    }
    const goldPaid = resourcesPlSells.find(r => r.identificator === 'gold')?.count || 0;
    const netCost = totalPurchaseCost - totalSaleIncome;
    const shortage = netCost > 0 ? netCost - Number(goldPaid) : 0;

    if (shortage > 0) {
      Alert.alert('Недостаточно золота', `Не хватает ${shortage} золота для покупки`);
      return;
    }
    handleRegisterCaravan();
  };

  const handleRegisterCaravan = async () => {
    const effectiveCountryId = isGameArtel ? null : selectedCountry;
    if ((effectiveCountryId == null && !isGameArtel) || !selectedMarketGuild) {
      Alert.alert('Ошибка', isGameArtel ? 'Выберите гильдию' : 'Выберите страну и гильдию');
      return;
    }
    if (isEmbargoActiveForSelected && !contrabandConfirmed) {
      Alert.alert('Эмбарго', 'Нельзя зарегистрировать караван без подтверждения контрабанды.');
      return;
    }

    setLoading(true);
    setCaravanPending(true);

    try {
      // Обогащаем incoming данными
      const enrichedIncoming = resourcesPlSells
        .filter(item => item.count && item.count > 0 && item.identificator !== 'gold')
        .map(item => {
          const resource = marketResources.to_market.find(
            r => r.identificator === item.identificator &&
                 (isGameArtel ? (r.country_id == null && r.country?.id == null) : (r.country_id === effectiveCountryId || r.country?.id === effectiveCountryId))
          );
          return {
            identificator: item.identificator || '',
            name: item.name || resource?.name || '',
            count: Number(item.count),
            current_sell_price: resource?.sell_price
          };
        });

      const enrichedOutcoming = resToPlayer
        .filter(item => item.identificator !== 'gold')
        .map(item => {
          const resource = marketResources.off_market.find(
            r => r.identificator === item.identificator &&
                 (isGameArtel ? (r.country_id == null && r.country?.id == null) : (r.country_id === effectiveCountryId || r.country?.id === effectiveCountryId))
          );
          return {
            identificator: item.identificator,
            name: item.name,
            count: item.count,
            current_buy_price: resource?.buy_price || 0
          };
        });

      const request = {
        country_id: effectiveCountryId,
        guild_id: selectedMarketGuild,
        incoming: enrichedIncoming,
        outcoming: enrichedOutcoming,
        purchase_cost: totalPurchaseCost,
        sale_income: totalSaleIncome,
        via_vyatka: viaVyatka,
        is_protected: isCarProtected
      };

      const response = await ApiService.registerCaravan(request);

      if (response.robbed) {
        Alert.alert('Караван ограблен', 'Караван был ограблен в пути');
        handleBackToGuildSelection();
      } else {
        Alert.alert('Успех', 'Караван успешно зарегистрирован!');
        handleBackToGuildSelection();
      }
    } catch (error: any) {
      if (error.robbed) {
        Alert.alert('Караван ограблен', error.error || 'Караван был ограблен в пути');
        handleBackToGuildSelection();
      } else {
        Alert.alert('Ошибка', error.message || 'Ошибка регистрации каравана');
      }
    } finally {
      setLoading(false);
      setCaravanPending(false);
    }
  };

  const handleResetMarketForm = () => {
    setResourcesPlSells(prev => prev.map(item => ({ ...item, count: null })));
    setResourcesPlBuys(prev => prev.map(item => ({ ...item, count: null })));
    setResToPlayer([]);
    setTotalPurchaseCost(0);
    setTotalSaleIncome(0);
    setContrabandConfirmed(false);
  };

  const getRobberyProbability = (guildId: number): string => {
    const prob = guildRobberyProbabilities[guildId];
    if (!prob || prob.probability === 0) return 'Защищена';
    return `${(prob.probability * 100).toFixed(1)}%`;
  };

  const hasEmbargo = (country: Country): boolean => {
    return (country.params?.embargo || 0) > 0;
  };

  const getResourceImageUrl = (identificator: string): string => {
    if (!identificator) {
      identificator = 'unknown';
    }
    return `${CONFIG.BACKEND_URL}/images/resources/${identificator}.png`;
  };

  const getCountryFlagUrl = (country: Country): string => {
    // Используем flag_image_name если есть, иначе пытаемся использовать name
    const flagName = country.flag_image_name || country.name;
    if (!flagName) {
      console.log('No flag name for country:', country);
      return '';
    }
    // Убираем расширение .png если оно есть, так как мы добавляем его ниже
    const cleanFlagName = flagName.replace(/\.png$/i, '').trim();
    if (!cleanFlagName) {
      console.log('Empty flag name after cleaning for country:', country);
      return '';
    }
    // Кодируем имя файла для URL (на случай пробелов или специальных символов)
    const encodedFlagName = encodeURIComponent(cleanFlagName);
    const url = `${CONFIG.BACKEND_URL}/images/countries/${encodedFlagName}.png`;
    console.log('Country flag URL:', country.name, flagName, '->', url);
    return url;
  };

  const getFilteredPlantTypes = () => {
    const filtered = filterCategoryId == null
      ? availablePlaces
      : availablePlaces.filter(p => p.plant_category_id === filterCategoryId);

    return filtered.sort((a, b) => {
      const aAvailable = a.available_places.length > 0 ? 1 : 0;
      const bAvailable = b.available_places.length > 0 ? 1 : 0;
      return bAvailable - aAvailable;
    });
  };

  const renderGuildSelection = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите гильдию</Text>
      <Text style={styles.stepSubtitle}>Или отсканируйте штрихкод для быстрого перехода к переработке</Text>
      
      <View style={styles.scanHintBlock}>
        <Text style={styles.scanHintText}>
          Сканер всегда активен. Отсканируйте штрихкод предприятия, и система сразу перейдёт к экрану
          улучшения с кнопкой «Улучшить».
        </Text>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <ScrollView>
          {guilds.map((guild) => (
            <TouchableOpacity
              key={guild.id}
              style={styles.itemButton}
              activeOpacity={0.7}
              onPress={() => handleSelectGuild(guild)}
            >
              <Text style={styles.itemButtonText}>{guild.name}</Text>
              <Text style={styles.itemButtonArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderScenarioSelection = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите действие</Text>
      
      <TouchableOpacity
        style={styles.scenarioButton}
        activeOpacity={0.7}
        onPress={() => handleSelectScenario('new')}
      >
        <Text style={styles.scenarioButtonIcon}>➕</Text>
        <View style={styles.scenarioButtonContent}>
          <Text style={styles.scenarioButtonText}>Новое предприятие</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.scenarioButton}
        activeOpacity={0.7}
        onPress={() => handleSelectScenario('upgrade')}
      >
        <Text style={styles.scenarioButtonIcon}>⬆️</Text>
        <View style={styles.scenarioButtonContent}>
          <Text style={styles.scenarioButtonText}>Улучшение предприятия</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.scenarioButton}
        activeOpacity={0.7}
        onPress={() => handleSelectScenario('market')}
      >
        <Text style={styles.scenarioButtonIcon}>💰</Text>
        <View style={styles.scenarioButtonContent}>
          <Text style={styles.scenarioButtonText}>Рынок</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderNewPlant = () => {
    if (!selectedPlantType) {
      const filteredPlants = getFilteredPlantTypes();
      
      return (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>Выберите тип предприятия</Text>
          
          {/* Фильтры по категориям с бэка (PlantCategory) */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, filterCategoryId === null && styles.filterButtonActive]}
              activeOpacity={0.7}
              onPress={() => setFilterCategoryId(null)}
            >
              <Text style={[styles.filterButtonText, filterCategoryId === null && styles.filterButtonTextActive]}>
                Все
              </Text>
            </TouchableOpacity>
            {plantCategoriesFromBackend.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.filterButton, filterCategoryId === cat.id && styles.filterButtonActive]}
                activeOpacity={0.7}
                onPress={() => setFilterCategoryId(cat.id)}
              >
                <Text style={[styles.filterButtonText, filterCategoryId === cat.id && styles.filterButtonTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#1976d2" />
          ) : (
            <ScrollView style={styles.plantTypesList}>
              {filteredPlants.map((plantType) => {
                const closedTechnologyNames = getClosedTechnologyNames(plantType);
                const hasAnyPlaces = plantType.available_places.length > 0;
                const hasAllowedPlaces = plantType.available_places.some((place) => place.allowed !== false);

                return (
                  <TouchableOpacity
                    key={plantType.plant_type_id}
                    style={[
                      styles.itemButton,
                      !hasAnyPlaces && styles.itemButtonDisabled
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectPlantType(plantType)}
                    disabled={!hasAnyPlaces}
                  >
                    <View style={styles.itemButtonContent}>
                      <Text style={[
                        styles.itemButtonText,
                        !hasAnyPlaces && styles.itemButtonTextDisabled
                      ]}>
                        {plantType.plant_type_name}
                      </Text>
                      {!hasAnyPlaces && (
                        <Text style={styles.forbiddenNotice}>
                          Нет свободных площадок — строительство временно недоступно
                        </Text>
                      )}
                      {hasAnyPlaces && !hasAllowedPlaces && (
                        <Text style={styles.forbiddenNotice}>
                          Нет площадок в землях Руси — строительство запрещено правилами. Продолжайте только по решению ведущего.
                        </Text>
                      )}
                      {closedTechnologyNames.length > 0 && (
                        <Text style={styles.forbiddenNotice}>
                          Технология {closedTechnologyNames.join(', ')} не открыта — строительство запрещено правилами
                        </Text>
                      )}
                    </View>
                    <Text style={styles.itemButtonArrow}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      );
    }

    // Если есть несколько доступных мест и место еще не выбрано
    if (selectedPlantType.available_places.length > 1 && !selectedPlace) {
      const closedTechnologyNames = getClosedTechnologyNames(selectedPlantType);

      return (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>{selectedPlantType.plant_type_name}</Text>

          {closedTechnologyNames.length > 0 && (
            <Text style={styles.forbiddenNotice}>
              Технология {closedTechnologyNames.join(', ')} не открыта — строительство запрещено правилами. Продолжайте только по решению ведущего.
            </Text>
          )}
          
          {firstLevel && (
            <View style={styles.costBlock}>
              <Text style={styles.costTitle}>Стоимость строительства:</Text>
              {Object.entries(firstLevel.price).map(([resource, amount]) => {
                const resourceInfo = getResourceInfo(resource);
                return (
                  <ResourceItem
                    key={resource}
                    identificator={resource}
                    name={resourceInfo.name}
                    count={amount as number}
                    imageUrl={resourceInfo.imageUrl}
                  />
                );
              })}
            </View>
          )}

          <Text style={styles.sectionTitle}>Выберите место строительства:</Text>
          <ScrollView style={styles.placesList}>
            {selectedPlantType.available_places.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={styles.itemButton}
                activeOpacity={0.7}
                onPress={() => setSelectedPlace(place)}
              >
                <View style={styles.itemButtonContent}>
                  <Text style={styles.itemButtonText}>{place.region_name}</Text>
                  {place.allowed === false && (
                    <Text style={styles.forbiddenNotice}>
                      Регион не принадлежит Руси — строительство запрещено правилами
                    </Text>
                  )}
                </View>
                <Text style={styles.itemButtonArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Определяем место для отображения
    const placeToShow = selectedPlace || 
      (selectedPlantType.available_places.length === 1 
        ? selectedPlantType.available_places[0] 
        : null);
    const closedTechnologyNames = getClosedTechnologyNames(selectedPlantType);

    return (
      <View style={styles.content}>
        <Text style={styles.stepTitle}>Подтверждение строительства</Text>
        
        <View style={styles.confirmBlock}>
          <Text style={styles.confirmLabel}>Тип предприятия:</Text>
          <Text style={styles.confirmValue}>{selectedPlantType.plant_type_name}</Text>
          
          <Text style={styles.confirmLabel}>Место строительства:</Text>
          <Text style={styles.confirmValue}>{placeToShow?.region_name || 'Не выбрано'}</Text>
        </View>

        {closedTechnologyNames.length > 0 && (
          <Text style={styles.forbiddenNotice}>
            Технология {closedTechnologyNames.join(', ')} не открыта — строительство запрещено правилами. Продолжайте только по решению ведущего.
          </Text>
        )}

        {placeToShow && placeToShow.allowed === false && (
          <Text style={styles.forbiddenNotice}>
            Регион не принадлежит Руси — строительство запрещено правилами. Продолжайте только по решению ведущего.
          </Text>
        )}

        {firstLevel && (
          <View style={styles.costBlock}>
            <Text style={styles.costTitle}>Стоимость:</Text>
            {Object.entries(firstLevel.price).map(([resource, amount]) => {
              const resourceInfo = getResourceInfo(resource);
              return (
                <ResourceItem
                  key={resource}
                  identificator={resource}
                  name={resourceInfo.name}
                  count={amount as number}
                  imageUrl={resourceInfo.imageUrl}
                />
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.7}
          onPress={handleBuildPlant}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Создание и печать...' : 'Построить'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderUpgrade = () => {
    // Если предприятие выбрано - показываем экран подтверждения
    if (selectedPlantForUpgrade && upgradeCost) {
      return (
        <View style={styles.content}>
          <View style={styles.costBlock}>
            <Text style={styles.costTitle}>Стоимость улучшения:</Text>
            {Object.entries(upgradeCost).map(([resource, amount]) => {
              const resourceInfo = getResourceInfo(resource);
              return (
                <ResourceItem
                  key={resource}
                  identificator={resource}
                  name={resourceInfo.name}
                  count={amount as number}
                  imageUrl={resourceInfo.imageUrl}
                />
              );
            })}
          </View>
          
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.7}
            onPress={handleUpgradePlant}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Улучшение...' : 'Улучшить'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, styles.secondaryButton, { marginTop: 10 }]}
            activeOpacity={0.7}
            onPress={() => handleReprintBarcode()}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>
              {loading ? 'Печать...' : 'Напечатать штрихкод заново'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Экран выбора предприятия
    return (
      <View style={styles.content}>
        <Text style={styles.stepTitle}>Улучшение предприятия</Text>

        {guildPlants.length > 0 && (
          <View style={styles.plantsListContainer}>
            <Text style={styles.sectionTitle}>Предприятия гильдии:</Text>
            <ScrollView style={styles.plantsListScroll}>
              {guildPlants.map((plant) => (
                <View key={plant.id} style={styles.plantItemContainer}>
                  <TouchableOpacity
                    style={styles.itemButton}
                    activeOpacity={0.7}
                    onPress={() => handleSelectPlant(plant)}
                  >
                    <View style={styles.itemButtonContent}>
                      <Text style={styles.itemButtonText}>
                        {plant.plant_level?.plant_type?.name || 'Предприятие'}
                      </Text>
                      <Text style={styles.itemButtonSubtext}>
                        Уровень {plant.plant_level?.level || '?'} • ID: {plant.id}
                      </Text>
                    </View>
                    <Text style={styles.itemButtonArrow}>›</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    activeOpacity={0.7}
                    onPress={() => handleDeletePlant(plant)}
                  >
                    <Text style={styles.deleteButtonIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const renderMarket = () => {
    if (loading && !showMarketForm && marketGuilds.length === 0) {
      return (
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      );
    }

    // Выбор гильдии
    if (!showMarketForm) {
      return (
        <ScrollView style={styles.content}>
          <Text style={styles.stepTitle}>Новый караван</Text>
          <Text style={styles.stepSubtitle}>Выберите гильдию для каравана:</Text>

          {!isGameArtel && (
            <View style={styles.marketCheckboxesContainer}>
              <View style={styles.marketCheckboxRow}>
                <TouchableOpacity
                  style={[styles.checkbox, viaVyatka && styles.checkboxChecked]}
                  onPress={() => setViaVyatka(!viaVyatka)}
                >
                  {viaVyatka && <Text style={styles.checkboxText}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>Караван идёт через Вятку</Text>
              </View>
              {viaVyatka && (
                <Text style={styles.checkboxHint}>
                  Караван не может быть ограблен. Отправка каравана не изменяет товарооборот.
                </Text>
              )}

              <View style={styles.marketCheckboxRow}>
                <TouchableOpacity
                  style={[styles.checkbox, isCarProtected && styles.checkboxChecked]}
                  onPress={() => setIsCarProtected(!isCarProtected)}
                >
                  {isCarProtected && <Text style={styles.checkboxText}>✓</Text>}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>Караван идёт под охраной</Text>
              </View>
            </View>
          )}

          <View style={styles.guildsListContainer}>
            {marketGuilds.map((guild) => (
              <View key={guild.id} style={styles.guildItemContainer}>
                <TouchableOpacity
                  style={styles.itemButton}
                  activeOpacity={0.7}
                  onPress={() => handleSelectGuildForMarket(guild.id)}
                >
                  <View style={styles.itemButtonContent}>
                    <Text style={styles.itemButtonText}>{guild.name}</Text>
                    {!isGameArtel && (
                      <Text
                        style={[
                          styles.guildRiskText,
                          guildRobberyProbabilities[guild.id]?.probability > 0
                            ? styles.guildRiskTextWarning
                            : styles.guildRiskTextSafe
                        ]}
                      >
                        Риск: {getRobberyProbability(guild.id)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.itemButtonArrow}>›</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      );
    }

    // Форма рынка
    return (
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Выбор страны (скрыт для Artel / рынок без страны) */}
        {!isGameArtel && (
        <View style={styles.countryButtonsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {countries.map((country) => (
              <TouchableOpacity
                key={country.id}
                style={[
                  styles.countryButton,
                  selectedCountry === country.id && styles.countryButtonSelected,
                  hasEmbargo(country) && styles.countryButtonEmbargo
                ]}
                onPress={() => {
                  setSelectedCountry(country.id);
                  updateResourcesArrays(country.id);
                }}
              >
                <Image
                  source={{ uri: getCountryFlagUrl(country) || `${CONFIG.BACKEND_URL}/images/countries/unknown.png` }}
                  style={styles.countryFlag}
                  resizeMode="contain"
                  onError={(e) => {
                    console.log('Error loading country flag:', {
                      country: country.name,
                      flag_image_name: country.flag_image_name,
                      url: getCountryFlagUrl(country),
                      error: e.nativeEvent?.error
                    });
                  }}
                  onLoad={() => {
                    console.log('Country flag loaded successfully:', {
                      country: country.name,
                      flag_image_name: country.flag_image_name,
                      url: getCountryFlagUrl(country)
                    });
                  }}
                />
                <Text style={styles.countryButtonText}>
                  {country.short_name || country.name}
                </Text>
                {hasEmbargo(country) && (
                  <Text style={styles.embargoLabel}>Эмбарго</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        )}

        {/* Форма "Игрок продает" */}
        <View style={styles.marketFormSection}>
          <Text style={styles.marketFormTitle}>
            {isGameArtel ? 'Игрок продаёт' : 'Игрок отправляет с караваном' + (viaVyatka ? ' (через Вятку)' : '')} 
          </Text>
          <View style={styles.resourcesInputContainer}>
            {resourcesPlSells.map((item, index) => {
              const resource = marketResources.to_market.find(
                r => r.identificator === item.identificator &&
                     (isGameArtel ? (r.country_id == null && r.country?.id == null) : (r.country_id === selectedCountry || r.country?.id === selectedCountry))
              );
              return (
                <View key={index} style={styles.resourceInputRow}>
                  <Image
                    source={{ uri: getResourceImageUrl(item.identificator) }}
                    style={styles.resourceIcon}
                  />
                  <TextInput
                    style={styles.resourceInput}
                    value={item.count?.toString() || ''}
                    onChangeText={(text) => {
                      const newSells = [...resourcesPlSells];
                      // Удаляем все символы, кроме цифр
                      const cleanedText = text.replace(/[^0-9]/g, '');
                      newSells[index].count = cleanedText ? Number(cleanedText) : null;
                      setResourcesPlSells(newSells);
                    }}
                    placeholder={`${item.name || ''} ${resource?.sell_price ? `по ${resource.sell_price}` : 'Золото'}`}
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Форма "Игрок заказал" */}
        <View style={styles.marketFormSection}>
          <Text style={styles.marketFormTitle}>
            {isGameArtel ? 'Игрок покупает' : 'Игрок заказал' + (viaVyatka ? ' (через Вятку)' : '')} 
          </Text>
          <View style={styles.resourcesInputContainer}>
            {resourcesPlBuys.map((item, index) => {
              const resource = marketResources.off_market.find(
                r => r.identificator === item.identificator &&
                     (isGameArtel ? (r.country_id == null && r.country?.id == null) : (r.country_id === selectedCountry || r.country?.id === selectedCountry))
              );
              return (
                <View key={index} style={styles.resourceInputRow}>
                  <Image
                    source={{ uri: getResourceImageUrl(item.identificator) }}
                    style={styles.resourceIcon}
                  />
                  <TextInput
                    style={styles.resourceInput}
                    value={item.count?.toString() || ''}
                    onChangeText={(text) => {
                      const newBuys = [...resourcesPlBuys];
                      // Удаляем все символы, кроме цифр
                      const cleanedText = text.replace(/[^0-9]/g, '');
                      newBuys[index].count = cleanedText ? Number(cleanedText) : null;
                      setResourcesPlBuys(newBuys);
                    }}
                    placeholder={`${item.name || ''} ${resource?.buy_price ? `по ${resource.buy_price}` : ''}`}
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Кнопки действий */}
        <View style={styles.marketActionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCalculateCaravan}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Расчет...' : 'Посчитать'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, styles.secondaryButton]}
            onPress={async () => {
              try {
                const resourcesData = await ApiService.getResourcesWithPrices();
                if (resourcesData.prices) {
                  setMarketResources(resourcesData.prices);
                  CaravanService.setResources(resourcesData.prices);
                  if (isGameArtel) {
                    updateResourcesArrays(null);
                  } else if (selectedCountry) {
                    updateResourcesArrays(selectedCountry);
                  }
                  setNewRelations(false);
                }
              } catch (error: any) {
                Alert.alert('Ошибка', error.message);
              }
            }}
            disabled={!newRelations}
          >
            <Text style={[styles.secondaryButtonText, !newRelations && { opacity: 0.6 }]}>
              Обновить цены
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#dc3545' }]}
            onPress={handleResetMarketForm}
          >
            <Text style={styles.primaryButtonText}>Очистить</Text>
          </TouchableOpacity>
        </View>

        {/* Результаты */}
        {resToPlayer.length > 0 && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsCardTitle}>Выдать игроку</Text>
            <View style={styles.resultsList}>
              {resToPlayer.map((item, index) => (
                <View key={index} style={styles.resultItem}>
                  <Image
                    source={{ uri: getResourceImageUrl(item.identificator) }}
                    style={styles.resultItemIcon}
                  />
                  <View style={styles.resultItemContent}>
                    <Text style={styles.resultItemName}>{item.name}</Text>
                    <Text style={styles.resultItemCount}>
                      Количество: {item.count}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            {totalPurchaseCost > 0 && (
              <Text style={styles.resultCost}>
                Стоимость покупки: {totalPurchaseCost}
              </Text>
            )}
            {totalSaleIncome > 0 && (
              <Text style={styles.resultIncome}>
                Выручка от продажи: {totalSaleIncome}
              </Text>
            )}
            {totalPurchaseCost > 0 || totalSaleIncome > 0 ? (
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 15 }]}
                onPress={handleShowConfirmDialog}
                disabled={loading || caravanPending}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Регистрация...' : 'Зарегистрировать караван'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    );
  };

  const handleBack = () => {
    if (step === 'guild') {
      onClose();
    } else if (step === 'scenario') {
      setStep('guild');
    } else if (step === 'newPlant') {
      if (selectedPlace) {
        setSelectedPlace(null);
      } else if (selectedPlantType) {
        setSelectedPlantType(null);
        setSelectedPlace(null);
      } else {
        setStep('scenario');
      }
    } else if (step === 'upgrade') {
      if (selectedPlantForUpgrade) {
        // Вернуться к выбору предприятия
        setSelectedPlantForUpgrade(null);
        setPlantInfo(null);
        setUpgradeCost(null);
      } else {
        setStep('scenario');
      }
    } else if (step === 'market') {
      if (showMarketForm) {
        // Вернуться к выбору гильдии
        handleBackToGuildSelection();
      } else {
        // Если открыт из настроек напрямую - закрываем, иначе возвращаемся к scenario
        if (initialStep === 'market') {
          onClose();
        } else {
          setStep('scenario');
        }
      }
    }
  };

  const renderHeader = () => {
    // Для экрана подтверждения улучшения - показываем информацию о предприятии
    if (step === 'upgrade' && selectedPlantForUpgrade) {
      const plantInfo = `${selectedPlantForUpgrade.plant_level?.plant_type?.name} • Ур. ${selectedPlantForUpgrade.plant_level?.level} • ${selectedGuild?.name} • ID: ${selectedPlantForUpgrade.id}`;
      
      return (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
            <Text style={styles.headerBackButtonText}>Назад</Text>
          </TouchableOpacity>
          <View style={styles.headerCenterRow}>
            <Text style={styles.titleInline}>Улучшение:</Text>
            <Text style={styles.headerInfoInline}>{plantInfo}</Text>
          </View>
          <View style={styles.headerRight}>
            <ScannerStatusBadge style={styles.headerBadge} />
          </View>
        </View>
      );
    }
    
    // Для рынка
    if (step === 'market') {
      return (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
            <Text style={styles.headerBackButtonText}>Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Рынок</Text>
          <View style={styles.headerRight}>
            <ScannerStatusBadge style={styles.headerBadge} />
          </View>
        </View>
      );
    }

    // Для остальных экранов - показываем гильдию если выбрана
    if (selectedGuild && step !== 'guild') {
      return (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
            <Text style={styles.headerBackButtonText}>Назад</Text>
          </TouchableOpacity>
          <View style={styles.headerCenterRow}>
            <Text style={styles.titleInline}>Предприятия:</Text>
            <Text style={styles.headerInfoInline}>{selectedGuild.name}</Text>
          </View>
          <View style={styles.headerRight}>
            <ScannerStatusBadge style={styles.headerBadge} />
          </View>
        </View>
      );
    }
    
    // Обычный заголовок для начального экрана
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Предприятия</Text>
        <View style={styles.headerRight}>
          <ScannerStatusBadge style={styles.headerBadge} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}

      {step === 'guild' && renderGuildSelection()}
      {step === 'scenario' && renderScenarioSelection()}
      {step === 'newPlant' && renderNewPlant()}
      {step === 'upgrade' && renderUpgrade()}
      {step === 'market' && renderMarket()}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    backgroundColor: '#1976d2',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 52,
    justifyContent: 'flex-end',
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerCenterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  titleInline: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 8,
  },
  headerInfoInline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollViewContent: {
    paddingBottom: 120, // Отступ для системных кнопок Android
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scanHintBlock: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  scanHintText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  plantTypesList: {
    flex: 1,
  },
  itemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 60,
  },
  itemButtonDisabled: {
    opacity: 0.4,
  },
  itemButtonSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#1976d2',
  },
  itemButtonContent: {
    flex: 1,
  },
  itemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemButtonSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  itemButtonTextDisabled: {
    color: '#999',
  },
  itemButtonArrow: {
    fontSize: 24,
    color: '#999',
  },
  forbiddenNotice: {
    marginTop: 6,
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '600',
  },
  scenarioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scenarioButtonIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  scenarioButtonContent: {
    flex: 1,
  },
  scenarioButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  costBlock: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    alignSelf: 'center',
    maxWidth: 400,
    minWidth: 300,
  },
  costTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  placesList: {
    flex: 1,
  },
  plantsListContainer: {
    flex: 1,
    marginBottom: 20,
  },
  plantsListScroll: {
    flex: 1,
  },
  confirmBlock: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'center',
    maxWidth: 400,
    minWidth: 300,
  },
  confirmLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  plantInfoBlock: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  plantInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  plantInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'center',
    maxWidth: 400,
    minWidth: 300,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
  headerBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerBackButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  plantItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 50,
    minHeight: 60,
  },
  deleteButtonIcon: {
    fontSize: 24,
  },
  // Стили для рынка
  marketCheckboxesContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  marketCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#1976d2',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1976d2',
  },
  checkboxText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  checkboxHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
    marginLeft: 34,
  },
  guildsListContainer: {
    marginTop: 10,
  },
  guildItemContainer: {
    marginBottom: 12,
  },
  guildRiskContainer: {
    marginTop: 4,
  },
  guildRiskText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  guildRiskTextSafe: {
    color: '#4caf50',
  },
  guildRiskTextWarning: {
    color: '#ff9800',
  },
  countryButtonsContainer: {
    marginBottom: 20,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    minWidth: 100,
  },
  countryButtonSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#e3f2fd',
  },
  countryButtonEmbargo: {
    borderColor: '#f44336',
  },
  countryFlag: {
    width: 32,
    height: 24,
    marginRight: 8,
    borderRadius: 4,
  },
  countryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  embargoLabel: {
    fontSize: 10,
    color: '#f44336',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  marketFormSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  marketFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  resourcesInputContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  resourceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    backgroundColor: '#fafafa',
  },
  resourceIcon: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  resourceInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#333',
  },
  marketActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  resultsCard: {
    padding: 15,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  resultsCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2e7d32',
  },
  resultsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 15,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    minWidth: 200,
  },
  resultItemIcon: {
    width: 48,
    height: 48,
    marginRight: 8,
  },
  resultItemContent: {
    flex: 1,
  },
  resultItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },
  resultItemCount: {
    fontSize: 14,
    color: '#1b5e20',
  },
  resultCost: {
    fontSize: 14,
    color: '#ff6f00',
    fontWeight: '600',
    marginTop: 8,
  },
  resultIncome: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
    marginTop: 4,
  },
});

export default PlantWorkshopScreen;
