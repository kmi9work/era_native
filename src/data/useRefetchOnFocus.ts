/**
 * Refetch-on-focus (ТЗ Д5): один слушатель фокуса на экран в одном месте.
 *
 * Обёртка над useFocusEffect из @react-navigation/native: при получении фокуса
 * переданные ключи помечаются «в фокусе» (это включает опрос, Д4) и обновляются
 * принудительно; при потере фокуса опрос снимается.
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { type QueryKey } from './keys';
import { queryClient } from './queryClient';

export function useRefetchOnFocus(keys: Array<QueryKey | null | undefined>): void {
  const keysRef = useRef<Array<QueryKey | null | undefined>>(keys);
  keysRef.current = keys;

  // Пустые зависимости: актуальные ключи читаются из ref, а обработчик выполняется
  // один раз на каждое получение фокуса (весь смысл Д5) и снимается при потере фокуса.
  useFocusEffect(
    useCallback(() => {
      const activeKeys = keysRef.current.filter((key): key is QueryKey => !!key);
      if (activeKeys.length === 0) return undefined;

      activeKeys.forEach((key) => queryClient.setFocused(key, 1));
      void queryClient.refetch(activeKeys, { force: true });

      return () => {
        activeKeys.forEach((key) => queryClient.setFocused(key, -1));
      };
    }, []),
  );
}
