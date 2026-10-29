import React from 'react';
import { StyleSheet, View } from 'react-native';
import WorkForbiddenBanner from './WorkForbiddenBanner';
import BuildCountriesNotice from './BuildCountriesNotice';
import { useGuildWorkshop } from '../hooks/useGuildWorkshop';

/**
 * Накладка плагина many_teams над экранами цеха предприятий.
 *
 * Показывает надпись для мастеров (п. 8), список государств, где гильдии
 * разрешено строить и работать (обычный режим, п. 0-4), и яркие отметки
 * «строительство и работа запрещены» (п. 0-6) в обычном и пакетном режиме.
 * Накладка прозрачна для нажатий (`box-none`), поэтому кнопки экрана остаются
 * доступны.
 */
export default function ManyTeamsOverlay({
  guildIds,
  inline = false,
}: {
  guildIds: number[];
  /** true — плашки встают в поток над экраном (не перекрывают заголовок). */
  inline?: boolean;
}) {
  const firstGuildId = guildIds.length ? guildIds[0] : undefined;
  const { data, isLoading } = useGuildWorkshop(firstGuildId);

  // Список разрешённых государств — только для одной гильдии (экран «Предприятия
  // гильдии»): в пакетном режиме гильдий несколько, и общий список путал бы.
  const singleGuild = guildIds.length === 1;

  return (
    <View style={inline ? styles.inlineWrapper : styles.wrapper} pointerEvents="box-none">
      {singleGuild ? <BuildCountriesNotice countries={data?.countries} loading={isLoading} /> : null}
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
  inlineWrapper: {
    paddingBottom: 4,
  },
});
