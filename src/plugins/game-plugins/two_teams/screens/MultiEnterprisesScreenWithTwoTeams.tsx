import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MultiEnterprisesScreen from '../../../../screens/PlantWorkshopScreens/MultiEnterprisesScreen';
import TwoTeamsOverlay from '../components/TwoTeamsOverlay';
import { useMultiEnterprise } from '../../../../screens/PlantWorkshopScreens/multiEnterpriseContext';

/**
 * Пакетный режим: экран ядра + накладка плагина. Гильдии берутся из
 * мультисписка (у каждой записи есть `guild`), поэтому отметки «добыча
 * запрещена» показываются по всем гильдиям сразу.
 */
export default function MultiEnterprisesScreenWithTwoTeams() {
  const { entries } = useMultiEnterprise();

  const guildIds = useMemo<number[]>(() => {
    const ids = (entries || [])
      .map((entry: any) => entry?.guild?.id as number | undefined)
      .filter((id: number | undefined): id is number => typeof id === 'number');

    return Array.from(new Set(ids));
  }, [entries]);

  return (
    <View style={styles.container}>
      <MultiEnterprisesScreen />
      <TwoTeamsOverlay guildIds={guildIds} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
