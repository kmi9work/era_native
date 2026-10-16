/**
 * Тесты нормализации ошибок (ТЗ § 9, Д8).
 *
 * Проверяют, что HTTP-ошибки больше не выглядят как успешный ответ,
 * а транспортные сбои помечаются признаком «нет связи».
 */
import {
  ApiErrorException,
  getErrorMessage,
  isAbortError,
  isApiError,
  isOffline,
  normalizeError,
} from '../../src/data/apiErrors';
import ApiService from '../../src/services/api';

describe('apiErrors / normalizeError', () => {
  it('HTTP 500 превращается в ApiError{kind: http, status: 500}', () => {
    const error = normalizeError({ response: { status: 500, data: {} } });

    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(error.message).toContain('500');
    expect(isOffline(error)).toBe(false);
    expect(isApiError(error)).toBe(true);
  });

  it('HTTP 422 отдаёт сообщение из payload сервера', () => {
    const error = normalizeError({
      response: { status: 422, data: { message: 'Сначала закройте год' } },
    });

    expect(error.kind).toBe('http');
    expect(error.status).toBe(422);
    expect(error.message).toBe('Сначала закройте год');
    expect(error.payload).toEqual({ message: 'Сначала закройте год' });
  });

  it('таймаут (ECONNABORTED) — kind timeout и признак «нет связи»', () => {
    const error = normalizeError({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' });

    expect(error.kind).toBe('timeout');
    expect(isOffline(error)).toBe(true);
  });

  it('обрыв сети (ERR_NETWORK) — kind network и признак «нет связи»', () => {
    const error = normalizeError({ code: 'ERR_NETWORK', message: 'Network Error' });

    expect(error.kind).toBe('network');
    expect(error.message).toBe('Network Error');
    expect(isOffline(error)).toBe(true);
  });

  it('пустой/неизвестный объект ошибки не приводит к падению', () => {
    const error = normalizeError(undefined);
    expect(error.kind).toBe('network');
    expect(isOffline(error)).toBe(true);
  });

  it('normalizeError идемпотентна (не оборачивает ApiError повторно)', () => {
    const once = normalizeError({ response: { status: 503, data: {} } });
    const twice = normalizeError(once);
    expect(twice).toBe(once);
  });

  it('отменённый запрос распознаётся как abort, а не как ошибка данных', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError({ name: 'CanceledError' })).toBe(true);
    expect(isAbortError({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isAbortError(new ApiErrorException('http', 'boom', 500))).toBe(false);
  });

  it('getErrorMessage отдаёт текст ApiError и подставляет fallback', () => {
    expect(getErrorMessage(new ApiErrorException('http', 'Нет доступа', 403))).toBe('Нет доступа');
    expect(getErrorMessage('строка')).toBe('Неизвестная ошибка');
    expect(getErrorMessage(null, 'Своё сообщение')).toBe('Своё сообщение');
  });
});

describe('api.ts: интерцептор отклоняет HTTP-ошибки (Д8)', () => {
  const apiInstance = (ApiService as unknown as {
    api: { defaults: { adapter?: unknown } };
  }).api;

  const originalAdapter = apiInstance.defaults.adapter;

  afterEach(() => {
    apiInstance.defaults.adapter = originalAdapter;
  });

  it('getGuilds отклоняется с ApiError, а не резолвится ответом сервера', async () => {
    apiInstance.defaults.adapter = async (config: unknown) => {
      const response = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config,
        data: { message: 'Сервер упал' },
      };
      const error = Object.assign(new Error('Request failed with status code 500'), {
        isAxiosError: true,
        response,
        config,
      });
      throw error;
    };

    await expect(ApiService.getGuilds()).rejects.toMatchObject({
      kind: 'http',
      status: 500,
      message: 'Сервер упал',
    });
  });

  it('успешный ответ по-прежнему возвращает данные (правка интерцептора их не ломает)', async () => {
    apiInstance.defaults.adapter = async (config: unknown) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: [{ id: 1, name: 'Гильдия' }],
    });

    await expect(ApiService.getGuilds()).resolves.toEqual([{ id: 1, name: 'Гильдия' }]);
  });
});
