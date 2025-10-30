// EXAMPLE: Это шаблонный файл для создания своего плагина
import { componentRegistry } from '../../../registry';
import { gameConfig } from '../../../config/game';

/**
 * Инициализация плагина Vassals and Robbers
 */
export const initVassalsAndRobbersPlugin = () => {
  if (!gameConfig.isActive('vassals-and-robbers')) {
    console.log('[Vassals and Robbers] Plugin not active, skipping...');
    return;
  }

  console.log('[Vassals and Robbers] Initializing plugin...');

  // TODO: Регистрация компонентов плагина
  // Пример:
  // import CustomPlantWorkshopScreen from './screens/CustomPlantWorkshopScreen';
  // componentRegistry.register('PlantWorkshopScreen', CustomPlantWorkshopScreen);

  // TODO: Регистрация сервисов
  // import { vassalsApi } from './services/vassalsApi';

  console.log('[Vassals and Robbers] Plugin initialized');
};

