import axios from 'axios';
import { CONFIG } from '../config';
import { ApiErrorException, normalizeError } from '../data/apiErrors';
import type { Army, Country, Player, Region, Settlement } from '../types';

// Declare btoa for React Native compatibility
declare var btoa: (str: string) => string;

// Get backend URL from config
const getBackendUrl = () => {
  return CONFIG.BACKEND_URL;
};

const API_BASE_URL = getBackendUrl();

// Простая функция для Base64 кодирования (совместима с React Native)
const base64Encode = (str: string): string => {
  if (typeof btoa !== 'undefined') {
    return btoa(str);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : NaN;
    const c = i < str.length ? str.charCodeAt(i++) : NaN;

    const bitmap = (a << 16) | ((b || 0) << 8) | (c || 0);

    output += chars.charAt((bitmap >> 18) & 63);
    output += chars.charAt((bitmap >> 12) & 63);
    output += isNaN(b) ? '=' : chars.charAt((bitmap >> 6) & 63);
    output += isNaN(c) ? '=' : chars.charAt(bitmap & 63);
  }
  return output;
};

// Создаем Basic Auth заголовок
const getAuthHeader = () => {
  if (CONFIG.BASIC_AUTH?.username && CONFIG.BASIC_AUTH?.password) {
    const credentials = `${CONFIG.BASIC_AUTH.username}:${CONFIG.BASIC_AUTH.password}`;
    const base64Credentials = base64Encode(credentials);
    return `Basic ${base64Credentials}`;
  }
  return undefined;
};

