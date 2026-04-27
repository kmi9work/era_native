import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';

interface BarcodeScannerConnectOptions {
  deviceName?: string;
  deviceAddress?: string;
}

interface BarcodeScannerNativeModule {
  isSupported?: boolean;
  EVENT_DATA?: string;
  EVENT_STATUS?: string;
  connect(options?: BarcodeScannerConnectOptions): Promise<boolean>;
  disconnect(): Promise<boolean>;
  isConnected?(): Promise<boolean>;
  getBondedDevices?(): Promise<any>;
}

interface UseBarcodeScannerUniversalOptions {
  /**
   * Количество цифр для полного ID (по умолчанию 9)
   */
  digitCount?: number;

  /**
   * Таймаут сброса последовательности в миллисекундах (по умолчанию 3000)
   */
  timeout?: number;

  /**
   * Callback функция, вызываемая когда штрихкод полностью считан
   * @param id - Считанный ID (строка из digitCount цифр)
   */
  onScanComplete: (id: string) => void;

  /**
   * Включить логирование для отладки (по умолчанию false)
   */
  enableDebug?: boolean;

  /**
   * Обрабатывать символ новой строки (\n) как признак завершения считывания
   * (по умолчанию true, используется для корректной обработки пакетов из нативного модуля)
   */
  detectNewline?: boolean;

  /**
   * Имя Bluetooth-устройства сканера (необязательно, используется для выбора конкретного устройства)
   */
  bluetoothDeviceName?: string;

  /**
   * Bluetooth-адрес сканера (приоритет выше имени, если указан)
   */
  bluetoothDeviceAddress?: string;
}

interface UseBarcodeScannerUniversalReturn {
  /**
   * Текущая последовательность набранных цифр
   */
  digitSequence: string;

  /**
   * Есть ли активное подключение к нативному сканеру
   */
  isConnected: boolean;

  /**
   * Запросить повторное подключение (используется при ручном восстановлении)
   */
  requestReconnect: () => void;
}

const BarcodeScannerModule: BarcodeScannerNativeModule | undefined = Platform.OS === 'android'
  ? (NativeModules as { BarcodeScannerModule?: BarcodeScannerNativeModule }).BarcodeScannerModule
  : undefined;

