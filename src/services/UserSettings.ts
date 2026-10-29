/**
 * «Кто я» на этом планшете: выбранный мастер хранится в AsyncStorage.
 *
 * Единственный персист клиента игровых настроек (по образцу PrinterSettings):
 * уведомления адресованы пользователю, поэтому устройство должно знать, за кого
 * оно работает. Игровые данные по-прежнему не персистятся.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppUser } from '../types';

const CURRENT_USER_KEY = 'era_current_user';

export class UserSettings {
  static async getUser(): Promise<AppUser | null> {
    try {
      const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as AppUser;
      if (!parsed || typeof parsed.id !== 'number') return null;

      return parsed;
    } catch (error) {
      return null;
    }
  }

  static async setUser(user: AppUser | null): Promise<void> {
    try {
      if (user === null) {
        await AsyncStorage.removeItem(CURRENT_USER_KEY);
        return;
      }

      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (error) {}
  }
}
