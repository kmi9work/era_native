/**
 * Карточка отряда: символ типа, порог попадания, применённые баффы/дебаффы,
 * кубик к6 (у пушки его нет — она не участвует в бою) и признак потери.
 *
 * Анимация «удара» повторяет ощущение Hearthstone без тяжёлой графики:
 * бьющий отряд делает короткий выпад в сторону противника и возвращается,
 * карточка жертвы уезжает в ту же сторону и гаснет.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HIT_THRESHOLD, type TroopKind } from '../../../services/battleRules';
import type { BattleTroop } from '../../hooks/useBattleLogic';
import { TROOP_IMAGE } from '../troopImages';
import DieButton from './DieButton';

export interface TroopViewState {
  raw: number | null;
  value: number | null;
  isHit: boolean;
  spinning: boolean;
  participates: boolean;
  modifier: number;
  bonus: number;
  debuff: number;
  fortressBonus: number;
}

interface TroopCardProps {
  troop: BattleTroop;
  view: TroopViewState;
  onRoll?: () => void;
  rollDisabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  /** Кубик показывается только в бою: на шагах состава и баффов он не нужен. */
  showDie?: boolean;
  animation?: 'strike' | 'victim' | null;
  /** Направление выпада: 1 — вниз (атакующие), −1 — вверх (защищающиеся). */
  direction?: 1 | -1;
  compact?: boolean;
}

const thresholdLabel = (kind: TroopKind): string => {
  const threshold = HIT_THRESHOLD[kind];
  if (threshold === null) return 'не участвует в бою';
  return `попадание ${threshold}–6`;
};

const modifierChips = (view: TroopViewState): string[] => {
  const chips: string[] = [];
  if (view.bonus > 0) chips.push(`Бонус +${view.bonus}`);
  if (view.debuff > 0) chips.push(`Дебафф −${view.debuff}`);
  if (view.fortressBonus > 0) chips.push(`Крепость +${view.fortressBonus}`);
  return chips;
};

const TroopCard: React.FC<TroopCardProps> = ({
  troop,
  view,
  onRoll,
  rollDisabled,
  selectable,
  selected,
  onPress,
  onRemove,
  showDie = true,
  animation,
  direction = 1,
  compact,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animation) {
      progress.setValue(0);
      return;
    }

    progress.setValue(0);
    if (animation === 'strike') {
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [animation, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, direction * 54] });
  const scale =
    animation === 'victim'
      ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] })
      : undefined;
  const opacity =
    animation === 'victim'
      ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.08] })
      : undefined;

  const chips = modifierChips(view);
  const content = (
    <Animated.View
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        selected ? styles.cardSelected : null,
        view.isHit ? styles.cardHit : null,
        { transform: [{ translateY }, ...(scale ? [{ scale }] : [])], opacity },
      ]}
    >
      <Image source={TROOP_IMAGE[troop.kind]} style={compact ? styles.iconCompact : styles.icon} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {troop.name}
        </Text>
        <Text style={styles.threshold}>{thresholdLabel(troop.kind)}</Text>
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map(chip => (
              <Text key={chip} style={styles.chip}>
                {chip}
              </Text>
            ))}
          </View>
        ) : null}
        {view.value !== null && view.raw !== null ? (
          <Text style={[styles.roll, view.isHit ? styles.rollHit : null]}>
            кубик {view.raw}
            {view.value !== view.raw ? ` → ${view.value}` : ''} · {view.isHit ? 'попадание' : 'промах'}
          </Text>
        ) : null}
        {selected ? <Text style={styles.loss}>потеря</Text> : null}
      </View>

      {showDie ? (
        view.participates ? (
          <DieButton
            value={view.raw}
            spinning={view.spinning}
            onPress={onRoll}
            disabled={rollDisabled}
            hit={view.isHit}
          />
        ) : (
          <Text style={styles.noDie}>без{"\n"}кубика</Text>
        )
      ) : null}

      {onRemove ? (
        <TouchableOpacity style={styles.remove} onPress={onRemove} accessibilityLabel="Убрать отряд">
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );

  if (!onPress || !selectable) return content;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  cardCompact: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  cardSelected: {
    borderColor: '#c62828',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },
  cardHit: {
    borderColor: '#2e7d32',
  },
  icon: {
    width: 38,
    height: 38,
    marginRight: 10,
    resizeMode: 'contain',
  },
  iconCompact: {
    width: 26,
    height: 26,
    marginRight: 8,
    resizeMode: 'contain',
  },
  info: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#263238',
  },
  threshold: {
    fontSize: 11,
    color: '#78909c',
    marginTop: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  chip: {
    fontSize: 10,
    color: '#4e342e',
    backgroundColor: '#fff3e0',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 4,
    marginTop: 2,
  },
  roll: {
    fontSize: 11,
    color: '#78909c',
    marginTop: 3,
  },
  rollHit: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  loss: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c62828',
    marginTop: 3,
  },
  noDie: {
    fontSize: 10,
    color: '#90a4ae',
    textAlign: 'center',
    width: 44,
  },
  remove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 18,
    color: '#b0bec5',
    lineHeight: 20,
  },
});

export default TroopCard;
