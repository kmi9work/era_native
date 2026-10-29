import { useMemo } from 'react';
import { queryKeys } from '../../../../data/keys';
import { useQuery, type QueryState } from '../../../../data/useQuery';
import {
  fetchMarketEmbargo,
  toEmbargoMap,
  type MarketEmbargoMap,
  type MarketEmbargoPayload,
} from '../services/marketEmbargo';

/**
 * TTL 20 с, опрос 60 с: эмбарго меняется действием мастера (политдействие
 * «Эмбарго на гильдию»), отметка на «Рынке» должна обновляться сама.
 * Опрос идёт только пока экран «Рынок» в фокусе (слой снимает подписку).
 */
export const MARKET_EMBARGO_TTL = 20_000;
export const MARKET_EMBARGO_POLL = 60_000;

export interface MarketEmbargoState extends QueryState<MarketEmbargoPayload> {
  /** «id страны → эмбарго наложено»; пустой объект — эмбарго нет / данных ещё нет. */
  embargoed: MarketEmbargoMap;
}

/**
 * Эмбарго на выбранную гильдию (many_teams). Ключ параметризован гильдией:
 * `['marketEmbargo', guildId]`. Без гильдии запроса нет — до выбора гильдии
 * карта неизвестна, и подсвечивать страны нечем.
 */
export const useMarketEmbargo = (guildId: number | null | undefined): MarketEmbargoState => {
  const query = useQuery<MarketEmbargoPayload>(
    queryKeys.marketEmbargo(guildId),
    (signal) =>
      guildId == null
        ? // Без гильдии эмбарго не определено: пустая карта вместо запроса
          // `/market?guild_id=null` (ключ всё равно регистрируется слоем).
          Promise.resolve<MarketEmbargoPayload>({ countries: [] })
        : fetchMarketEmbargo(guildId, signal),
    {
      ttl: MARKET_EMBARGO_TTL,
      pollInterval: MARKET_EMBARGO_POLL,
      refetchOnMount: 'if-stale',
      enabled: guildId != null,
    },
  );

  const embargoed = useMemo(() => toEmbargoMap(query.data), [query.data]);

  return { ...query, embargoed };
};
