import { gameConfig } from '../../../config/game';
import { componentRegistry } from '../../../registry';
import EnterpriseListScreenWithTwoTeams from './screens/EnterpriseListScreenWithTwoTeams';
import MultiEnterprisesScreenWithTwoTeams from './screens/MultiEnterprisesScreenWithTwoTeams';

/**
 * Плагин игры «Две команды» (two_teams) для era_native.
 *
 * Включается значением `ACTIVE_GAME = 'two_teams'` (src/config.ts генерируют
 * era_scripts/start-dev.sh и build-prod.sh либо значение приходит из нативного
 * модуля). Плагин подменяет два экрана цеха предприятий:
 *  - обычный режим — список предприятий гильдии;
 *  - пакетный режим — список предприятий нескольких гильдий.
 * Оба показывают надпись для мастеров (п. 8) и яркую отметку «добыча запрещена»
 * по данным бэкенда (п. 6): `/many_teams/guilds/:id/workshop`.
 */
export const initTwoTeamsPlugin = () => {
  // Справочник игр ядра пополняется из плагина, чтобы игра была видна в списке
  // и в информации об активной игре без правки src/config/game.ts.
  gameConfig.availableGames.two_teams = {
    name: 'Two Teams',
    description: 'Режим «много команд»: добыча и эмбарго гильдий, две и более команд',
  };

  if (!gameConfig.isActive('two_teams')) {
    return;
  }

  console.log('[two_teams] Initializing plugin...');

  componentRegistry.register('two_teams.EnterpriseListScreen', EnterpriseListScreenWithTwoTeams);
  componentRegistry.register('two_teams.MultiEnterprisesScreen', MultiEnterprisesScreenWithTwoTeams);

  console.log('[two_teams] Plugin initialized');
};

export default initTwoTeamsPlugin;
