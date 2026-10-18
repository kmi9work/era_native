import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import EnterpriseListScreen from '../../../../screens/PlantWorkshopScreens/EnterpriseListScreen';
import TwoTeamsOverlay from '../components/TwoTeamsOverlay';

/**
 * Обычный режим цеха: экран ядра + накладка плагина (надпись для мастеров и
 * яркая отметка «добыча запрещена», п. 6 и п. 8).
 */
export default function EnterpriseListScreenWithTwoTeams() {
  const route = useRoute<RouteProp<Record<string, { guildId?: number }>, string>>();
  const guildId = (route.params as { guildId?: number } | undefined)?.guildId;

  return (
    <View style={styles.container}>
      <EnterpriseListScreen />
      <TwoTeamsOverlay guildIds={guildId ? [guildId] : []} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
