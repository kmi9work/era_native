/**
 * Текущий мастер на устройстве: кто нажал «я» в настройках.
 *
 * Нужен, чтобы получать ПЕРСОНАЛЬНЫЕ уведомления: бэкенд адресует их
 * пользователю (users), а не устройству. Один человек может держать веб-админку
 * и планшет — подтверждение с любого из них снимает окно на остальных.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UserSettings } from '../services/UserSettings';
import type { AppUser } from '../types';

interface UserContextValue {
  user: AppUser | null;
  /** false, пока AsyncStorage не прочитан: до этого не решаем, есть ли уведомления */
  isReady: boolean;
  setUser: (user: AppUser | null) => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUserState] = useState<AppUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    UserSettings.getUser().then((stored) => {
      if (cancelled) return;
      setUserState(stored);
      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setUser = useCallback(async (next: AppUser | null) => {
    setUserState(next);
    await UserSettings.setUser(next);
  }, []);

  const value = useMemo(() => ({ user, isReady, setUser }), [user, isReady, setUser]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useAppUser = (): UserContextValue => {
  const value = useContext(UserContext);
  if (!value) throw new Error('useAppUser вызван вне UserProvider');

  return value;
};
