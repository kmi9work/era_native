import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRefetchOnFocus } from '../../../../data/useRefetchOnFocus';
import { manyTeamsKeys, useGuildWorkshop } from '../hooks/useGuildWorkshop';

/**
 * Яркая отметка «строительство и работа запрещены» по одной гильдии (п. 0-6).
 *
 * Запрет один: он закрывает и строительство, и работу уже построенных
 * предприятий. Данные — с бэкенда (`forbidden_plant_ids`), клиент ничего не
 * вычисляет сам: разрешение меняют Казначей и мастера, программа показывает то,
 * что лежит в базе.
 */
export default function WorkForbiddenBanner({ guildId }: { guildId: number }) {
  const { data } = useGuildWorkshop(guildId);
  useRefetchOnFocus([manyTeamsKeys.workshop(guildId)]);

  const forbidden = (data?.plants || []).filter((plant) => plant.work_forbidden);

  if (!forbidden.length) {
    return null;
  }

  const preview = forbidden
    .slice(0, 3)
    .map((plant) => plant.plant_name || `#${plant.plant_id}`)
    .join(', ');
  const rest = forbidden.length - Math.min(forbidden.length, 3);

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>
        СТРОИТЕЛЬСТВО И РАБОТА ЗАПРЕЩЕНЫ{data?.guild?.name ? ` — ${data.guild.name}` : ''}
      </Text>
      <Text style={styles.text}>
        {preview}
        {rest > 0 ? ` и ещё ${rest}` : ''}
      </Text>
      <Text style={styles.hint}>
        В государстве расположения гильдии запрещено строить предприятия и работать на них.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#c62828',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 8,
  },
  title: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  text: {
    color: '#ffebee',
    fontSize: 13,
    marginTop: 2,
  },
  hint: {
    color: '#ffcdd2',
    fontSize: 11,
    marginTop: 2,
  },
});