class ApiService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withCredentials: true,
  });

  constructor() {
    // Добавляем Basic Auth заголовок ко всем запросам
    const authHeader = getAuthHeader();
    if (authHeader) {
      this.api.defaults.headers.common.Authorization = authHeader;
    }

    // Интерцептор для обработки запросов - добавляем Basic Auth если нужно
    this.api.interceptors.request.use(
      (config) => {
        const header = getAuthHeader();
        if (header && config.headers) {
          config.headers.Authorization = header;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Д8: интерцептор ОТКЛОНЯЕТ промис с нормализованной ошибкой ApiError.
    // Раньше здесь возвращался error.response, из-за чего HTTP-ошибка выглядела
    // как успешный ответ и ответы 4xx/5xx уезжали в setState.
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error instanceof ApiErrorException) return Promise.reject(error);
        return Promise.reject(normalizeError(error));
      }
    );
  }

  // Базовый URL единого клиента (для сборки путей к картинкам ресурсов/флагов)
  getBaseUrl(): string {
    return this.api.defaults.baseURL || '';
  }

  /**
   * Универсальный GET для игровых плагинов: те же baseURL, Basic Auth и
   * нормализация ошибок, что у остальных запросов клиента. Плагин не создаёт
   * второй axios и не дублирует авторизацию.
   */
  async get(path: string, config?: { signal?: AbortSignal }): Promise<any> {
    const response = await this.api.get(path, config);
    return response.data;
  }

  // Получить список всех гильдий
  async getGuilds(signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get('/guilds.json', { signal });
    return response.data;
  }

  // Получить предприятия гильдии
  async getGuildPlants(guildId: number, signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get(`/guilds/${guildId}.json`, { signal });
    return response.data.plants || [];
  }

  // Получить доступные места для строительства
  /**
   * Доступные места строительства. `guildId` уходит на бэкенд параметром: в
   * режиме many_teams по нему считается признак `allowed` — разрешение этой
   * гильдии строить и работать в государстве места.
   */
  async getAvailablePlaces(guildId?: number | null, signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get('/plant_places/available_places', {
      signal,
      params: guildId != null ? { guild_id: guildId } : undefined,
    });
    return response.data;
  }

  /**
   * @deprecated Оставлен для совместимости: тянет весь список /plant_levels.json и фильтрует
   * на клиенте. Новый код берёт уровни из кэша слоя (ключ ['plantLevels']).
   */
  async getPlantLevels(plantTypeId: number, signal?: AbortSignal): Promise<any[]> {
    const levels = await this.getAllPlantLevels(signal);
    return (levels || []).filter(
      (level: any) => (level.plant_type?.id ?? level.plant_type_id) === plantTypeId
    );
  }

  // Получить информацию о предприятии
  async getPlant(plantId: number, signal?: AbortSignal): Promise<any> {
    const response = await this.api.get(`/plants/${plantId}.json`, { signal });
    return response.data;
  }

  // Создать новое предприятие
  async createPlant(data: {
    plant_level_id: number;
    plant_place_id: number | null;
    economic_subject: string;
  }): Promise<any> {
    const response = await this.api.post('/plants.json', data);
    return response.data;
  }

  // Улучшить предприятие
  async upgradePlant(plantId: number): Promise<any> {
    const response = await this.api.patch(`/plants/${plantId}/upgrade`);
    return response.data;
  }

  // Уменьшить уровень предприятия
  async downgradePlant(plantId: number): Promise<any> {
    const response = await this.api.patch(`/plants/${plantId}/downgrade`);
    return response.data;
  }

  // Получить список всех ресурсов
  async getAllResources(signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get('/resources/show_all_resources', { signal });
    return response.data;
  }

  // Удалить предприятие (для отката при неудаче печати)
  async deletePlant(plantId: number): Promise<void> {
    await this.api.delete(`/plants/${plantId}.json`);
  }

  // Получить все уровни предприятий с формулами (для переработки)
  async getAllPlantLevels(signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get('/plant_levels.json', { signal });
    return response.data;
  }

  // Получить технологии государства (название, текст эффекта, факт открытия)
  async getTechnologies(signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get('/technologies.json', { signal });
    return response.data;
  }

  // Печать штрихкода для предприятия
  async printBarcode(plantId: number): Promise<{ success: boolean; error?: string }> {
    const response = await this.api.post(
      `/plants/${plantId}/print_barcode.json`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );
    return response.data;
  }

  // Получить активные эффекты для текущего года
  async getActiveLingeringEffects(signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get('/game_parameters/get_active_lingering_effects', { signal });
    return response.data.effects || [];
  }

  // Совместимость: получить эффекты гильдий через новый метод
  async getActiveGuildEffects(signal?: AbortSignal): Promise<any[]> {
    return this.getActiveLingeringEffects(signal);
  }

  // Получить список гильдий для рынка.
  // На живом бэкенде /guilds/list.json отдаёт побайтово тот же ответ, что /guilds.json
  // (проверено 2026-10-16), поэтому оба метода используют один ключ кэша ['guilds'].
  async getGuildsList(signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get('/guilds/list.json', { signal });
    return response.data;
  }

  // Получить список иностранных стран
  async getForeignCountries(signal?: AbortSignal): Promise<any[]> {
    const response = await this.api.get('/countries/foreign_countries.json', { signal });
    return response.data;
  }

  // Все армии игры (активные): экран «Сражения»
  async getArmies(signal?: AbortSignal): Promise<Army[]> {
    const response = await this.api.get('/armies.json', { signal });
    return response.data;
  }

  // Все государства игры (включая текущее): выбор города на экране «Сражения»
  async getCountries(signal?: AbortSignal): Promise<Country[]> {
    const response = await this.api.get('/countries.json', { signal });
    return response.data;
  }

  // Уничтожить армию (мягкое удаление на бэкенде: DELETE /armies/:id)
  async deleteArmy(armyId: number): Promise<void> {
    await this.api.delete(`/armies/${armyId}.json`);
  }

  /**
   * Передать регион государству — тот же вызов, что делает веб-админка
   * («Политика» → передача региона, `era_front/.../CaptureRegion.vue`):
   * `PATCH /regions/:id/captured_by.json?country_id=&how=`.
   * `how`: 1 — войной, 0 — миром. Бэкенд отвечает 204 без тела.
   * Бонус Великому князю (`grand_prince_bonus`) клиент не запрашивает: в вебе это
   * отдельный вопрос мастеру, здесь решение по умолчанию — без бонуса.
   */
  async captureRegion(regionId: number, countryId: number, byWar = true): Promise<void> {
    await this.api.patch(`/regions/${regionId}/captured_by.json`, null, {
      params: { country_id: countryId, how: byWar ? 1 : 0 },
    });
  }

  /**
   * Владелец города — тот же вызов, что в веб-админке
   * («Политика» → владение, `era_front/.../politics/Ownership.vue`):
   * `PATCH /settlements/:id.json?settlement[player_id]=<id>`.
   * `playerId = null` снимает владельца: веб передаёт пустой параметр, Rails
   * приводит пустую строку к NULL для целочисленной колонки.
   */
  async setSettlementOwner(settlementId: number, playerId: number | null): Promise<void> {
    await this.api.patch(`/settlements/${settlementId}.json`, null, {
      params: { settlement: { player_id: playerId ?? '' } },
    });
  }

  /** Все игроки игры: GET /players.json (нужны для назначения владельца города). */
  async getPlayers(signal?: AbortSignal): Promise<Player[]> {
    const response = await this.api.get('/players.json', { signal });
    return response.data;
  }

  // Все поселения (город/столица): для выбора места сражения
  async getSettlements(signal?: AbortSignal): Promise<Settlement[]> {
    const response = await this.api.get('/settlements.json', { params: { all: 1 }, signal });
    return response.data;
  }

  /**
   * Регионы с государством: страна поселения выводится из региона.
   * Бэкенд отдаёт их двумя непересекающимися наборами:
   * без параметра — свои земли, `?foreign=1` — чужие (в старых сборках параметр
   * `country_id` игнорируется, а `all=1` не поддерживается). Экран «Сражения»
   * запрашивает оба и склеивает: иначе город можно выбрать только в своей стране.
   */
  async getRegions(signal?: AbortSignal, foreign = false): Promise<Region[]> {
    const response = await this.api.get('/regions.json', {
      params: foreign ? { foreign: 1 } : undefined,
      signal,
    });
    return response.data;
  }

  // Получить ресурсы с ценами
  async getResourcesWithPrices(signal?: AbortSignal): Promise<{ prices: { off_market: any[]; to_market: any[] } }> {
    const response = await this.api.get('/resources/show_prices.json', { signal });
    return response.data;
  }

  // Проверить вероятность ограбления
  async checkRobbery(guildId: number, signal?: AbortSignal): Promise<{ probability: number; robbed?: boolean }> {
    const response = await this.api.get('/caravans/check_robbery.json', {
      params: { guild_id: guildId },
      signal,
    });
    return response.data;
  }

  // Зарегистрировать караван
  async registerCaravan(data: any): Promise<{ message?: string; caravan?: any; robbed?: boolean; error?: string }> {
    try {
      const response = await this.api.post('/caravans/register_caravan', data);
      return response.data;
    } catch (error) {
      const payload = (error as ApiErrorException)?.payload as { robbed?: boolean; error?: string } | undefined;
      if (payload?.robbed) {
        return { robbed: true, error: payload.error };
      }
      throw error;
    }
  }
}

export default new ApiService();
