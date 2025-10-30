import { gameConfig } from '../config/game';
import { componentRegistry } from '../registry';

// Импорт плагинов
import { initVassalsAndRobbersPlugin } from './game-plugins/vassals-and-robbers';

/**
 * Инициализирует все плагины
 */
export const initializePlugins = () => {
  console.log(`[Plugins] Initializing plugins for: ${gameConfig.activeGame}`);

  // Регистрируем плагины в зависимости от активной игры
  if (gameConfig.isActive('vassals-and-robbers')) {
    initVassalsAndRobbersPlugin();
  }

  console.log('[Plugins] All plugins initialized');
  console.log(`[Plugins] Overridden components: ${componentRegistry.listOverridden().join(', ')}`);
};

