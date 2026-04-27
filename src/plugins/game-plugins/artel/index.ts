import { gameConfig } from '../../../config/game';

/**
 * Инициализация плагина Artel.
 * В Artel ресурсы без привязки к стране, один уровень отношений; рынок один (без выбора страны).
 * Логика «рынок без страны» реализована в CaravanService и PlantWorkshopScreen.
 */
export const initArtelPlugin = () => {
  if (!gameConfig.isActive('artel')) {
    return;
  }

  // При необходимости: регистрация своих экранов/компонентов
  // componentRegistry.register('PlantWorkshopScreen', ArtelPlantWorkshopScreen);
};
