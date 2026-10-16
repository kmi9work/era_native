import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { keyToString, type QueryKey } from '../data/keys';
import { queryClient } from '../data/queryClient';
import { useConnectionState, useKeysVersion, useNow } from '../data/useQuery';

interface DataFreshnessBadgeProps {
  /** Ключи, свежесть которых показываем. Без ключей — общая свежесть по последнему успешному запросу. */
  keys?: Array<QueryKey | null | undefined>;
  style?: StyleProp<ViewStyle>;
}

const formatAge = (ageMs: number): string => {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return `${seconds} с назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч назад`;
};

/**
 * Индикатор свежести и наличия связи (ТЗ § 5 «Индикация мастеру»).
 * Показывает «обновлено N назад» либо «нет связи» — вместо пустого экрана.
 */
const DataFreshnessBadge: React.FC<DataFreshnessBadgeProps> = ({ keys, style }) => {
  const now = useNow(1000);
  const connection = useConnectionState();
  const keyStrings = (keys || [])
    .filter((key): key is QueryKey => !!key)
    .map(keyToString);
  const version = useKeysVersion(keyStrings);
  void version;

  let updatedAt = connection.lastSuccessAt;
  let offline = connection.isOffline;

  if (keyStrings.length > 0) {
    const entries = keyStrings
      .map((keyString) => queryClient.getEntryByString(keyString))
      .filter((entry): entry is NonNullable<typeof entry> => !!entry);
    if (entries.length > 0) {
      const timestamps = entries
        .map((entry) => entry.updatedAt)
        .filter((value): value is number => typeof value === 'number');
      // Показываем самую старую из загруженных частей экрана — по ней мастер решает, обновлять ли.
      updatedAt = timestamps.length > 0 ? Math.min(...timestamps) : undefined;
      offline = entries.some((entry) => entry.error?.kind === 'network' || entry.error?.kind === 'timeout');
    }
  }

  const hasData = typeof updatedAt === 'number';
  const text = offline && !hasData
    ? 'нет связи'
    : offline
      ? `нет связи · ${updatedAt ? formatAge(now - updatedAt) : ''}`.trim()
      : hasData
        ? `обновлено ${formatAge(now - updatedAt!)}`
        : 'нет данных';

  return (
    <View style={[styles.badge, offline ? styles.badgeOffline : styles.badgeOnline, style]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeOnline: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(220,53,69,0.85)',
  },
  text: {
    fontSize: 11,
    color: 'white',
    fontWeight: '600',
  },
});

export default DataFreshnessBadge;
