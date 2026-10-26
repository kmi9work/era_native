import React from 'react';
import { StyleSheet, Text } from 'react-native';

/**
 * Предупреждение о запрете строительства и работы предприятий в землях
 * государства (п. 0-4 правил; в режиме many_teams — одно разрешение «гильдия ×
 * государство»).
 *
 * Данные приходят с бэкенда полем `allowed` места:
 *  * режим many_teams — движок пересчитывает `allowed` по разрешению гильдии и
 *    присылает `country_name`, поэтому текст называет государство;
 *  * базовая игра — `allowed` значит «регион принадлежит текущему государству»,
 *    страна не приходит, текст нейтральный (название «Русь» здесь больше не
 *    зашито: государства в игре разные).
 *
 * Это ТОЛЬКО предупреждение: кнопки не блокируются, построить можно (мастер
 * решает сам).
 */
export default function PlaceBuildNotice({
  place,
  guildName,
  style,
}: {
  place?: { allowed?: boolean; country_name?: string } | null;
  guildName?: string;
  style?: any;
}) {
  if (!place || place.allowed !== false) {
    return null;
  }

  const countryName = place.country_name;
  const text = countryName
    ? `Запрещено строительство и работа предприятий в землях государства «${countryName}»` +
      `${guildName ? ` для гильдии «${guildName}»` : ''}. Это предупреждение — построить можно.`
    : 'Регион не входит в земли текущего государства — строительство запрещено правилами.';

  return <Text style={[styles.notice, style]}>{text}</Text>;
}

const styles = StyleSheet.create({
  notice: {
    marginTop: 6,
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '600',
  },
});
