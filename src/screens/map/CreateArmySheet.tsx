/**
 * Создание армии по двойному нажатию на карте: армия появляется в предложенном
 * месте (точка двойного нажатия или город под ней). Мастеру остаётся имя и
 * владелец — армия на бэкенде без владельца не создаётся (`owner_is_country_or_noble`).
 *
 * По умолчанию владелец — владелец города, если нажали по городу, иначе первое
 * государство: обычно армию создают «у себя», и лишних нажатий не нужно.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Country, Player } from '../../types';
import type { MapCity } from './types';
import { MAP_COLORS } from './mapStyle';

export interface ArmyOwner {
  type: 'Country' | 'Player';
  id: number;
}

interface Props {
  visible: boolean;
  point: { x: number; y: number } | null;
  city: MapCity | null;
  defaultName: string;
  suggestedOwner: ArmyOwner | null;
  countries: Country[];
  players: Player[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (payload: { name: string; owner: ArmyOwner }) => void;
}

const ownerKey = (owner: ArmyOwner) => `${owner.type}-${owner.id}`;

const CreateArmySheet = ({
  visible,
  point,
  city,
  defaultName,
  suggestedOwner,
  countries,
  players,
  busy,
  error,
  onClose,
  onCreate,
}: Props) => {
  const [name, setName] = useState(defaultName);
  const [owner, setOwner] = useState<ArmyOwner | null>(suggestedOwner);

  useEffect(() => {
    if (visible) {
      setName(defaultName);
      setOwner(suggestedOwner);
    }
  }, [visible, defaultName, suggestedOwner]);

  // Владельцем армии игрока может быть только знать (Army#owner_is_country_or_noble):
  // купцов и «Духов бунта» в списке быть не должно.
  const nobles = useMemo(
    () => players.filter(player => (player.player_type?.name ?? '').includes('Знать')),
    [players],
  );

  const place = city
    ? `у города ${city.name}`
    : point
      ? `поле · ${point.x.toFixed(3)}, ${point.y.toFixed(3)}`
      : '';

  const ready = name.trim().length > 0 && owner !== null && !busy;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Новая армия</Text>
              <Text style={styles.subtitle}>{place}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Отменить создание армии"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Название</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Название армии"
            placeholderTextColor={MAP_COLORS.textMuted}
            editable={!busy}
            accessibilityLabel="Название армии"
          />

          <Text style={styles.label}>Владелец</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            <Text style={styles.groupTitle}>Государства</Text>
            {countries.map(country => {
              const key = ownerKey({ type: 'Country', id: country.id });
              const active = owner !== null && ownerKey(owner) === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.ownerRow, active && styles.ownerRowActive]}
                  onPress={() => setOwner({ type: 'Country', id: country.id })}
                  disabled={busy}
                >
                  <Text style={styles.ownerName}>{country.name}</Text>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
            <Text style={styles.groupTitle}>Знать</Text>
            {nobles.map(player => {
              const key = ownerKey({ type: 'Player', id: player.id });
              const active = owner !== null && ownerKey(owner) === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.ownerRow, active && styles.ownerRowActive]}
                  onPress={() => setOwner({ type: 'Player', id: player.id })}
                  disabled={busy}
                >
                  <Text style={styles.ownerName}>{player.name}</Text>
                  <Text style={styles.ownerCountry}>
                    {player.country?.short_name || player.country?.name || ''}
                  </Text>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primary, !ready && styles.primaryDisabled]}
            onPress={() => owner && onCreate({ name: name.trim(), owner })}
            disabled={!ready}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#1d1a14" />
            ) : (
              <Text style={styles.primaryText}>Создать армию</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    backgroundColor: MAP_COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: MAP_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
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
  label: {
    color: MAP_COLORS.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: MAP_COLORS.text,
    fontSize: 15,
    backgroundColor: MAP_COLORS.surfaceRaised,
  },
  list: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    borderRadius: 10,
  },
  listContent: {
    padding: 6,
  },
  groupTitle: {
    color: MAP_COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 6,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ownerRowActive: {
    backgroundColor: 'rgba(201,162,39,0.16)',
  },
  ownerName: {
    flex: 1,
    color: MAP_COLORS.text,
    fontSize: 14,
  },
  ownerCountry: {
    color: MAP_COLORS.textMuted,
    fontSize: 11,
  },
  check: {
    color: MAP_COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  primary: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: MAP_COLORS.accent,
    alignItems: 'center',
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: '#1d1a14',
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    marginTop: 10,
    color: '#e0766a',
    fontSize: 12,
  },
});

export default CreateArmySheet;
