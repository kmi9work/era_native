import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRefetchOnFocus } from '../../../../data/useRefetchOnFocus';
import { manyTeamsKeys, useGuildWorkshop } from '../hooks/useGuildWorkshop';

/**
 * Плашка «строительство и работа запрещены» на экране «Улучшение предприятия»
 * (п. 5 правил).
 *
 * Запрет один — то же разрешение «гильдия × государство», что и при
 * строительстве: если гильдии запрещено в государстве расположения предприятия,
 * ей запрещено и строить, и работать на уже построенном. Данные — с бэкенда
 * (`GET /many_teams/guilds/:id/workshop`), клиент ничего не вычисляет.
 *
 * Компонент регистрируется в `componentRegistry` под ключом
 * `many_teams.PlantWorkNotice`; ядро (`UpgradeConfirmScreen`) рисует его, если он
 * зарегистрирован, — в базовой игре экран не меняется.
 */
export default function PlantWorkNotice({ plant }: { plant?: any }) {
  const guildId =
    plant?.economic_subject_type === 'Guild' ? plant?.economic_subject_id : undefined;

  const { data } = useGuildWorkshop(guildId);
  useRefetchOnFocus([manyTeamsKeys.workshop(guildId)]);

  const entry = (data?.plants || []).find((item) => item.plant_id === plant?.id);

  if (!entry?.work_forbidden) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.title}>РАБОТА И СТРОИТЕЛЬСТВО ЗАПРЕЩЕНЫ</Text>
      <Text style={styles.text}>
        {entry.country_name
          ? `В землях государства «${entry.country_name}» гильдии запрещено строить предприятия и работать на них.`
          : 'В государстве расположения предприятия гильдии запрещено строить предприятия и работать на них.'}
      </Text>
      <Text style={styles.hint}>Это предупреждение: решение принимает ведущий.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#c62828',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
