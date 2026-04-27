import axios from 'axios';
import { Player } from '../types';

const API_BASE_URL = 'http://192.168.1.38:3000';

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
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        return error.response;
      }
    );
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
    plant_place_id: number | null;
    economic_subject: string;
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
      const response = await this.api.get('/plant_levels.json');
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

  // Совместимость: получить эффекты гильдий через новый метод
  async getActiveGuildEffects(): Promise<any[]> {
    return this.getActiveLingeringEffects();
  }

  // Получить список гильдий для рынка
  async getGuildsList(): Promise<any[]> {
    try {
      const response = await this.api.get('/guilds/list.json');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения списка гильдий');
    }
  }

  // Получить список иностранных стран
  async getForeignCountries(): Promise<any[]> {
    try {
      const response = await this.api.get('/countries/foreign_countries.json');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения списка стран');
    }
  }

  // Получить ресурсы с ценами
  async getResourcesWithPrices(): Promise<{ prices: { off_market: any[]; to_market: any[] } }> {
    try {
      const response = await this.api.get('/resources/show_prices.json');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка получения ресурсов с ценами');
    }
  }

  // Проверить вероятность ограбления
  async checkRobbery(guildId: number): Promise<{ probability: number; robbed?: boolean }> {
    try {
      const response = await this.api.get('/caravans/check_robbery.json', {
        params: { guild_id: guildId }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка проверки ограбления');
    }
  }

  // Зарегистрировать караван
  async registerCaravan(data: any): Promise<{ message?: string; caravan?: any; robbed?: boolean; error?: string }> {
    try {
      const response = await this.api.post('/caravans/register_caravan', data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.robbed) {
        return { robbed: true, error: error.response.data.error };
      }
      throw new Error(error.response?.data?.message || error.response?.data?.error || 'Ошибка регистрации каравана');
    }
  }
}

export default new ApiService();
