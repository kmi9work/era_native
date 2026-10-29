import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TechnologyRequirement } from '../../types';
import { closedPlaceTechnologyNames, formatTechnologyNames } from '../../services/plantTechnology';

/**
 * Предупреждения по КОНКРЕТНОЙ земле — двумя независимыми строками:
 *
 *  1. запрет строительства и работы предприятий в государстве земли (п. 0-4
 *     правил; в режиме many_teams — одно разрешение «гильдия × государство»).
 *     Данные приходят с бэкенда полем `allowed` места:
 *      * many_teams — движок пересчитывает `allowed` по разрешению гильдии и
 *        присылает `country_name`, поэтому текст называет государство;
 *      * базовая игра — `allowed` значит «регион принадлежит текущему
 *        государству», страна не приходит, текст нейтральный (название «Русь»
 *        здесь больше не зашито: государства в игре разные);
 *  2. технология, запрещающая это предприятие, не открыта В ГОСУДАРСТВЕ ЗЕМЛИ
 *     (сейчас «Ремесловые люди»). Статус — поле `technology_requirements` места
 *     (many_teams); без него берётся статус типа предприятия
 *     (`technologyRequirements`), как в базовой игре, artel и vassals.
 *
 * Это ТОЛЬКО предупреждения: кнопки не блокируются, построить можно (мастер
 * решает сам).
 */
export default function PlaceBuildNotice({
  place,
  guildName,
  technologyRequirements,
  style,
}: {
  place?:
    | {
        allowed?: boolean;
        country_name?: string;
        technology_requirements?: TechnologyRequirement[];
      }
    | null;
  guildName?: string;
  /** Требования типа предприятия — запасной вариант, если у места статуса нет. */
  technologyRequirements?: TechnologyRequirement[] | null;
  style?: any;
}) {
  if (!place) {
    return null;
  }

  const countryName = place.country_name;
  const buildForbidden = place.allowed === false;
  const closedTechnologyNames = closedPlaceTechnologyNames(place, technologyRequirements);

  if (!buildForbidden && closedTechnologyNames.length === 0) {
    return null;
  }

  const buildForbiddenText = countryName
    ? `Запрещено строительство и работа предприятий в землях государства «${countryName}»` +
      `${guildName ? ` для гильдии «${guildName}»` : ''}. Это предупреждение — построить можно.`
    : 'Регион не входит в земли текущего государства — строительство запрещено правилами.';

  const closedTechnologyText =
    `Технология ${formatTechnologyNames(closedTechnologyNames)} не открыта` +
    `${countryName ? ` в государстве «${countryName}»` : ''} — строительство ` +
    'запрещено правилами. Продолжайте только по решению ведущего.';

  return (
    <View>
      {buildForbidden && <Text style={[styles.notice, style]}>{buildForbiddenText}</Text>}
      {closedTechnologyNames.length > 0 && (
        <Text style={[styles.notice, style]}>{closedTechnologyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginTop: 6,
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '600',
  },
});
