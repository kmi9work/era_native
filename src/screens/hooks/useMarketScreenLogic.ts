import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import ApiService from '../../services/api';
import CaravanService from '../../services/CaravanService';
import { Guild, Country, Resource } from '../../types';
import { gameConfig } from '../../config/game';
import { CONFIG } from '../../config';

interface MarketResources {
  off_market: Resource[];
  to_market: Resource[];
}

interface ResourceCount {
  identificator: string;
  count: number | null;
  name?: string;
}

interface ResToPlayer {
  name: string;
  identificator: string;
  count: number;
}

interface RobberyProbability {
  probability: number;
  robbed?: boolean;
}

export interface UseMarketScreenLogicReturn {
  // State
  marketGuilds: Guild[];
  selectedMarketGuild: number | null;
  countries: Country[];
  selectedCountry: number | null;
  marketResources: MarketResources;
  resourcesPlSells: ResourceCount[];
  resourcesPlBuys: ResourceCount[];
  showMarketForm: boolean;
  viaVyatka: boolean;
  isCarProtected: boolean;
  guildRobberyProbabilities: Record<number, RobberyProbability>;
  resToPlayer: ResToPlayer[];
  totalPurchaseCost: number;
  totalSaleIncome: number;
  caravanPending: boolean;
  newRelations: boolean;
  contrabandConfirmed: boolean;
  loading: boolean;
  isGameArtel: boolean;
  isEmbargoActiveForSelected: boolean;

  // Handlers
  handleSelectGuildForMarket: (guildId: number) => void;
  handleBackToGuildSelection: () => void;
  handleCalculateCaravan: () => void;
  handleShowConfirmDialog: () => void;
  handleRegisterCaravan: () => void;
  handleResetMarketForm: () => void;
  handleLoadMarketData: () => Promise<void>;
  setViaVyatka: (value: boolean) => void;
  setIsCarProtected: (value: boolean) => void;
  setContrabandConfirmed: (value: boolean) => void;
  setSelectedCountry: (value: number | null) => void;
  setResourcesPlSells: (updater: ResourceCount[] | ((prev: ResourceCount[]) => ResourceCount[])) => void;
  setResourcesPlBuys: (updater: ResourceCount[] | ((prev: ResourceCount[]) => ResourceCount[])) => void;
  updateResourcesArrays: (countryId: number | null) => void;
  setLoading: (value: boolean) => void;

  // UI helpers
  getRobberyProbability: (guildId: number) => string;
  hasEmbargo: (country: Country) => boolean;
  getResourceImageUrl: (identificator: string) => string;
  getCountryFlagUrl: (country: Country) => string;
  getImagesBaseUrl: () => string;
}

