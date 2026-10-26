import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WorkshopCountry } from '../services/guildWorkshop';

/**
 * Строка «где гильдии разрешено строить и работать» на экране «Предприятия
 * гильдии».
 *
 * Запрет один (п. 0-2 правил), поэтому список показывает государства, в которых
 * разрешение открыто: по умолчанию это страна гильдии, а Казначей и мастера
 * могут открыть или закрыть её в других государствах. Данные — только с бэкенда
 * (`GET /many_teams/guilds/:id/workshop`, поле `countries[].allowed`), клиент
 * ничего не вычисляет.
 */
export default function BuildCountriesNotice({
  countries,
  loading,
}: {
  countries?: WorkshopCountry[];
  loading?: boolean;
}) {
  if (loading && !countries) {
    return (
      <View style={styles.notice}>
        <Text style={styles.label}>Строительство и работа: загрузка…</Text>
      </View>
    );
  }

  if (!countries) {
    return null;
  }

  const allowed = countries.filter((country) => country.allowed);
  const names = allowed.map((country) => `«${country.country_name}»`).join(', ');

  return (
    <View style={[styles.notice, allowed.length ? styles.noticeAllowed : styles.noticeForbidden]}>
      <Text style={styles.label}>
        {allowed.length
          ? `Строительство и работа разрешены в землях: ${names}`
          : 'Строительство и работа запрещены во всех государствах'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  noticeAllowed: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2e7d32',
  },
  noticeForbidden: {
    backgroundColor: '#ffebee',
    borderColor: '#c62828',
  },
  label: {
    color: '#1b1b1b',
    fontSize: 12,
    fontWeight: '600',
  },
});
