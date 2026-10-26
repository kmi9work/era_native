import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import EnterpriseListScreen from '../../../../screens/PlantWorkshopScreens/EnterpriseListScreen';
import ManyTeamsOverlay from '../components/ManyTeamsOverlay';

/**
 * Обычный режим цеха: экран ядра + плашки плагина (надпись для мастеров,
 * государства, где гильдии разрешено строить и работать, яркая отметка
 * «строительство и работа запрещены»; п. 0-8).
 *
 * Плашки стоят в потоке над экраном, а не накладкой поверх: на этом экране они
 * иначе закрывали бы заголовок и шильдик свежести.
 */
export default function EnterpriseListScreenWithManyTeams() {
  const route = useRoute<RouteProp<Record<string, { guildId?: number }>, string>>();
  const guildId = (route.params as { guildId?: number } | undefined)?.guildId;

  return (
    <View style={styles.container}>
      <ManyTeamsOverlay guildIds={guildId ? [guildId] : []} inline />
      <View style={styles.screen}>
        <EnterpriseListScreen />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { flex: 1 },
});
