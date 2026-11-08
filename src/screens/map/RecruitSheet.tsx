/**
 * Набор отрядов в армию — два шага (решение заказчика):
 *
 *   1. выбор: одно нажатие по типу отряда добавляет один отряд, тут же считается
 *      ОБЩАЯ цена набора;
 *   2. подтверждение: список и цена ещё раз, только после него — запись на бэк.
 *
 * Цена рисуется ЗНАЧКАМИ ресурсов (TroopCost), а не текстом. Числа берутся с
 * сервера — `TroopType#params.buy_cost`, единственный источник: сид
 * eraofchange `db/seeds/4_armies.rb` (для чистой базы) и миграция
 * `update_troop_type_costs` (для живой). Клиентских копий цен нет.
 *
 * Слоты те же, что на сервере: три обычных отряда и одна пушка сверх них.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MapArmy } from './armyLayout';
import { MAP_COLORS } from './mapStyle';
import { isCannonTroop, troopImage } from './troopIcons';
import TroopCost, { type CostPart } from './TroopCost';
import { CANNON_SLOTS, REGULAR_SLOTS } from './ArmyPanel';
import type { Resource, TroopType } from '../../types';

interface Props {
  visible: boolean;
  item: MapArmy | null;
  troopTypes: TroopType[];
  resources: Resource[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (troopTypeIds: number[]) => void;
}

/** Цена найма из `TroopType#params.buy_cost`; нулевые строки старой базы отбрасываем. */
const costOf = (troopType: TroopType): CostPart[] =>
  (troopType.params?.buy_cost ?? [])
    .filter(part => part.count > 0)
    .map(part => ({
      identificator: part.identificator,
      name: part.identificator,
      count: part.count,
    }));

