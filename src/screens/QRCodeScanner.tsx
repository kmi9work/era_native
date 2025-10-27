import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onClose }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  useEffect(() => {
    console.log('Device status:', device ? 'found' : 'not found');
    console.log('Device details:', device);
  }, [device]);

  const requestCameraPermission = async () => {
    try {
      const permission = await Camera.requestCameraPermission();
      
      if (permission === 'granted') {
        setHasPermission(true);
      } else if (permission === 'denied') {
        Alert.alert('Ошибка', 'Разрешение на использование камеры отклонено.');
        onClose();
      } else {
        // permission === 'restricted' or other
        Alert.alert('Ошибка', 'Доступ к камере ограничен.');
        onClose();
      }
    } catch (err) {
      console.warn(err);
      Alert.alert('Ошибка', 'Произошла ошибка при запросе разрешения на камеру.');
      onClose();
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      if (!scanned && codes.length > 0) {
        setScanned(true);
        const value = codes[0].value;
        if (value) {
          console.log('QR-код отсканирован:', value);
          onScan(value);
        }
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Ожидание разрешения на камеру...</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Инициализация камеры...</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Закрыть</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {device != null && hasPermission && (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          codeScanner={codeScanner}
        />
      )}
      <View style={styles.overlay}>
        <Text style={styles.scanText}>
          {scanned ? 'QR-код отсканирован!' : 'Наведите камеру на QR-код'}
        </Text>
        <View style={styles.qrCodeFrame} />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Закрыть</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 20,
  },
  qrCodeFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#00ff00',
    borderRadius: 10,
  },
  closeButton: {
    marginTop: 40,
    backgroundColor: '#1976d2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default QRCodeScanner;