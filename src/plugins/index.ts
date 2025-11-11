// Импорт плагинов
import { initVassalsAndRobbersPlugin } from './game-plugins/vassals-and-robbers';

/**
 * Инициализирует все плагины
 */
export const initializePlugins = () => {
  const initializers = [initVassalsAndRobbersPlugin];

  initializers.forEach((initializer) => {
    initializer();
  });
};

