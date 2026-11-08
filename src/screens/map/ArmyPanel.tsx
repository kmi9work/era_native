/**
 * Панель армии на карте: сколько отрядов и каких, свободные слоты, набор и
 * перемещение. Подписей на самой карте нет — всё, что не влезло в щит, живёт
 * здесь.
 *
 * Правило состава (Army::NUMBER_OF_SLOTS / CANNON_SLOTS): три обычных отряда
 * плюс одна пушка сверх них.
 */
import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MapArmy } from './armyLayout';
import type { ArmySteps } from './armySteps';
import { stepsSummary } from './armySteps';
import { MAP_COLORS } from './mapStyle';
import { isCannonTroop, troopImage } from './troopIcons';

export const REGULAR_SLOTS = 3;
export const CANNON_SLOTS = 1;

interface Props {
  item: MapArmy;
  side: 'right' | 'bottom';
  busy: boolean;
  error?: string | null;
  /** Шаги перемещения за год (максимум/потрачено считает сервер). */
  steps?: ArmySteps | null;
  onClose: () => void;
  onRecruit: () => void;
  onMove: () => void;
}

interface TroopGroup {
  name: string;
  count: number;
  cannon: boolean;
}

/** Отряды, сгруппированные по типу: «Пехота ×2», «Пушка ×1». */
export const groupTroops = (troops: MapArmy['army']['troops']): TroopGroup[] => {
  const order = ['пехот', 'тяж', 'кавал', 'пушк'];
  const groups = new Map<string, TroopGroup>();
  (troops ?? []).forEach(troop => {
    const name = troop.troop_type?.name ?? 'отряд';
    const key = name.toLowerCase();
    const current = groups.get(key);
    if (current) current.count += 1;
    else groups.set(key, { name, count: 1, cannon: isCannonTroop(name) });
  });
  return [...groups.values()].sort((a, b) => {
    const ai = order.findIndex(part => a.name.toLowerCase().includes(part));
    const bi = order.findIndex(part => b.name.toLowerCase().includes(part));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
};

const freeSlots = (item: MapArmy) => {
  const troops = item.army.troops ?? [];
  const cannons = troops.filter(troop => isCannonTroop(troop.troop_type?.name)).length;
  return {
    regular: Math.max(0, REGULAR_SLOTS - (troops.length - cannons)),
    cannon: Math.max(0, CANNON_SLOTS - cannons),
  };
};

const ArmyPanel = ({ item, side, busy, error, steps, onClose, onRecruit, onMove }: Props) => {
  const { army } = item;
  const groups = groupTroops(army.troops);
  const slots = freeSlots(item);
  const total = army.troops?.length ?? 0;
  const canRecruit = slots.regular > 0 || slots.cannon > 0;

  const place = item.inCity
    ? `в городе ${item.city?.name ?? army.settlement?.name ?? ''}`
    : item.approximated
      ? 'не размещена на карте'
      : 'в поле';

  return (
    <View style={[styles.panel, side === 'right' ? styles.panelRight : styles.panelBottom]}>
      <View style={styles.header}>
        <Image source={item.shield.source} style={styles.headerShield} resizeMode="contain" />
        <View style={styles.headerText}>
          <Text style={styles.title}>{army.name}</Text>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{army.country?.short_name || army.country?.name || 'без государства'}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{place}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Закрыть панель армии"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Row label="Владелец" value={army.owner?.name || '—'} />
        <Row label="Отрядов" value={`${total} из ${REGULAR_SLOTS + CANNON_SLOTS}`} />
        <Row
          label="Свободно"
          value={`${slots.regular} обычных · ${slots.cannon} пушка`}
        />
        {steps ? (
          <Row label="Шаги" value={stepsSummary(steps)} />
        ) : null}

        {steps && steps.left <= 0 ? (
          <Text style={styles.warning}>
            Шаги закончились: по правилам армия не может ходить. Передвинуть её всё равно можно —
            мастер подтверждает это вручную.
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>Состав</Text>
        {groups.length === 0 ? (
          <Text style={styles.empty}>Отрядов нет</Text>
        ) : (
          groups.map(group => (
            <View key={group.name} style={styles.troopRow}>
              <Image source={troopImage(group.name)} style={styles.troopIcon} resizeMode="contain" />
              <Text style={styles.troopName}>{group.name}</Text>
              <Text style={styles.troopCount}>×{group.count}</Text>
            </View>
          ))
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Действия</Text>
        <ActionButton
          label={canRecruit ? 'Добавить отряды' : 'Мест нет: 3 отряда и пушка'}
          onPress={onRecruit}
          disabled={busy || !canRecruit}
        />
        <ActionButton label="Передвинуть" onPress={onMove} disabled={busy} />
        {busy ? <ActivityIndicator color={MAP_COLORS.accent} style={styles.spinner} /> : null}
      </ScrollView>
    </View>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const ActionButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.action, disabled && styles.actionDisabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    backgroundColor: MAP_COLORS.surface,
    borderColor: MAP_COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  panelRight: {
    top: 0,
    right: 0,
    bottom: 0,
    width: 400,
    borderLeftWidth: 1,
  },
  panelBottom: {
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '52%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: MAP_COLORS.border,
    gap: 10,
  },
  headerShield: {
    width: 30,
    height: 37,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: MAP_COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: MAP_COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
  },
  badgeText: {
    color: MAP_COLORS.textMuted,
    fontSize: 12,
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: MAP_COLORS.textMuted,
    fontSize: 18,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 28,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 5,
  },
  rowLabel: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
    flexShrink: 1,
  },
  rowValue: {
    color: MAP_COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  sectionTitle: {
    color: MAP_COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 6,
  },
  empty: {
    color: MAP_COLORS.textMuted,
    fontSize: 12,
  },
  troopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  troopIcon: {
    width: 26,
    height: 26,
  },
  troopName: {
    flex: 1,
    color: MAP_COLORS.text,
    fontSize: 14,
  },
  troopCount: {
    color: MAP_COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  action: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: MAP_COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    alignItems: 'center',
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: MAP_COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    marginTop: 12,
    color: '#e0766a',
    fontSize: 12,
  },
  warning: {
    marginTop: 10,
    color: '#e0b06a',
    fontSize: 12,
    lineHeight: 17,
  },
  spinner: {
    marginTop: 10,
  },
});

export default ArmyPanel;
