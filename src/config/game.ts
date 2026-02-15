import { NativeModules } from 'react-native';

interface GameInfo {
  name: string;
  description: string;
}

interface AvailableGames {
  [key: string]: GameInfo;
}

class GameConfig {
  readonly activeGame: string;
  readonly availableGames: AvailableGames = {
    'base-game': {
      name: 'Era of Change',
      description: 'Базовая игра',
    },
    'vassals-and-robbers': {
      name: 'Vassals and Robbers',
      description: 'Игра с вассалами и разбойниками',
    },
    'artel': {
      name: 'Artel',
      description: 'Ресурсы без привязки к стране, один уровень отношений',
    },
  };

  constructor() {
    // В React Native `process.env` обычно не заполняется.
    // Поэтому берём build-time значение из нативного модуля, и только затем fallback.
    const nativeActiveGame: unknown = NativeModules?.GameConfigModule?.ACTIVE_GAME;
    this.activeGame =
      (typeof nativeActiveGame === 'string' && nativeActiveGame.trim().length > 0
        ? nativeActiveGame
        : undefined) ||
      // Последний fallback: env (на случай web/тестов) или base-game
      (process.env.ACTIVE_GAME || 'base-game');
  }

  /**
   * Проверка активной игры
   */
  isActive(gameName: string): boolean {
    return this.activeGame === gameName;
  }

  /**
   * Информация об активной игре
   */
  getActiveGameInfo(): GameInfo | null {
    return this.availableGames[this.activeGame] || null;
  }
}

// Singleton instance
export const gameConfig = new GameConfig();

// React hook для использования в компонентах
export const useGameConfig = () => {
  return {
    activeGame: gameConfig.activeGame,
    isGameActive: (gameName: string) => gameConfig.isActive(gameName),
    activeGameInfo: gameConfig.getActiveGameInfo(),
  };
};

