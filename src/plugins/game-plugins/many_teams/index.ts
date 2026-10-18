import { gameConfig } from '../../../config/game';
import { componentRegistry } from '../../../registry';
import EnterpriseListScreenWithManyTeams from './screens/EnterpriseListScreenWithManyTeams';
import MultiEnterprisesScreenWithManyTeams from './screens/MultiEnterprisesScreenWithManyTeams';

/**
 * Плагин игры «Много команд» (many_teams) для era_native.
 *
 * Включается значением `ACTIVE_GAME = 'many-teams'` (написание `many_teams`
 * тоже принимается): константу ACTIVE_GAME в src/config.ts генерируют
 * era_scripts/start-dev.sh и build-prod.sh, либо значение приходит из нативного
 * модуля. Плагин подменяет два экрана цеха предприятий:
 *  - обычный режим — список предприятий гильдии;
 *  - пакетный режим — список предприятий нескольких гильдий.
 * Оба показывают надпись для мастеров (п. 8) и яркую отметку «добыча запрещена»
 * по данным бэкенда (п. 6): `/many_teams/guilds/:id/workshop`.
 */

/** Ключ игры = ACTIVE_GAME движка; справочник игр ядра пополняется ниже. */
export const GAME_KEY = 'many-teams';

export const initManyTeamsPlugin = () => {
  // Игра видна в списке и в информации об активной игре без правки
  // src/config/game.ts.
  gameConfig.availableGames[GAME_KEY] = {
    name: 'Many Teams',
    description: 'Режим «много команд»: добыча и эмбарго гильдий, две и более команд',
  };

  if (!gameConfig.isActive(GAME_KEY) && !gameConfig.isActive('many_teams')) {
    return;
  }

  console.log('[many_teams] Initializing plugin...');

  componentRegistry.register('many_teams.EnterpriseListScreen', EnterpriseListScreenWithManyTeams);
  componentRegistry.register('many_teams.MultiEnterprisesScreen', MultiEnterprisesScreenWithManyTeams);

  console.log('[many_teams] Plugin initialized');
};

export default initManyTeamsPlugin;
