/**
 * Панель города: вся информация о поселении и действия мастера
 * (смена владельца, постройка/улучшение крепости).
 *
 * В ландшафте панель прижата к правому краю, в портрете — нижний лист.
 * Данные приходят готовыми из useMapLogic; панель ничего не запрашивает сама.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Player } from '../../types';
import type { MapCity } from './types';
import { FORTRESS_COLORS, MAP_COLORS, fortressLabel } from './mapStyle';

interface Props {
  city: MapCity | null;
  players: Player[];
  busy: boolean;
  error?: string | null;
  side: 'right' | 'bottom';
  onClose: () => void;
  onSetOwner: (playerId: number | null) => void;
  onBuildFortress: () => void;
  onUpgradeFortress: () => void;
}

const formatNumber = (value?: number | null): string =>
  typeof value === 'number' ? value.toLocaleString('ru-RU') : '—';

const CityPanel = ({
  city,
  players,
  busy,
  error,
  side,
  onClose,
  onSetOwner,
  onBuildFortress,
  onUpgradeFortress,
}: Props) => {
  const [ownerPicker, setOwnerPicker] = useState(false);

  if (!city) return null;

  const fortress = city.fortress;
  const ownerName = city.settlement.player?.name || 'за государством';
  const buildings = city.settlement.buildings ?? [];

  return (
    <View style={[styles.panel, side === 'right' ? styles.panelRight : styles.panelBottom]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{city.name}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, city.capital && styles.badgeCapital]}>
              <Text style={styles.badgeText}>
                {city.capital ? 'столица' : city.settlement.settlement_type?.name || 'город'}
              </Text>
            </View>
            <View style={[styles.badge, styles.badgeFortress]}>
              <View style={[styles.fortressDot, { backgroundColor: FORTRESS_COLORS[fortress] }]} />
              <Text style={styles.badgeText}>{fortressLabel(fortress)}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Закрыть панель города"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Row label="Государство" value={city.country?.name || city.region?.country?.name || '—'} />
        <Row label="Земля" value={city.region?.name || '—'} />
        <Row
          label="Общественный порядок"
          value={city.region?.show_overall_po != null ? String(city.region.show_overall_po) : '—'}
        />
        <Row label="Владелец" value={ownerName} />
        <Row label="Доход" value={formatNumber(city.settlement.income)} />
        <Row
          label="Ворота"
          value={city.settlement.open_gate ? 'открыты' : 'закрыты'}
        />

        <Text style={styles.sectionTitle}>Постройки</Text>
        {buildings.length === 0 ? (
          <Text style={styles.empty}>Построек нет</Text>
        ) : (
          buildings.map((building) => (
            <View key={building.id} style={styles.buildingRow}>
              <Text style={styles.buildingName}>
                {building.building_level_name || building.building_type_name || 'постройка'}
              </Text>
              <Text style={styles.buildingLevel}>
                {building.building_level_level ? `${building.building_level_level} ур.` : ''}
              </Text>
            </View>
          ))
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Действия</Text>
        <ActionButton
          label="Сменить владельца"
          onPress={() => setOwnerPicker(true)}
          disabled={busy}
        />
        {fortress < 3 ? (
          <ActionButton
            label={fortress === 0 ? 'Построить крепость (1 ур.)' : `Улучшить крепость (до ${fortress + 1} ур.)`}
            onPress={fortress === 0 ? onBuildFortress : onUpgradeFortress}
            disabled={busy}
          />
        ) : (
          <Text style={styles.empty}>Кремль — максимальный уровень</Text>
        )}
        {busy ? <ActivityIndicator color={MAP_COLORS.accent} style={styles.spinner} /> : null}
      </ScrollView>

      <Modal
        visible={ownerPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setOwnerPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOwnerPicker(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Владелец города</Text>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.playerRow}
                onPress={() => {
                  setOwnerPicker(false);
                  onSetOwner(null);
                }}
              >
                <Text style={styles.playerName}>Снять владельца</Text>
                <Text style={styles.playerCountry}>город остаётся за государством</Text>
              </TouchableOpacity>
              {players.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  style={styles.playerRow}
                  onPress={() => {
                    setOwnerPicker(false);
                    onSetOwner(player.id);
                  }}
                >
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerCountry}>
                    {player.country?.short_name || player.country?.name || ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: MAP_COLORS.border,
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
  badgeCapital: {
    borderColor: MAP_COLORS.accent,
  },
  badgeFortress: {
    gap: 6,
  },
  badgeText: {
    color: MAP_COLORS.textMuted,
    fontSize: 12,
  },
  fortressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  buildingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  buildingName: {
    color: MAP_COLORS.text,
    fontSize: 13,
  },
  buildingLevel: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
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
  spinner: {
    marginTop: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    backgroundColor: MAP_COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    padding: 16,
  },
  modalTitle: {
    color: MAP_COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalList: {
    maxHeight: 420,
  },
  playerRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  playerName: {
    color: MAP_COLORS.text,
    fontSize: 14,
  },
  playerCountry: {
    color: MAP_COLORS.textMuted,
    fontSize: 11,
  },
});

export default CityPanel;
