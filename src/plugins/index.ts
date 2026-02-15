// Импорт плагинов
import { initVassalsAndRobbersPlugin } from './game-plugins/vassals-and-robbers';
import { initArtelPlugin } from './game-plugins/artel';

/**
 * Инициализирует все плагины
 */
export const initializePlugins = () => {
  const initializers = [initVassalsAndRobbersPlugin, initArtelPlugin];

  initializers.forEach((initializer) => {
    initializer();
  });
};

