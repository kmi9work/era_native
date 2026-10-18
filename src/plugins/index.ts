// Импорт плагинов
import { initVassalsAndRobbersPlugin } from './game-plugins/vassals-and-robbers';
import { initArtelPlugin } from './game-plugins/artel';
import { initManyTeamsPlugin } from './game-plugins/many_teams';

/**
 * Инициализирует все плагины
 */
export const initializePlugins = () => {
  const initializers = [initVassalsAndRobbersPlugin, initArtelPlugin, initManyTeamsPlugin];

  initializers.forEach((initializer) => {
    initializer();
  });
};

