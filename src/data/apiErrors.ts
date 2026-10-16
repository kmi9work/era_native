/**
 * Нормализация ошибок API (ТЗ Д8, § 5).
 *
 * Любая ошибка транспорта или HTTP-статуса превращается в ApiError с полем kind.
 * Раньше response-интерцептор `src/services/api.ts` возвращал error.response, из-за чего
 * промис РЕЗОЛВИЛСЯ при HTTP-ошибке и ответ 4xx/5xx уезжал в setState как успех.
 */

export type ApiErrorKind = 'network' | 'timeout' | 'http';

export interface ApiError {
  kind: ApiErrorKind;
  status?: number;
  message: string;
  payload?: unknown;
}

/** Реализация ApiError как Error — чтобы работали catch (e) { e.message } и e instanceof Error. */
export class ApiErrorException extends Error implements ApiError {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly payload?: unknown;
  /** Признак нормализованной ошибки (переживает сериализацию/пересоздание в тестах). */
  readonly isApiError = true;

  constructor(kind: ApiErrorKind, message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.payload = payload;
  }
}

export const isApiError = (error: unknown): error is ApiErrorException => {
  if (error instanceof ApiErrorException) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Partial<ApiError> & { isApiError?: boolean };
  return (
    candidate.isApiError === true ||
    candidate.kind === 'network' ||
    candidate.kind === 'timeout' ||
    candidate.kind === 'http'
  );
};

/** Прерванный запрос — это не ошибка: результат просто отбрасывается. */
export const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: string; code?: string };
  return candidate.name === 'AbortError' || candidate.name === 'CanceledError' || candidate.code === 'ERR_CANCELED';
};

const payloadMessage = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const data = payload as { message?: unknown; error?: unknown };
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  return undefined;
};

const statusMessage = (status: number): string => {
  if (status === 401 || status === 403) return 'Нет доступа к серверу (проверьте Basic Auth)';
  if (status === 404) return 'Данные не найдены на сервере';
  if (status === 422) return 'Сервер отклонил данные (422)';
  if (status >= 500) return `Ошибка сервера (${status})`;
  return `Ошибка запроса (${status})`;
};

/** Приводит любую ошибку к ApiError. Идемпотентна. */
export const normalizeError = (error: unknown): ApiErrorException => {
  if (isApiError(error)) return error as ApiErrorException;
  if (isAbortError(error)) {
    return new ApiErrorException('network', 'Запрос отменён', undefined, error);
  }

  const axiosError = error as {
    isAxiosError?: boolean;
    code?: string;
    message?: string;
    response?: { status?: number; data?: unknown };
  };

  if (axiosError?.response) {
    const status = axiosError.response.status ?? 0;
    const payload = axiosError.response.data;
    return new ApiErrorException('http', payloadMessage(payload) || statusMessage(status), status, payload);
  }

  if (axiosError?.code === 'ECONNABORTED' || axiosError?.code === 'ETIMEDOUT') {
    return new ApiErrorException('timeout', 'Сервер не ответил вовремя', undefined, error);
  }

  if (axiosError?.code === 'ERR_NETWORK' || !axiosError?.response) {
    const message = typeof axiosError?.message === 'string' && axiosError.message.length > 0
      ? axiosError.message
      : 'Нет соединения с сервером';
    return new ApiErrorException('network', message, undefined, error);
  }

  return new ApiErrorException('network', 'Неизвестная ошибка запроса', undefined, error);
};

/** «Нет связи» — сетевой сбой или таймаут. HTTP-ошибки связь не отменяют. */
export const isOffline = (error: unknown): boolean => {
  if (!error) return false;
  const kind = (error as Partial<ApiError>).kind;
  return kind === 'network' || kind === 'timeout';
};

export const getErrorMessage = (error: unknown, fallback = 'Неизвестная ошибка'): string => {
  if (isApiError(error)) return (error as ApiError).message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};