const RecruitSheet = ({
  visible,
  item,
  troopTypes,
  resources,
  busy,
  error,
  onClose,
  onConfirm,
}: Props) => {
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (visible) {
      setStep('pick');
      setPicked([]);
    }
  }, [visible, item?.army.id]);

  /** Названия ресурсов: идентификатор → русское название (Мясо, Металл, …). */
  const resourceName = useMemo(() => {
    const map = new Map<string, string>();
    resources.forEach(resource => map.set(resource.identificator, resource.name));
    return map;
  }, [resources]);

  const costs = useMemo(() => {
    const map = new Map<number, CostPart[]>();
    troopTypes.forEach(type => {
      map.set(
        type.id,
        costOf(type).map(part => ({ ...part, name: resourceName.get(part.identificator) ?? part.name })),
      );
    });
    return map;
  }, [troopTypes, resourceName]);

  const totals = useMemo(() => {
    const sum = new Map<string, CostPart>();
    picked.forEach(id => {
      (costs.get(id) ?? []).forEach(part => {
        const current = sum.get(part.identificator);
        if (current) current.count += part.count;
        else sum.set(part.identificator, { ...part });
      });
    });
    return [...sum.values()];
  }, [picked, costs]);

  const troops = item?.army.troops ?? [];
  const cannonsTaken = troops.filter(troop => isCannonTroop(troop.troop_type?.name)).length;
  const regularTaken = troops.length - cannonsTaken;
  const pickedRegular = picked.filter(id => {
    const type = troopTypes.find(itemType => itemType.id === id);
    return !isCannonTroop(type?.name);
  }).length;
  const pickedCannon = picked.length - pickedRegular;
  const freeRegular = Math.max(0, REGULAR_SLOTS - regularTaken - pickedRegular);
  const freeCannon = Math.max(0, CANNON_SLOTS - cannonsTaken - pickedCannon);

  const countOf = (id: number) => picked.filter(value => value === id).length;

  const add = (type: TroopType) => {
    const cannon = isCannonTroop(type.name);
    if (cannon ? freeCannon <= 0 : freeRegular <= 0) return;
    setPicked(current => [...current, type.id]);
  };

  const remove = (type: TroopType) => {
    setPicked(current => {
      const index = current.lastIndexOf(type.id);
      if (index === -1) return current;
      const next = [...current];
      next.splice(index, 1);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {step === 'pick' ? 'Набор отрядов' : 'Подтверждение набора'}
              </Text>
              <Text style={styles.subtitle}>{item?.army.name ?? ''}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Закрыть набор отрядов"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {step === 'pick' ? (
            <>
              <Text style={styles.slots}>
                Свободно: {freeRegular} обычных · {freeCannon} пушка
              </Text>
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {troopTypes.map(type => {
                  const cannon = isCannonTroop(type.name);
                  const full = cannon ? freeCannon <= 0 : freeRegular <= 0;
                  const count = countOf(type.id);
                  return (
                    <View key={type.id} style={[styles.row, full && styles.rowFull]}>
                      <TouchableOpacity
                        style={styles.rowMain}
                        onPress={() => add(type)}
                        disabled={full || busy}
                        accessibilityRole="button"
                        accessibilityLabel={`Добавить ${type.name}`}
                      >
                        <Image source={troopImage(type.name)} style={styles.icon} resizeMode="contain" />
                        <View style={styles.rowText}>
                          <Text style={styles.rowTitle}>
                            {type.name}
                            {cannon ? ' · сверх трёх' : ''}
                          </Text>
                          <View style={styles.rowPrice}>
                            <TroopCost parts={costs.get(type.id) ?? []} size={15} />
                          </View>
                        </View>
                      </TouchableOpacity>
                      {count > 0 ? (
                        <View style={styles.counter}>
                          <TouchableOpacity
                            style={styles.counterButton}
                            onPress={() => remove(type)}
                            disabled={busy}
                            accessibilityRole="button"
                            accessibilityLabel={`Убрать ${type.name}`}
                          >
                            <Text style={styles.counterText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.counterValue}>{count}</Text>
                          <TouchableOpacity
                            style={styles.counterButton}
                            onPress={() => add(type)}
                            disabled={full || busy}
                            accessibilityRole="button"
                            accessibilityLabel={`Добавить ${type.name}`}
                          >
                            <Text style={styles.counterText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.addHint}>{full ? 'мест нет' : '+ добавить'}</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Общая цена</Text>
                <View style={styles.summaryValue}>
                  <TroopCost parts={totals} size={16} emptyLabel="—" />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primary, (picked.length === 0 || busy) && styles.primaryDisabled]}
                onPress={() => setStep('confirm')}
                disabled={picked.length === 0 || busy}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>
                  {picked.length === 0 ? 'Выберите отряды' : `Набрать (${picked.length})`}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {troopTypes
                  .filter(type => countOf(type.id) > 0)
                  .map(type => (
                    <View key={type.id} style={styles.confirmRow}>
                      <Image source={troopImage(type.name)} style={styles.icon} resizeMode="contain" />
                      <Text style={styles.confirmName}>{type.name}</Text>
                      <Text style={styles.confirmCount}>×{countOf(type.id)}</Text>
                    </View>
                  ))}
              </ScrollView>
              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Общая цена</Text>
                <View style={styles.summaryValue}>
                  <TroopCost parts={totals} size={16} emptyLabel="—" />
                </View>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.primary, busy && styles.primaryDisabled]}
                onPress={() => onConfirm(picked)}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color="#1d1a14" />
                ) : (
                  <Text style={styles.primaryText}>Подтвердить набор</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => setStep('pick')}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>Назад</Text>
              </TouchableOpacity>
            </>
          )}
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
    maxHeight: '86%',
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
  slots: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  list: {
    marginTop: 10,
    flexGrow: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MAP_COLORS.surfaceRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowFull: {
    opacity: 0.55,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    flex: 1,
  },
  icon: {
    width: 34,
    height: 34,
  },
  rowTitle: {
    color: MAP_COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowPrice: {
    marginTop: 3,
  },
  addHint: {
    color: MAP_COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MAP_COLORS.surface,
    borderWidth: 1,
    borderColor: MAP_COLORS.border,
  },
  counterText: {
    color: MAP_COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  counterValue: {
    color: MAP_COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  summary: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: MAP_COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    color: MAP_COLORS.textMuted,
    fontSize: 13,
  },
  summaryValue: {
    flex: 1,
    alignItems: 'flex-end',
  },
  primary: {
    marginTop: 12,
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
  secondary: {
    marginTop: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryText: {
    color: MAP_COLORS.textMuted,
    fontSize: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  confirmName: {
    flex: 1,
    color: MAP_COLORS.text,
    fontSize: 15,
  },
  confirmCount: {
    color: MAP_COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    marginTop: 10,
    color: '#e0766a',
    fontSize: 12,
  },
});

export default RecruitSheet;
