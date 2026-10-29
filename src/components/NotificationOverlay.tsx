/**
 * Полноэкранное уведомление мастера.
 *
 * Требование заказчика: окно всплывает на весь экран в момент события и НЕ
 * закрывается, пока мастер не нажмёт «Ок». Поэтому:
 *  - системная «назад» и тап по фону окно не закрывают (`onRequestClose` пуст);
 *  - показываем по одному из очереди неподтверждённых, «Ок» подтверждает
 *    текущее (`PATCH /notifications/:id/acknowledge.json`) и открывает следующее;
 *  - окно живёт на корне приложения, поэтому висит над любым экраном, включая бой.
 *
 * Опрос держим сами: в слое данных опрос идёт только при подписчике «в фокусе»,
 * а этот компонент не является экраном навигации.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ApiService from '../services/api';
import { useAppUser } from '../context/UserContext';
import { queryKeys } from '../data/keys';
import { queryClient } from '../data/queryClient';
import { useNotifications } from '../data/hooks/useNotifications';
import type { AppNotification } from '../types';

export interface NotificationOverlayViewProps {
  notification: AppNotification | null;
  onAcknowledge: () => void;
  isAcknowledging?: boolean;
}

/** Презентационная часть: тестируется без контекста и без сети. */
export const NotificationOverlayView = ({
  notification,
  onAcknowledge,
  isAcknowledging = false,
}: NotificationOverlayViewProps) => (
  <Modal
    visible={notification !== null}
    animationType="fade"
    transparent={false}
    statusBarTranslucent
    // Пустой обработчик — сознательно: уйти с окна можно только кнопкой «Ок».
    onRequestClose={() => {}}
  >
    <View style={styles.container} testID="notification-overlay">
      <Text style={styles.icon}>🔔</Text>
      <Text style={styles.title}>{notification?.title ?? ''}</Text>
      {notification?.body ? <Text style={styles.body}>{notification.body}</Text> : null}
      <Text style={styles.hint}>Окно закроется только после подтверждения</Text>

      <TouchableOpacity
        style={[styles.button, isAcknowledging && styles.buttonDisabled]}
        onPress={onAcknowledge}
        disabled={isAcknowledging}
        accessibilityRole="button"
        accessibilityLabel="Подтвердить уведомление"
      >
        <Text style={styles.buttonText}>Ок</Text>
      </TouchableOpacity>
    </View>
  </Modal>
);

const NotificationOverlay = () => {
  const { user, isReady } = useAppUser();
  const userId = isReady ? user?.id ?? null : null;
  const userIdString = userId == null ? '' : String(userId);

  const query = useNotifications(userId);
  const notifications = useMemo(() => (query.data as AppNotification[]) ?? [], [query.data]);
  const current = notifications[0] ?? null;

  const [isAcknowledging, setIsAcknowledging] = useState(false);

  // Опрос включается только у ключа «в фокусе»: держим фокус на всё время жизни
  // приложения, иначе уведомление пришло бы лишь при возврате на экран.
  useEffect(() => {
    if (userId == null) return undefined;

    const key = queryKeys.notifications(userId);
    queryClient.setFocused(key, 1);

    return () => {
      queryClient.setFocused(key, -1);
    };
  }, [userIdString]); // eslint-disable-line react-hooks/exhaustive-deps

  const acknowledge = useCallback(async () => {
    if (!current || userId == null || isAcknowledging) return;

    setIsAcknowledging(true);
    try {
      await ApiService.acknowledgeNotification(current.id, userId);
      // Подтверждение снимает окно на ВСЕХ устройствах этого мастера — поэтому
      // перечитываем список у сервера, а не просто выкидываем строку локально.
      await queryClient.refetch([queryKeys.notifications(userId)], { force: true });
    } catch (error) {
      // Нет связи — окно остаётся на экране, следующий опрос повторит попытку.
    } finally {
      setIsAcknowledging(false);
    }
  }, [current, userId, isAcknowledging]);

  return (
    <NotificationOverlayView
      notification={current}
      onAcknowledge={acknowledge}
      isAcknowledging={isAcknowledging}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  body: {
    fontSize: 20,
    textAlign: 'center',
    color: '#444444',
    marginBottom: 16,
  },
  hint: {
    fontSize: 15,
    textAlign: 'center',
    color: '#8a8a8a',
    marginBottom: 40,
  },
  button: {
    minWidth: 220,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: '#1e88e5',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default NotificationOverlay;
