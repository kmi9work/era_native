import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useBarcodeScannerUniversal } from '../hooks/useBarcodeScannerUniversal';

type ScreenScope = 'processing' | 'plantWorkshop';

const DEBUG = true;

export type BarcodeScanListener = (value: string) => void;

interface BarcodeScannerContextValue {
  isConnected: boolean;
  digitSequence: string;
  lastScan: string | null;
  addListener: (scope: ScreenScope, listener: BarcodeScanListener) => () => void;
  requestReconnect: () => void;
}

const BarcodeScannerContext = createContext<BarcodeScannerContextValue | undefined>(undefined);

interface ListenerEntry {
  scope: ScreenScope;
  listener: BarcodeScanListener;
}

export const BarcodeScannerProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const listenersRef = useRef<ListenerEntry[]>([]);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const handleScanComplete = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      return;
    }

    if (DEBUG) {
      console.log('[ScannerContext] Scan completed:', trimmed);
    }

    setLastScan(trimmed);

    const entries = listenersRef.current;
    if (DEBUG) {
      console.log('[ScannerContext] Active listeners:', entries.map((entry) => entry.scope));
    }
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const { scope, listener } = entries[i];
      if (listener) {
        if (DEBUG) {
          console.log('[ScannerContext] Dispatching scan to scope:', scope);
        }
        try {
          listener(trimmed);
        } catch (error) {
          if (DEBUG) {
            console.log('[ScannerContext] Listener threw error:', error);
          }
        }
        break;
      }
    }
  }, []);

  const { digitSequence, isConnected, requestReconnect } = useBarcodeScannerUniversal({
    digitCount: 9,
    onScanComplete: handleScanComplete,
    enableDebug: false,
    detectNewline: true,
  });

  const reconnectRequestedRef = useRef(false);

  useEffect(() => {
    if (isConnected) {
      reconnectRequestedRef.current = false;
      return;
    }

    if (!reconnectRequestedRef.current) {
      reconnectRequestedRef.current = true;
      if (DEBUG) {
        console.log('[ScannerContext] Connection lost, requesting reconnect…');
      }
      requestReconnect();
    }
  }, [isConnected, requestReconnect]);

  const addListener = useCallback((scope: ScreenScope, listener: BarcodeScanListener) => {
    listenersRef.current = [
      ...listenersRef.current.filter((entry) => entry.scope === scope),
      { scope, listener },
    ];
    if (DEBUG) {
      console.log('[ScannerContext] Listener added for scope:', scope);
      console.log('[ScannerContext] Current listeners:', listenersRef.current.map((entry) => entry.scope));
    }
    return () => {
      listenersRef.current = listenersRef.current.filter((entry) => entry.listener !== listener);
      if (DEBUG) {
        console.log('[ScannerContext] Listener removed for scope:', scope);
        console.log('[ScannerContext] Current listeners:', listenersRef.current.map((entry) => entry.scope));
      }
    };
  }, []);

  const value = useMemo<BarcodeScannerContextValue>(() => ({
    isConnected,
    digitSequence,
    lastScan,
    addListener,
    requestReconnect,
  }), [isConnected, digitSequence, lastScan, addListener, requestReconnect]);

  return (
    <BarcodeScannerContext.Provider value={value}>
      {children}
    </BarcodeScannerContext.Provider>
  );
};

export const useBarcodeScannerContext = (): BarcodeScannerContextValue => {
  const context = useContext(BarcodeScannerContext);
  if (!context) {
    throw new Error('useBarcodeScannerContext должен использоваться внутри BarcodeScannerProvider');
  }
  return context;
};
