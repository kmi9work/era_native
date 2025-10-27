import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  PermissionsAndroid,
} from 'react-native';
import { Camera, CameraType, useCameraDevices, useFrameProcessor, Frame } from 'react-native-vision-camera';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onClose }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);
  const devices = useCameraDevices();
  const device = devices.back;
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Разрешение на использование камеры',
            message: 'Приложению требуется доступ к камере для сканирования QR-кодов.',
            buttonNeutral: 'Спросить позже',
            buttonNegative: 'Отмена',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULT_GRANTED) {
          setHasPermission(true);
        } else {
          Alert.alert('Ошибка', 'Разрешение на использование камеры отклонено.');
          onClose();
        }
      } catch (err) {
        console.warn(err);
        Alert.alert('Ошибка', 'Произошла ошибка при запросе разрешения на камеру.');
        onClose();
      }
    } else {
      // For iOS, VisionCamera handles permissions automatically on first use
      setHasPermission(true);
    }
  };

  const onBarcodeScanned = (barcodeData: string) => {
    if (!scanned && barcodeData) {
      setScanned(true);
      onScan(barcodeData);
    }
  };

  // Простой frame processor для демонстрации
  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';
    // Здесь можно добавить логику сканирования QR-кодов
    // Пока что просто заглушка
  }, [scanned]);

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
        <Text style={styles.permissionText}>Камера не найдена.</Text>
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
          frameProcessor={frameProcessor}
          frameProcessorFps={5}
        />
      )}
      <View style={styles.overlay}>
        <Text style={styles.scanText}>Сканируйте QR-код</Text>
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