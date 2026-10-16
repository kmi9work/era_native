import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { getErrorMessage } from '../../data/apiErrors';
import { useCountries } from '../../data/hooks/useCountries';
import { useGuilds } from '../../data/hooks/useGuilds';
import { refreshPricesNow, usePrices } from '../../data/hooks/usePrices';
import { useRobberyProbabilities, type RobberyProbability } from '../../data/hooks/useRobberyProbabilities';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import CaravanService from '../../services/CaravanService';
import ApiService from '../../services/api';
import { Country, Guild, Resource } from '../../types';
import { gameConfig } from '../../config/game';
import { CONFIG } from '../../config';
import { useMarketWatch } from './useMarketWatch';

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

const EMPTY_MARKET_RESOURCES: MarketResources = { off_market: [], to_market: [] };

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
  /** идёт первая загрузка данных рынка (спиннер вместо списка) */
  initialLoading: boolean;
  /** идёт любое фоновое обновление рынка */
  refreshing: boolean;
  /** цены изменились, пока открыта форма расчёта (Д7) */
  pricesChanged: boolean;
  /** нет связи с сервером — показаны последние данные */
  isOffline: boolean;
  updatedAt: number | undefined;
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

/**
 * Логика экрана рынка, переведённая на единый слой данных.
 *
 * Все данные приходят из слоя: гильдии (['guilds']), страны (['countries'], опрос 30 с),
 * цены (['prices'], опрос 60 с), вероятности ограбления (['robbery', id]).
 * Локальных setInterval и повторной загрузки «на монтирование» здесь больше нет,
 * дубль загрузки рынка (прежние два пути) удалён — остался один handleLoadMarketData.
 */