export const useMarketScreenLogic = (): UseMarketScreenLogicReturn => {
  // State
  const [marketGuilds, setMarketGuilds] = useState<Guild[]>([]);
  const [selectedMarketGuild, setSelectedMarketGuild] = useState<number | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
  const [marketResources, setMarketResources] = useState<MarketResources>({ off_market: [], to_market: [] });
  const [resourcesPlSells, setResourcesPlSells] = useState<ResourceCount[]>([]);
  const [resourcesPlBuys, setResourcesPlBuys] = useState<ResourceCount[]>([]);
  const [showMarketForm, setShowMarketForm] = useState(false);
  const [viaVyatka, setViaVyatka] = useState(false);
  const [isCarProtected, setIsCarProtected] = useState(false);
  const [guildRobberyProbabilities, setGuildRobberyProbabilities] = useState<Record<number, RobberyProbability>>({});
  const [resToPlayer, setResToPlayer] = useState<ResToPlayer[]>([]);
  const [totalPurchaseCost, setTotalPurchaseCost] = useState(0);
  const [totalSaleIncome, setTotalSaleIncome] = useState(0);
  const [caravanPending, setCaravanPending] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [newRelations, setNewRelations] = useState(false);
  const [contrabandConfirmed, setContrabandConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const prevCountriesRef = useRef<Country[]>([]);

  // Вычисляемые значения
  const isGameArtel = gameConfig.isActive('artel') || countries.length === 0;
  
  const selectedCountryObj = useMemo(
    () => (selectedCountry != null ? countries.find(c => c.id === selectedCountry) : undefined),
    [countries, selectedCountry],
  );

  const isEmbargoActiveForSelected = useMemo(() => {
    if (isGameArtel) return false;
    return (selectedCountryObj?.params?.embargo || 0) > 0;
  }, [isGameArtel, selectedCountryObj]);

  // Загрузка вероятностей ограбления
  const loadRobberyProbabilitiesForGuilds = useCallback(async (guildsList: Guild[]) => {
    const probabilities: Record<number, RobberyProbability> = {};
    for (const guild of guildsList) {
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
  const handleLoadMarketData = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [loadRobberyProbabilitiesForGuilds, pollInterval]);

  // Загрузка данных рынка при монтировании
  useEffect(() => {
    let cancelled = false;
    
    const loadData = async () => {
      console.log('[useMarketScreenLogic] Loading market data...');
      setLoading(true);
      try {
        console.log('[useMarketScreenLogic] Fetching guilds, countries, resources...');
        const [guildsData, countriesData, resourcesData] = await Promise.all([
          ApiService.getGuildsList(),
          ApiService.getForeignCountries(),
          ApiService.getResourcesWithPrices()
        ]);

        console.log('[useMarketScreenLogic] Raw data received:', {
          guildsCount: guildsData?.length || 0,
          countriesCount: countriesData?.length || 0,
          hasResources: !!resourcesData?.prices
        });

        if (cancelled) return;

        setMarketGuilds(guildsData);
        setCountries(countriesData);
        CaravanService.setCountries(countriesData);

        if (resourcesData.prices) {
          setMarketResources(resourcesData.prices);
          CaravanService.setResources(resourcesData.prices);

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

        if (countriesData.length > 0) {
          setSelectedCountry(countriesData[0].id);
        }

        // Загружаем вероятности ограбления
        const probabilities: Record<number, RobberyProbability> = {};
        for (const guild of guildsData) {
          try {
            const result = await ApiService.checkRobbery(guild.id);
            probabilities[guild.id] = {
              probability: result.probability || 0,
              robbed: result.robbed || false
            };
          } catch (error) {
            probabilities[guild.id] = { probability: 0, robbed: false };
          }
        }
        if (!cancelled) {
          setGuildRobberyProbabilities(probabilities);
        }

        // Настраиваем polling
        const interval = setInterval(async () => {
          try {
            const newCountries = await ApiService.getForeignCountries();
            setCountries(newCountries);
            CaravanService.setCountries(newCountries);
          } catch (error) {
            console.error('Ошибка обновления данных рынка:', error);
          }
        }, 30000);

        if (!cancelled) {
          setPollInterval(interval);
          setNewRelations(false);
          setContrabandConfirmed(false);
        }
      } catch (error: any) {
        if (!cancelled) {
          console.error('Ошибка загрузки данных рынка:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Очистка polling при размонтировании
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  // Отслеживание изменений отношений и эмбарго
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

  useEffect(() => {
    if (showMarketForm) {
      if (isGameArtel) {
        updateResourcesArrays(null);
      } else if (selectedCountry != null) {
        updateResourcesArrays(selectedCountry);
      }
    }
  }, [selectedCountry, showMarketForm, isGameArtel, updateResourcesArrays]);

  // Вспомогательные функции для UI (до обработчиков, чтобы избежать проблем с порядком)
  const getRobberyProbability = useCallback((guildId: number): string => {
    const prob = guildRobberyProbabilities[guildId];
    if (!prob || prob.probability === 0) return 'Защищена';
    return `${(prob.probability * 100).toFixed(1)}%`;
  }, [guildRobberyProbabilities]);

  const hasEmbargo = useCallback((country: Country): boolean => {
    return (country.params?.embargo || 0) > 0;
  }, []);

  const getImagesBaseUrl = useCallback((): string => {
    const base = (CONFIG.BACKEND_URL || '').replace(/\/+$/, '');
    return base.replace(/\/backend$/i, '');
  }, []);

  const getResourceImageUrl = useCallback((identificator: string): string => {
    if (!identificator) {
      identificator = 'unknown';
    }
    return `${getImagesBaseUrl()}/images/resources/${identificator}.png`;
  }, [getImagesBaseUrl]);

  const getCountryFlagUrl = useCallback((country: Country): string => {
    const flagName = country.flag_image_name || country.name;
    if (!flagName) {
      console.log('No flag name for country:', country);
      return '';
    }
    const cleanFlagName = flagName.replace(/\.png$/i, '').trim();
    if (!cleanFlagName) {
      console.log('Empty flag name after cleaning for country:', country);
      return '';
    }
    const encodedFlagName = encodeURIComponent(cleanFlagName);
    const url = `${getImagesBaseUrl()}/images/countries/${encodedFlagName}.png`;
    console.log('Country flag URL:', country.name, flagName, '->', url);
    return url;
  }, [getImagesBaseUrl]);

  // Обработчики для рынка
  const handleResetMarketForm = useCallback(() => {
    setResourcesPlSells(prev => prev.map(item => ({ ...item, count: null })));
    setResourcesPlBuys(prev => prev.map(item => ({ ...item, count: null })));
    setResToPlayer([]);
    setTotalPurchaseCost(0);
    setTotalSaleIncome(0);
    setContrabandConfirmed(false);
  }, []);

  const handleSelectGuildForMarket = useCallback((guildId: number) => {
    setSelectedMarketGuild(guildId);
    setShowMarketForm(true);
    setContrabandConfirmed(false);

    if (isGameArtel) {
      updateResourcesArrays(null);
    } else if (selectedCountry != null) {
      updateResourcesArrays(selectedCountry);
    }
  }, [isGameArtel, selectedCountry, updateResourcesArrays]);

  const handleBackToGuildSelection = useCallback(() => {
    setSelectedMarketGuild(null);
    setShowMarketForm(false);
    setViaVyatka(false);
    setIsCarProtected(false);
    setContrabandConfirmed(false);
    handleResetMarketForm();
    loadRobberyProbabilitiesForGuilds(marketGuilds);
  }, [marketGuilds, loadRobberyProbabilitiesForGuilds, handleResetMarketForm]);

  const handleCalculateCaravan = useCallback(() => {
    const effectiveCountryId = isGameArtel ? null : selectedCountry;
    if ((effectiveCountryId == null && !isGameArtel) || selectedMarketGuild == null) {
      Alert.alert('Ошибка', isGameArtel ? 'Выберите гильдию' : 'Выберите страну и гильдию');
      return;
    }

    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [isGameArtel, selectedCountry, selectedMarketGuild, resourcesPlSells, resourcesPlBuys, countries, contrabandConfirmed]);

  const handleShowConfirmDialog = useCallback(() => {
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
  }, [isEmbargoActiveForSelected, contrabandConfirmed, resourcesPlSells, totalPurchaseCost, totalSaleIncome]);

  const handleRegisterCaravan = useCallback(async () => {
    const effectiveCountryId = isGameArtel ? null : selectedCountry;
    if ((effectiveCountryId == null && !isGameArtel) || selectedMarketGuild == null) {
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
  }, [
    isGameArtel, selectedCountry, selectedMarketGuild, isEmbargoActiveForSelected,
    contrabandConfirmed, resourcesPlSells, resToPlayer, marketResources,
    totalPurchaseCost, totalSaleIncome, viaVyatka, isCarProtected,
    handleBackToGuildSelection
  ]);

  return {
    // State
    marketGuilds,
    selectedMarketGuild,
    countries,
    selectedCountry,
    marketResources,
    resourcesPlSells,
    resourcesPlBuys,
    showMarketForm,
    viaVyatka,
    isCarProtected,
    guildRobberyProbabilities,
    resToPlayer,
    totalPurchaseCost,
    totalSaleIncome,
    caravanPending,
    newRelations,
    contrabandConfirmed,
    loading,
    isGameArtel,
    isEmbargoActiveForSelected,

    // Handlers
    handleSelectGuildForMarket,
    handleBackToGuildSelection,
    handleCalculateCaravan,
    handleShowConfirmDialog,
    handleRegisterCaravan,
    handleResetMarketForm,
    handleLoadMarketData,
    setViaVyatka,
    setIsCarProtected,
    setContrabandConfirmed,
    setSelectedCountry,
    setResourcesPlSells,
    setResourcesPlBuys,
    updateResourcesArrays,
    setLoading,

    // UI helpers
    getRobberyProbability,
    hasEmbargo,
    getResourceImageUrl,
    getCountryFlagUrl,
    getImagesBaseUrl,
  };
};
