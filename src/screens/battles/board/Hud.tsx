/**
 * HUD сцены: раунд, силы сторон, попадания за раунд, скорость показа.
 * Это «табло» боя — то, что игрок читает, не отвлекаясь от фишек.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BattlePhase } from '../../hooks/useBattleLogic';

export const SPEEDS: readonly number[] = [1, 2, 3];

interface HudProps {
  round: number;
  placeTitle: string;
  phase: BattlePhase;
  hint: string;
  troops: { attacker: number; defender: number };
  initial: { attacker: number; defender: number };
  power: { attacker: number; defender: number };
  hits: { attacker: number; defender: number };
  speed: number;
  onSpeed: (speed: number) => void;
  /** Бой идёт на весь экран: табло само отступает под строку статуса. */
  topInset?: number;
  onBack?: () => void;
}

const barWidth = (left: number, total: number): `${number}%` => {
  const value = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return `${Math.round(value * 100)}%`;
};

const Hud: React.FC<HudProps> = ({
  round,
  placeTitle,
  phase,
  hint,
  troops,
  initial,
  power,
  hits,
  speed,
  onSpeed,
  topInset = 0,
  onBack,
}) => (
  <View style={[styles.container, { paddingTop: 8 + topInset }]}>
    <View style={styles.topRow}>
      {onBack ? (
        <TouchableOpacity
          style={styles.back}
          onPress={onBack}
          accessibilityLabel="Вернуться к баффам"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.titleBlock}>
        <Text style={styles.round}>Раунд {round}</Text>
        <Text style={styles.place} numberOfLines={1}>
          {placeTitle}
        </Text>
      </View>
      <View style={styles.speedBlock}>
        {SPEEDS.map(value => (
          <TouchableOpacity
            key={value}
            style={[styles.speedChip, speed === value ? styles.speedChipActive : null]}
            onPress={() => onSpeed(value)}
            accessibilityLabel={`Скорость показа x${value}`}
          >
            <Text style={[styles.speedText, speed === value ? styles.speedTextActive : null]}>
              x{value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>

    <View style={styles.forces}>
      <View style={styles.forceRow}>
        <Text style={[styles.sideName, styles.sideNameAttacker]}>Атакующие</Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              styles.barAttacker,
              { width: barWidth(troops.attacker, initial.attacker) },
            ]}
          />
        </View>
        <Text style={styles.forceValue}>
          {troops.attacker} / {initial.attacker} · сила {power.attacker}
        </Text>
      </View>

      <View style={styles.forceRow}>
        <Text style={[styles.sideName, styles.sideNameDefender]}>Защищающиеся</Text>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              styles.barDefender,
              { width: barWidth(troops.defender, initial.defender) },
            ]}
          />
        </View>
        <Text style={styles.forceValue}>
          {troops.defender} / {initial.defender} · сила {power.defender}
        </Text>
      </View>
    </View>

    <View style={styles.bottomRow}>
      <Text style={styles.hint} numberOfLines={2}>
        {hint}
      </Text>
      {phase === 'casualties' || phase === 'playing' || phase === 'retreat' ? (
        <Text style={styles.hits}>
          попадания: {hits.attacker} — {hits.defender}
        </Text>
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e6ec',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    width: 30,
    height: 34,
    marginLeft: -6,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '700',
    color: '#37474f',
  },
  titleBlock: {
    flex: 1,
  },
  round: {
    fontSize: 17,
    fontWeight: '800',
    color: '#263238',
  },
  place: {
    fontSize: 11,
    color: '#78909c',
    marginTop: 1,
  },
  speedBlock: {
    flexDirection: 'row',
  },
  speedChip: {
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  speedChipActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  speedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#546e7a',
  },
  speedTextActive: {
    color: '#ffffff',
  },
  forces: {
    marginTop: 6,
  },
  forceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  sideName: {
    width: 96,
    fontSize: 11,
    fontWeight: '700',
  },
  sideNameAttacker: {
    color: '#c62828',
  },
  sideNameDefender: {
    color: '#1565c0',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#eceff1',
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barAttacker: {
    backgroundColor: '#e57373',
  },
  barDefender: {
    backgroundColor: '#64b5f6',
  },
  forceValue: {
    width: 108,
    textAlign: 'right',
    fontSize: 10,
    color: '#607d8b',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  hint: {
    flex: 1,
    fontSize: 10,
    color: '#78909c',
    lineHeight: 13,
  },
  hits: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#455a64',
  },
});

export default Hud;