export const useMarketScreenLogic = (): UseMarketScreenLogicReturn => {
  const guildsQuery = useGuilds();
  const countriesQuery = useCountries();
  const pricesQuery = usePrices();

  const marketGuilds = useMemo(() => (guildsQuery.data as Guild[]) ?? [], [guildsQuery.data]);
  const countries = useMemo(() => (countriesQuery.data as Country[]) ?? [], [countriesQuery.data]);
  const marketResources: MarketResources = pricesQuery.data?.prices ?? EMPTY_MARKET_RESOURCES;

  const guildIds = useMemo(() => marketGuilds.map((guild) => guild.id), [marketGuilds]);
  const robbery = useRobberyProbabilities(guildIds);

  const [selectedMarketGuild, setSelectedMarketGuild] = useState<number | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null);
  const [resourcesPlSells, setResourcesPlSells] = useState<ResourceCount[]>([]);
  const [resourcesPlBuys, setResourcesPlBuys] = useState<ResourceCount[]>([]);
  const [showMarketForm, setShowMarketForm] = useState(false);
  const [viaVyatka, setViaVyatka] = useState(false);
  const [isCarProtected, setIsCarProtected] = useState(false);
  const [resToPlayer, setResToPlayer] = useState<ResToPlayer[]>([]);
  const [totalPurchaseCost, setTotalPurchaseCost] = useState(0);
  const [totalSaleIncome, setTotalSaleIncome] = useState(0);
  const [caravanPending, setCaravanPending] = useState(false);
  const [contrabandConfirmed, setContrabandConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Д6: режим игры определяется конфигом, а не длиной списка стран:
  // пустой или неудачный ответ по странам больше не переключает рынок в режим «без страны».
  const isGameArtel = gameConfig.isActive('artel');

  const watch = useMarketWatch(countries, pricesQuery.data?.prices, { formOpen: showMarketForm });
  const newRelations = watch.newRelations;
  const pricesChanged = watch.pricesChanged;

  // Вычисляемые значения
  const selectedCountryObj = useMemo(
    () => (selectedCountry != null ? countries.find(c => c.id === selectedCountry) : undefined),
    [countries, selectedCountry],
  );

  const isEmbargoActiveForSelected = useMemo(() => {
    if (isGameArtel) return false;
    return (selectedCountryObj?.params?.embargo || 0) > 0;
  }, [isGameArtel, selectedCountryObj]);

  // CaravanService — единственный потребитель цен и стран, и синхронизирует его теперь
  // только этот хук (раньше setCountries/setResources вызывались вручную в двух местах).
  useEffect(() => {
    CaravanService.setCountries(countries);
  }, [countries]);

  useEffect(() => {
    if (pricesQuery.data?.prices) {
      CaravanService.setResources(pricesQuery.data.prices);

      // Диагностика: если в Artel-режиме бэкенд отдаёт «обычные» цены со странами,
      // то на клиенте (где страны скрыты) ресурсы отфильтруются и получится пусто.
      if (gameConfig.isActive('artel')) {
        const toMarket = pricesQuery.data.prices?.to_market ?? [];
        const offMarket = pricesQuery.data.prices?.off_market ?? [];
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
  }, [pricesQuery.data]);

  // Страна по умолчанию: выбираем первую, когда список пришёл или прежний выбор исчез.
  // Выбор мастера при фоновом обновлении не сбрасывается.
  useEffect(() => {
    if (isGameArtel || countries.length === 0) return;
    if (selectedCountry != null && countries.some((country) => country.id === selectedCountry)) return;
    setSelectedCountry(countries[0].id);
  }, [countries, selectedCountry, isGameArtel]);

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
      name: item.name,
    }));

    // Добавляем золото в resourcesPlSells (как в era_front)
    sellsArray.push({
      identificator: 'gold',
      count: null,
      name: 'Золото',
    });

    setResourcesPlSells(sellsArray);

    const filteredOffMarket = marketResources.off_market.filter(matchCountry);
    setResourcesPlBuys(
      filteredOffMarket.map(item => ({
        identificator: item.identificator,
        count: null,
        name: item.name,
      })),
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

  // Вспомогательные функции для UI
  const getRobberyProbability = useCallback((guildId: number): string => {
    const prob = robbery.probabilities[guildId];
    if (!prob || prob.probability === 0) return 'Защищена';
    return `${(prob.probability * 100).toFixed(1)}%`;
  }, [robbery.probabilities]);

  const hasEmbargo = useCallback((country: Country): boolean => {
    return (country.params?.embargo || 0) > 0;
  }, []);

  const getImagesBaseUrl = useCallback((): string => {
    const base = (CONFIG.BACKEND_URL || ApiService.getBaseUrl()).replace(/\/+$/, '');
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
    return `${getImagesBaseUrl()}/images/countries/${encodedFlagName}.png`;
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

  /**
   * Полное обновление данных рынка (кнопка «Обновить цены»).
   * Кнопка активна всегда (гейт newRelations снят), запросы уходят через слой.
   */
  const handleLoadMarketData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        queryClient.refetch([queryKeys.guilds()], { force: true }),
        queryClient.refetch([queryKeys.countries()], { force: true }),
        queryClient.refetch([queryKeys.prices()], { force: true }),
      ]);
      await robbery.refetch();
      watch.acknowledge();
    } catch (error: any) {
      console.error('Ошибка обновления данных рынка:', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [robbery, watch]);

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
    // Вероятности ограбления могли измениться, пока считали караван — обновляем через слой.
    void robbery.refetch();
  }, [robbery, handleResetMarketForm]);

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
      Alert.alert('Ошибка расчета', getErrorMessage(error));
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
    handleRegisterCaravanRef.current();
  }, [isEmbargoActiveForSelected, contrabandConfirmed, resourcesPlSells, totalPurchaseCost, totalSaleIncome]);

  const handleRegisterCaravanInternal = useCallback(async () => {
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
      // Д7: перед регистрацией принудительно обновляем цены и, если итоговые цифры
      // разошлись с уже посчитанными, показываем расхождение и требуем пересчёта.
      const fresh = await refreshPricesNow();
      if (fresh?.prices) {
        CaravanService.setResources(fresh.prices);
        const recount = CaravanService.calculateCaravan(effectiveCountryId, resourcesPlSells, resourcesPlBuys);
        const diverged =
          recount.total_purchase_cost !== totalPurchaseCost || recount.total_sale_income !== totalSaleIncome;

        if (diverged) {
          Alert.alert(
            'Цены изменились',
            `На сервере другие цены: покупка ${recount.total_purchase_cost}, продажа ${recount.total_sale_income}. ` +
              `На экране было: покупка ${totalPurchaseCost}, продажа ${totalSaleIncome}. ` +
              'Нажмите «Посчитать» заново — регистрация отменена.',
            [{ text: 'Понятно' }],
          );
          return;
        }
      }

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
            current_sell_price: resource?.sell_price,
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
            current_buy_price: resource?.buy_price || 0,
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
        is_protected: isCarProtected,
      };

      const response = await ApiService.registerCaravan(request);

      if (response.robbed) {
        Alert.alert('Караван ограблен', 'Караван был ограблен в пути');
        handleBackToGuildSelectionRef.current();
      } else {
        Alert.alert('Успех', 'Караван успешно зарегистрирован!');
        handleBackToGuildSelectionRef.current();
      }
    } catch (error: any) {
      if (error?.robbed) {
        Alert.alert('Караван ограблен', error.error || 'Караван был ограблен в пути');
        handleBackToGuildSelectionRef.current();
      } else {
        Alert.alert('Ошибка', getErrorMessage(error, 'Ошибка регистрации каравана'));
      }
    } finally {
      setLoading(false);
      setCaravanPending(false);
    }
  }, [
    isGameArtel, selectedCountry, selectedMarketGuild, isEmbargoActiveForSelected,
    contrabandConfirmed, resourcesPlSells, resourcesPlBuys, resToPlayer, marketResources,
    totalPurchaseCost, totalSaleIncome, viaVyatka, isCarProtected,
  ]);

  // Ссылки для взаимных вызовов обработчиков (без пересоздания useCallback по кругу)
  const handleRegisterCaravanRef = useRef(handleRegisterCaravanInternal);
  handleRegisterCaravanRef.current = handleRegisterCaravanInternal;
  const handleBackToGuildSelectionRef = useRef(handleBackToGuildSelection);
  handleBackToGuildSelectionRef.current = handleBackToGuildSelection;

  const initialLoading = guildsQuery.isLoading || countriesQuery.isLoading || pricesQuery.isLoading;

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
    guildRobberyProbabilities: robbery.probabilities,
    resToPlayer,
    totalPurchaseCost,
    totalSaleIncome,
    caravanPending,
    newRelations,
    contrabandConfirmed,
    loading,
    initialLoading,
    refreshing: guildsQuery.isFetching || countriesQuery.isFetching || pricesQuery.isFetching,
    pricesChanged,
    isOffline: countriesQuery.isOffline || pricesQuery.isOffline || guildsQuery.isOffline,
    updatedAt: countriesQuery.updatedAt,
    isGameArtel,
    isEmbargoActiveForSelected,

    // Handlers
    handleSelectGuildForMarket,
    handleBackToGuildSelection,
    handleCalculateCaravan,
    handleShowConfirmDialog,
    handleRegisterCaravan: handleRegisterCaravanInternal,
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
