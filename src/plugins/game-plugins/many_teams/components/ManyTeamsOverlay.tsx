import React from 'react';
import { StyleSheet, View } from 'react-native';
import MastersNotice from './MastersNotice';
import WorkForbiddenBanner from './WorkForbiddenBanner';
import { useGuildWorkshop } from '../hooks/useGuildWorkshop';

/**
 * Накладка плагина many_teams над экранами цеха предприятий.
 *
 * Показывает надпись для мастеров (п. 8) и яркие отметки «строительство и работа
 * запрещены» (п. 0-6) в обычном и пакетном режиме. Накладка прозрачна для нажатий
 * (`box-none`), поэтому кнопки экрана остаются доступны.
 */
export default function ManyTeamsOverlay({ guildIds }: { guildIds: number[] }) {
  const firstGuildId = guildIds.length ? guildIds[0] : undefined;
  const { data } = useGuildWorkshop(firstGuildId);

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <MastersNotice text={data?.notice} />
      {guildIds.map((guildId) => (
        <WorkForbiddenBanner key={guildId} guildId={guildId} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
