import axios from 'axios';
import { Player, AuthResponse } from '../types';
import { CONFIG } from '../config';

// Get backend URL from config
const getBackendUrl = () => {
  return CONFIG.BACKEND_URL;
};

const API_BASE_URL = getBackendUrl();

class ApiService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withCredentials: true, // Для поддержки сессий Rails
  });

  constructor() {
    // Интерцептор для обработки ответов
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.message);
        return Promise.reject(error);
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
      console.error('Logout error:', error);
    }
  }

  async getCurrentPlayer(): Promise<Player | null> {
    try {
      const response = await this.api.get('/auth/current_player');
      return response.data.player || response.data;
    } catch (error) {
      console.error('Get current player error:', error);
      return null;
    }
  }

  // Получить список всех гильдий
  async getGuilds(): Promise<any[]> {
    try {
      const response = await this.api.get('/guilds.json');
      return response.data;
    } catch (error: any) {
      console.error('Get guilds error:', error);
      throw new Error(error.response?.data?.message || 'Ошибка получения списка гильдий');
    }
  }

  // Получить предприятия гильдии
  async getGuildPlants(guildId: number): Promise<any[]> {
    try {
      const response = await this.api.get(`/guilds/${guildId}.json`);
      return response.data.plants || [];
    } catch (error: any) {
      console.error('Get guild plants error:', error);
      throw new Error(error.response?.data?.message || 'Ошибка получения предприятий гильдии');
    }
  }

  // Получить доступные места для строительства
  async getAvailablePlaces(): Promise<any[]> {
    try {
      const response = await this.api.get('/plant_places/available_places');
      return response.data;
    } catch (error: any) {
      console.error('Get available places error:', error);
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
      console.error('Get plant levels error:', error);
      throw new Error(error.response?.data?.message || 'Ошибка получения уровней предприятий');
    }
  }

  // Получить информацию о предприятии
  async getPlant(plantId: number): Promise<any> {
    try {
      const response = await this.api.get(`/plants/${plantId}.json`);
      return response.data;
    } catch (error: any) {
      console.error('Get plant error:', error);
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
      console.log('=== API SERVICE DEBUG ===');
      console.log('Sending data:', data);
      
      const response = await this.api.post('/plants.json', { plant: data }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error: any) {
      console.error('Create plant error:', error);
      throw new Error(error.response?.data?.message || 'Ошибка создания предприятия');
    }
  }

  // Улучшить предприятие
  async upgradePlant(plantId: number): Promise<any> {
    try {
      const response = await this.api.patch(`/plants/${plantId}/upgrade`);
      return response.data;
    } catch (error: any) {
      console.error('Upgrade plant error:', error);
      throw new Error(error.response?.data?.message || 'Ошибка улучшения предприятия');
    }
  }

  // Получить список всех ресурсов
  async getAllResources(): Promise<any[]> {
    try {
      const response = await this.api.get('/resources/show_all_resources');
      return response.data;
    } catch (error: any) {
      console.error('Get resources error:', error);
      throw new Error(error.response?.data?.message || 'Ошибка получения ресурсов');
    }
  }

  // Удалить предприятие (для отката при неудаче печати)
  async deletePlant(plantId: number): Promise<void> {
    try {
      await this.api.delete(`/plants/${plantId}.json`);
    } catch (error: any) {
      console.error('Delete plant error:', error);
      throw new Error(error.response?.data?.message || 'Ошибка удаления предприятия');
    }
  }

  // Получить все уровни предприятий с формулами (для переработки)
  async getAllPlantLevels(): Promise<any[]> {
    try {
      const response = await this.api.get('/plant_levels/prod_info_full.json');
      return response.data;
    } catch (error: any) {
      console.error('Get plant levels error:', error);
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
      console.error('Print barcode error:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Ошибка печати штрихкода'
      };
    }
  }
}

export default new ApiService();