/**
 * Стоимость отряда (набора) — значками ресурсов, а не текстом (решение заказчика).
 *
 * Цена приходит с сервера: `TroopType#params.buy_cost` = [{ identificator, count }],
 * русские названия — из справочника `/resources.json`. Значок ресурса — картинка
 * бэкенда `/images/resources/<identificator>.png`; название нужно только для
 * доступности и подсказки, числом подписано количество.
 *
 * Части с количеством 0 не рисуются: в старой базе (до миграции
 * `update_troop_type_costs`) в buy_cost лежат нулевые строки, и на экране
 * появлялись значки с нулями вместо цены.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { resourceIconUrl } from '../../services/images';
import { MAP_COLORS } from './mapStyle';

export interface CostPart {
  identificator: string;
  name: string;
  count: number;
}

interface Props {
  parts: CostPart[];
  /** Размер значка, dp. */
  size?: number;
  /** Что показать, если цена пустая (бесплатно). */
  emptyLabel?: string;
}

const TroopCost = ({ parts, size = 16, emptyLabel = 'бесплатно' }: Props) => {
  const visible = parts.filter(part => part.count > 0);
  if (visible.length === 0) {
    return <Text style={[styles.empty, { fontSize: Math.round(size * 0.75) }]}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.row}>
      {visible.map((part, index) => (
        <React.Fragment key={`${part.identificator}-${index}`}>
          {index > 0 ? <Text style={[styles.plus, { fontSize: Math.round(size * 0.75) }]}>+</Text> : null}
          <View
            style={styles.part}
            accessible
            accessibilityLabel={`${part.name}: ${part.count}`}
          >
            <Image
              source={{ uri: resourceIconUrl(part.identificator) }}
              style={{ width: size, height: size }}
              resizeMode="contain"
            />
            <Text style={[styles.count, { fontSize: Math.round(size * 0.8) }]}>{part.count}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  part: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  count: {
    color: MAP_COLORS.text,
    fontWeight: '700',
  },
  plus: {
    color: MAP_COLORS.textMuted,
    fontWeight: '700',
  },
  empty: {
    color: MAP_COLORS.textMuted,
  },
});

export default TroopCost;
