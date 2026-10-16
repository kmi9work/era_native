/**
 * Обёртка над мутацией (ТЗ § 5): вызов API, затем точечная инвалидация и/или
 * запись ответа в кэш. Мутация не перезагружает всё — только затронутые ключи.
 */
import { useCallback, useRef, useState } from 'react';
import { normalizeError, type ApiError } from './apiErrors';
import type { QueryKey } from './keys';
import { queryClient } from './queryClient';

export interface MutationOptions<TArgs extends unknown[], TResult> {
  invalidate?: (result: TResult, ...args: TArgs) => QueryKey[];
  setData?: (result: TResult, ...args: TArgs) => Array<{ key: QueryKey; data: unknown }>;
  onSuccess?: (result: TResult, ...args: TArgs) => void;
  onError?: (error: ApiError, ...args: TArgs) => void;
}

export interface MutationState {
  isLoading: boolean;
  error: ApiError | undefined;
}

export function useMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>,
  options: MutationOptions<TArgs, TResult> = {},
) {
  const [state, setState] = useState<MutationState>({ isLoading: false, error: undefined });
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const fnRef = useRef(mutationFn);
  fnRef.current = mutationFn;

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setState({ isLoading: true, error: undefined });
    try {
      const result = await fnRef.current(...args);
      const { invalidate, setData, onSuccess } = optionsRef.current;
      if (setData) {
        for (const item of setData(result, ...args)) {
          queryClient.setQueryData(item.key, item.data);
        }
      }
      if (invalidate) {
        queryClient.invalidate(invalidate(result, ...args));
      }
      setState({ isLoading: false, error: undefined });
      if (onSuccess) onSuccess(result, ...args);
      return result;
    } catch (error) {
      const normalized = normalizeError(error);
      setState({ isLoading: false, error: normalized });
      if (optionsRef.current.onError) optionsRef.current.onError(normalized, ...args);
      return undefined;
    }
  }, []);

  return { mutate, isLoading: state.isLoading, error: state.error };
}