const getAndroidVersion = (): number => {
  if (typeof Platform.Version === 'number') {
    return Platform.Version;
  }
  const parsed = parseInt(`${Platform.Version}`, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const ensureBluetoothPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const androidVersion = getAndroidVersion();
  if (androidVersion < 31) {
    // Для Android до 12 включительно отдельные разрешения не требуются
    return true;
  }

  const connectPermission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
  if (!connectPermission) {
    return true;
  }

  try {
    const alreadyGranted = await PermissionsAndroid.check(connectPermission);
    if (alreadyGranted) {
      return true;
    }

    const result = await PermissionsAndroid.request(connectPermission, {
      title: 'Доступ к Bluetooth',
      message: 'Приложению требуется доступ к Bluetooth для работы со сканером штрихкодов.',
      buttonPositive: 'Разрешить',
      buttonNegative: 'Запретить',
    });

    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    return false;
  }
};

/**
 * Универсальный хук для считывания штрихкодов
 *
 * Использует нативный модуль Android для Bluetooth SPP.
 */
export const useBarcodeScannerUniversal = ({
  digitCount = 9,
  timeout = 3000,
  onScanComplete,
  enableDebug = false,
  detectNewline = true,
  bluetoothDeviceName,
  bluetoothDeviceAddress,
}: UseBarcodeScannerUniversalOptions): UseBarcodeScannerUniversalReturn => {
  if (enableDebug && Platform.OS === 'android') {
    // debug disabled
  }

  const [isConnected, setIsConnected] = useState(false);
  const [nativeDigitSequence, setNativeDigitSequence] = useState('');
  const digitSequenceRef = useRef('');
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [connectAttempt, setConnectAttempt] = useState(0);

  const resetSequence = useCallback(() => {
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
    digitSequenceRef.current = '';
    setNativeDigitSequence('');
  }, []);

  const finalizeSequence = useCallback(() => {
    if (digitSequenceRef.current.length === 0) {
      resetSequence();
      return;
    }

    const fullId = digitSequenceRef.current.substring(0, digitCount);
    if (enableDebug) {
      // debug disabled
    }
    onScanComplete(fullId);
    resetSequence();
  }, [digitCount, enableDebug, onScanComplete, resetSequence]);

  const scheduleReset = useCallback(() => {
    if (timeout <= 0) {
      return;
    }
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
    }
    sequenceTimeoutRef.current = setTimeout(() => {
      if (enableDebug) {
        // debug disabled
      }
      digitSequenceRef.current = '';
      setNativeDigitSequence('');
      sequenceTimeoutRef.current = null;
    }, timeout);
  }, [enableDebug, timeout]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (retryTimerRef.current) {
      return;
    }
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setConnectAttempt((prev) => prev + 1);
    }, 3000);
  }, []);

  const requestReconnect = useCallback(() => {
    clearRetryTimer();
    setConnectAttempt((prev) => prev + 1);
  }, [clearRetryTimer]);

  const handleNativeChunk = useCallback((chunk: string) => {
    if (!chunk) {
      return;
    }

    const hasTerminator = detectNewline ? /[\r\n]/.test(chunk) : false;
    const digitsOnly = chunk.replace(/[^0-9]/g, '');

    if (enableDebug) {
      // debug disabled
    }

    if (digitsOnly.length > 0) {
      digitSequenceRef.current += digitsOnly;
      setNativeDigitSequence(digitSequenceRef.current);
    }

    if (digitSequenceRef.current.length >= digitCount) {
      finalizeSequence();
      return;
    }

    if (hasTerminator) {
      if (digitSequenceRef.current.length > 0) {
        finalizeSequence();
      } else {
        resetSequence();
      }
      return;
    }

    if (digitsOnly.length > 0) {
      scheduleReset();
    }
  }, [detectNewline, digitCount, enableDebug, finalizeSequence, resetSequence, scheduleReset]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !BarcodeScannerModule || BarcodeScannerModule.isSupported === false) {
      setIsConnected(false);
      return;
    }

    let mounted = true;
    let dataSubscription: EmitterSubscription | null = null;
    let statusSubscription: EmitterSubscription | null = null;
    const eventEmitter = new NativeEventEmitter(BarcodeScannerModule as any);

    const cleanup = async (disconnect = false) => {
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }
      if (statusSubscription) {
        statusSubscription.remove();
        statusSubscription = null;
      }
      if (disconnect && BarcodeScannerModule) {
        try {
          await BarcodeScannerModule.disconnect();
        } catch (error) {
          if (enableDebug) {
            // debug disabled
          }
        }
      }
    };

    const startNativeScanner = async () => {
      const permissionsGranted = await ensureBluetoothPermissions();
      if (!permissionsGranted) {
        if (enableDebug) {
          // debug disabled
        }
        return;
      }

      const dataEventName = BarcodeScannerModule.EVENT_DATA || 'BarcodeScannerData';
      const statusEventName = BarcodeScannerModule.EVENT_STATUS || 'BarcodeScannerStatus';

      dataSubscription = eventEmitter.addListener(dataEventName, (event: any) => {
        if (!mounted) {
          if (enableDebug) {
            // debug disabled
          }
          return;
        }
        const payload = typeof event === 'string' ? event : event?.data;
        if (typeof payload === 'string') {
          handleNativeChunk(payload);
        }
      });

      statusSubscription = eventEmitter.addListener(statusEventName, (event: any) => {
        if (!mounted) {
          if (enableDebug) {
            // debug disabled
          }
          return;
        }
        if (enableDebug) {
          // debug disabled
        }
        if (event?.state === 'disconnected') {
          if (enableDebug) {
            // debug disabled
          }
          setIsConnected(false);
          resetSequence();
          scheduleReconnect();
        }
        if (event?.state === 'connected') {
          if (enableDebug) {
            // debug disabled
          }
          setIsConnected(true);
          clearRetryTimer();
        }
        if (event?.state === 'error') {
          if (enableDebug) {
            // debug disabled
          }
          setIsConnected(false);
          scheduleReconnect();
        }
      });

      try {
        await BarcodeScannerModule.connect({
          deviceName: bluetoothDeviceName,
          deviceAddress: bluetoothDeviceAddress,
        });
        if (!mounted) {
          if (enableDebug) {
            // debug disabled
          }
          await cleanup(true);
          return;
        }
        if (enableDebug) {
          // debug disabled
        }
        setIsConnected(true);
        clearRetryTimer();
      } catch (error) {
        setIsConnected(false);
        if (enableDebug) {
          // debug disabled
        }
        await cleanup(true);
        scheduleReconnect();
      }
    };

    startNativeScanner();

    return () => {
      mounted = false;
      if (enableDebug) {
        // debug disabled
      }
      resetSequence();
      clearRetryTimer();
      cleanup(true).finally(() => {
        setIsConnected(false);
      });
    };
  }, [bluetoothDeviceAddress, bluetoothDeviceName, enableDebug, handleNativeChunk, resetSequence, scheduleReconnect, clearRetryTimer, connectAttempt]);

  return {
    digitSequence: nativeDigitSequence,
    isConnected,
    requestReconnect,
  };
};

