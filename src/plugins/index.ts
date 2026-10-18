// Импорт плагинов
import { initVassalsAndRobbersPlugin } from './game-plugins/vassals-and-robbers';
import { initArtelPlugin } from './game-plugins/artel';
import { initTwoTeamsPlugin } from './game-plugins/two_teams';

/**
 * Инициализирует все плагины
 */
export const initializePlugins = () => {
  const initializers = [initVassalsAndRobbersPlugin, initArtelPlugin, initTwoTeamsPlugin];

  initializers.forEach((initializer) => {
    initializer();
  });
};

