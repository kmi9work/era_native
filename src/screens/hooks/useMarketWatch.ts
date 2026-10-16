import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { MarketPrices } from '../../data/hooks/usePrices';
import type { Country } from '../../types';

/**
 * Слежение за серверными изменениями на рынке (ТЗ Д7).
 *
 * Выделено из useMarketScreenLogic: сравнивает предыдущий и новый ответы по странам
 * (отношения, эмбарго) и по ценам, формирует Alert и флаги для экрана.
 * Данные приходят из слоя, поэтому срабатывает и опрос, и refetch-on-focus.
 */
export interface MarketWatchResult {
  /** отношения изменились — на экране подсвечиваем, что цены надо обновить */
  newRelations: boolean;
  /** цены изменились, пока форма расчёта открыта */
  pricesChanged: boolean;
  /** сброс флагов после явного обновления цен */
  acknowledge: () => void;
}

/** Текстовая подпись цен: identificator + страна + обе цены, отсортированная. */
const pricesSignature = (prices?: MarketPrices): string => {
  if (!prices) return '';
  const row = (resource: any) =>
    [
      resource?.identificator ?? '',
      resource?.country_id ?? resource?.country?.id ?? '',
      resource?.sell_price ?? '',
      resource?.buy_price ?? '',
    ].join('|');
  const offMarket = [...(prices.off_market || [])].map(row).sort();
  const toMarket = [...(prices.to_market || [])].map(row).sort();
  return `${offMarket.join(';')}#${toMarket.join(';')}`;
};

export const useMarketWatch = (
  countries: Country[],
  prices: MarketPrices | undefined,
  options: { formOpen?: boolean } = {},
): MarketWatchResult => {
  const formOpen = options.formOpen === true;
  const [newRelations, setNewRelations] = useState(false);
  const [pricesChanged, setPricesChanged] = useState(false);
  const prevCountriesRef = useRef<Country[] | null>(null);
  const prevPricesSignatureRef = useRef<string | null>(null);

  // Отношения и эмбарго — как в era_front (Exchange.vue)
  useEffect(() => {
    if (!countries || countries.length === 0) return;

    if (prevCountriesRef.current === null) {
      prevCountriesRef.current = countries;
      return;
    }

    const previous = prevCountriesRef.current;

    const relationChanged = countries.some((country) => {
      const prevCountry = previous.find(c => c.id === country.id);
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

    countries.forEach((country) => {
      const prevCountry = previous.find(c => c.id === country.id);
      if (!prevCountry) return;
      const prevEmbargo = prevCountry.params?.embargo || 0;
      const currentEmbargo = country.params?.embargo || 0;
      if (prevEmbargo !== currentEmbargo) {
        if (currentEmbargo > 0) {
          Alert.alert('Эмбарго введено!', `${country.name} ввела эмбарго против Руси!`);
        } else {
          Alert.alert('Эмбарго снято!', `${country.name} сняла эмбарго!`);
        }
      }
    });

    prevCountriesRef.current = countries;
  }, [countries]);

  // Цены: молча не подменяем — предупреждаем, пока открыта форма расчёта (Д7)
  useEffect(() => {
    const signature = pricesSignature(prices);
    if (!signature) return;

    if (prevPricesSignatureRef.current === null) {
      prevPricesSignatureRef.current = signature;
      return;
    }

    if (prevPricesSignatureRef.current !== signature) {
      prevPricesSignatureRef.current = signature;
      setPricesChanged(true);
      if (formOpen) {
        Alert.alert(
          'Цены изменились!',
          'Цены на ресурсы изменились на сервере. Посчитайте караван заново — иначе игрок получит другие цифры, чем на экране.',
          [{ text: 'Понятно' }],
        );
      }
    }
  }, [prices, formOpen]);

  const acknowledge = useCallback(() => {
    setNewRelations(false);
    setPricesChanged(false);
  }, []);

  // Стабильная ссылка на результат: экранные хуки держат watch в зависимостях useCallback.
  return useMemo(
    () => ({ newRelations, pricesChanged, acknowledge }),
    [newRelations, pricesChanged, acknowledge],
  );
};
