import axios from 'axios';
import { Player, AuthResponse } from '../types';
import { CONFIG } from '../config';

// Get backend URL from config
const getBackendUrl = () => {
  return CONFIG.BACKEND_URL;
};

const API_BASE_URL = getBackendUrl();

// Простая функция для Base64 кодирования (совместима с React Native)
const base64Encode = (str: string): string => {
  // Используем встроенный способ если доступен
  if (typeof btoa !== 'undefined') {
    return btoa(str);
  }
  // Fallback для React Native - используем простую реализацию
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
    timeout: 30000, // Увеличено для медленного соединения
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withCredentials: true, // Для поддержки сессий Rails
  });

  constructor() {
    // Добавляем Basic Auth заголовок ко всем запросам
    const authHeader = getAuthHeader();
    if (authHeader) {
      this.api.defaults.headers.common['Authorization'] = authHeader;
    }

    // Интерцептор для обработки запросов - добавляем Basic Auth если нужно
    this.api.interceptors.request.use(
      (config) => {
        const authHeader = getAuthHeader();
        if (authHeader && config.headers) {
          config.headers['Authorization'] = authHeader;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Интерцептор для обработки ответов
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        return error.response;
      }
    );
  }

  // Аутентификация
  async login(identificator: string): Promise<AuthResponse> {
    try {
      // Для тестирования - используем фиктивные данные
      if (identificator.includes('КУПЕЦ') || identificator.includes('РЮРИКОВИЧ') || identificator.includes('АКСАКОВ')) {
        const mockPlayer: Player = {
          id: 1,
          name: identificator.includes('КУПЕЦ') ? 'КУПЕЦ' : 
                identificator.includes('РЮРИКОВИЧ') ? 'РЮРИКОВИЧ' : 'АКСАКОВ',
          identificator: identificator,
          player_type: identificator.includes('КУПЕЦ') ? 'Купец' : 'Знать',
          family: identificator.includes('КУПЕЦ') ? 'Торговцы' : 'Дворяне',
          jobs: identificator.includes('КУПЕЦ') ? ['Глава гильдии'] : ['Великий князь']
        };
        
        return {
          success: true,
          player: mockPlayer
        };
      }

      // Реальная аутентификация через API
      const response = await this.api.post('/auth/login', { identificator });
      return response.data;
    } catch (error: any) {
      // Если API недоступен, используем фиктивные данные
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        const mockPlayer: Player = {
          id: 1,
          name: 'Тестовый игрок',
          identificator: identificator,
          player_type: 'Знать',
          family: 'Тестовая семья',
          jobs: ['Тестовая должность']
        };
        
        return {
          success: true,
          player: mockPlayer
        };
      }
      
      throw new Error(error.response?.data?.message || 'Ошибка входа');
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
    }
  }

  async getCurrentPlayer(): Promise<Player | null> {
    try {
      const response = await this.api.get('/auth/current_player');
      return response.data.player || response.data;
    } catch (error: any) {
      return null;
    }
  }

  // Получить список всех гильдий
  async getGuilds(): Promise<any[]> {
    try {
      const response = await this.api.get('/guilds.json');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения списка гильдий');
    }
  }

  // Получить предприятия гильдии
  async getGuildPlants(guildId: number): Promise<any[]> {
    try {
      const response = await this.api.get(`/guilds/${guildId}.json`);
      return response.data.plants || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения предприятий гильдии');
    }
  }

  // Получить доступные места для строительства
  async getAvailablePlaces(): Promise<any[]> {
    try {
      const response = await this.api.get('/plant_places/available_places');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения доступных мест');
    }
  }

  // Получить уровни предприятий по типу
  async getPlantLevels(plantTypeId: number): Promise<any[]> {
    try {
      const response = await this.api.get('/plant_levels.json');
      const levels = response.data.filter((level: any) => level.plant_type?.id === plantTypeId);
      return levels;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения уровней предприятий');
    }
  }

  // Получить информацию о предприятии
  async getPlant(plantId: number): Promise<any> {
    try {
      const response = await this.api.get(`/plants/${plantId}.json`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения информации о предприятии');
    }
  }

  // Создать новое предприятие
  async createPlant(data: {
    plant_level_id: number;
    plant_place_id: number;
    economic_subject: string; // формат: "{guild_id}_Guild"
  }): Promise<any> {
    try {
      const response = await this.api.post('/plants.json', data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка создания предприятия');
    }
  }

  // Улучшить предприятие
  async upgradePlant(plantId: number): Promise<any> {
    try {
      const response = await this.api.patch(`/plants/${plantId}/upgrade`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка улучшения предприятия');
    }
  }

  // Получить список всех ресурсов
  async getAllResources(): Promise<any[]> {
    try {
      const response = await this.api.get('/resources/show_all_resources');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения ресурсов');
    }
  }

  // Удалить предприятие (для отката при неудаче печати)
  async deletePlant(plantId: number): Promise<void> {
    try {
      await this.api.delete(`/plants/${plantId}.json`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка удаления предприятия');
    }
  }

  // Получить все уровни предприятий с формулами (для переработки)
  async getAllPlantLevels(): Promise<any[]> {
    try {
      const response = await this.api.get('/plant_levels/prod_info_full.json');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения уровней предприятий');
    }
  }

  // Печать штрихкода для предприятия
  async printBarcode(plantId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.api.post(`/plants/${plantId}/print_barcode.json`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка печати штрихкода');
    }
  }

  // Получить активные эффекты для текущего года
  async getActiveLingeringEffects(): Promise<any[]> {
    try {
      const response = await this.api.get('/game_parameters/get_active_lingering_effects');
      return response.data.effects || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения эффектов гильдий');
    }
  }
}

export default new ApiService();