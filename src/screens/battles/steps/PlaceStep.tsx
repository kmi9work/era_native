/**
 * Шаг 1. Место сражения.
 *
 * Мастер выбирает поле или город; для города — страна, затем сам город.
 * Здесь же видно, что даст город: крепость (её уровень) и столица ли он.
 */
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getErrorMessage } from '../../../data/apiErrors';
import { isCapitalSettlement } from '../../../services/battleRules';
import type { BattleLogic } from '../../hooks/useBattleLogic';

const PlaceStep: React.FC<{ logic: BattleLogic }> = ({ logic }) => {
  const settlementsLoading = logic.settlementsQuery.isLoading || logic.regionsQuery.isLoading;
  const settlementsError = logic.settlementsQuery.error || logic.regionsQuery.error;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Где проходит сражение</Text>

      <View style={styles.optionsRow}>
        <TouchableOpacity
          style={[styles.option, logic.placeKind === 'field' ? styles.optionActive : null]}
          onPress={() => logic.setPlaceKind('field')}
        >
          <Text style={styles.optionIcon}>🌾</Text>
          <Text style={[styles.optionTitle, logic.placeKind === 'field' ? styles.optionTitleActive : null]}>
            В поле
          </Text>
          <Text style={styles.optionText}>Без города и крепости</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, logic.placeKind === 'city' ? styles.optionActive : null]}
          onPress={() => logic.setPlaceKind('city')}
        >
          <Text style={styles.optionIcon}>🏰</Text>
          <Text style={[styles.optionTitle, logic.placeKind === 'city' ? styles.optionTitleActive : null]}>
            За город
          </Text>
          <Text style={styles.optionText}>Атакующие захватывают город</Text>
        </TouchableOpacity>
      </View>

      {logic.placeKind === 'city' ? (
        <View style={styles.cityBlock}>
          {settlementsLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#1976d2" />
              <Text style={styles.loadingText}>Загружаем города…</Text>
            </View>
          ) : null}

          {settlementsError ? (
            <Text style={styles.error}>{getErrorMessage(settlementsError, 'Не удалось загрузить города')}</Text>
          ) : null}

          <Text style={styles.sectionTitle}>Страна</Text>
          <View style={styles.chipsRow}>
            {logic.countries.map(country => (
              <TouchableOpacity
                key={country.id}
                style={[
                  styles.chip,
                  logic.selectedCountryId === country.id ? styles.chipActive : null,
                ]}
                onPress={() => logic.selectCountry(country.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    logic.selectedCountryId === country.id ? styles.chipTextActive : null,
                  ]}
                >
                  {country.name}
                </Text>
              </TouchableOpacity>
            ))}
            {logic.countries.length === 0 && !settlementsLoading ? (
              <Text style={styles.hint}>Список государств пуст — проверьте связь с бэкендом.</Text>
            ) : null}
          </View>

          {logic.selectedCountryId !== null ? (
            <>
              <Text style={styles.sectionTitle}>Город</Text>
              {logic.cities.length === 0 ? (
                <Text style={styles.hint}>У этого государства нет городов.</Text>
              ) : (
                logic.cities.map(city => {
                  const active = logic.selectedSettlementId === city.id;
                  const capital = isCapitalSettlement(city);
                  const fortress = (city.buildings || []).some(
                    building =>
                      (building.building_type_name ||
                        building.building_level?.building_type?.name) === 'Кремль',
                  );
                  const typeName = city.settlement_type?.name || 'поселение';
                  const meta = [typeName];
                  if (capital && typeName.toLowerCase() !== 'столица') meta.push('столица');
                  if (fortress) meta.push('есть крепость');
                  return (
                    <TouchableOpacity
                      key={city.id}
                      style={[styles.cityRow, active ? styles.cityRowActive : null]}
                      onPress={() => logic.selectSettlement(city.id)}
                    >
                      <View style={styles.cityInfo}>
                        <Text style={[styles.cityName, active ? styles.cityNameActive : null]}>
                          {city.name}
                        </Text>
                        <Text style={styles.cityMeta}>{meta.join(' · ')}</Text>
                      </View>
                      <Text style={styles.cityCheck}>{active ? '✓' : ''}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : null}

          {logic.selectedSettlement ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{logic.selectedSettlement.name}</Text>
              <Text style={styles.summaryLine}>
                Крепость: {logic.fortressLevel > 0 ? `${logic.fortressLevel} уровень` : 'нет'}
              </Text>
              <Text style={styles.summaryLine}>
                {logic.isCapital ? 'Столица государства' : 'Не столица'}
              </Text>
              <Text style={styles.summaryLine}>
                Город добавит защищающимся пехоту
                {logic.fortressLevel === 2 ? ' и +1 к кубикам' : ''}
                {logic.fortressLevel >= 3 ? ' и +2 к кубикам' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.hint}>
        Дальше — набор армий с бэкенда: атакующие сверху, защищающиеся снизу.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#263238',
    marginBottom: 8,
    marginTop: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 14,
  },
  optionActive: {
    borderColor: '#1976d2',
    borderWidth: 2,
    backgroundColor: '#e3f2fd',
  },
  optionIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#37474f',
    marginBottom: 3,
  },
  optionTitleActive: {
    color: '#0d47a1',
  },
  optionText: {
    fontSize: 11,
    color: '#78909c',
  },
  cityBlock: {
    marginTop: 6,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#607d8b',
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    color: '#c62828',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 6,
    marginBottom: 6,
  },
  chipActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  chipText: {
    fontSize: 12,
    color: '#37474f',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    marginBottom: 6,
  },
  cityRowActive: {
    borderColor: '#1976d2',
    borderWidth: 2,
    backgroundColor: '#e3f2fd',
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#263238',
  },
  cityNameActive: {
    color: '#0d47a1',
  },
  cityMeta: {
    fontSize: 11,
    color: '#78909c',
    marginTop: 2,
  },
  cityCheck: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '700',
  },
  summary: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5d4037',
    marginBottom: 4,
  },
  summaryLine: {
    fontSize: 12,
    color: '#6d4c41',
    marginBottom: 2,
  },
  hint: {
    fontSize: 12,
    color: '#90a4ae',
    marginTop: 14,
    lineHeight: 17,
  },
});

export default PlaceStep;
