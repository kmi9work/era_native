import { NativeModules } from 'react-native';
import { PrinterSettings } from './PrinterSettings';

const { BrotherPrinterModule } = NativeModules;

// Диагностика доступности нативного модуля
console.log('=== BROTHER PRINTER DIAGNOSTICS ===');
console.log('NativeModules keys:', Object.keys(NativeModules));
console.log('BrotherPrinterModule:', BrotherPrinterModule);
console.log('BrotherPrinterModule type:', typeof BrotherPrinterModule);
console.log('BrotherPrinterModule available:', !!BrotherPrinterModule);
console.log('===================================');

export interface PrinterInfo {
  ip: string;
  model: string;
  name?: string;
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

export interface BarcodeDisplayOptions {
  showNumbers?: boolean;  // Показывать ли цифры под штрихкодом
  barcodeFormat?: 'CODE128' | 'CODE39' | 'EAN13' | 'QR_CODE';  // Формат штрихкода
  textSize?: number;  // Размер шрифта для цифр
}

export class BrotherPrinterService {
  /**
   * Печать штрихкода с ID предприятия и информацией
   * @param plantId ID предприятия (будет отформатирован в %09d)
   * @param guildName Название гильдии
   * @param regionName Название региона
   * @param options Опции отображения штрихкода
   */
  static async printBarcode(plantId: number, guildName: string, regionName: string, options?: BarcodeDisplayOptions): Promise<PrintResult> {
    try {
      const printerIp = await PrinterSettings.getPrinterIp();
      const formattedId = plantId.toString().padStart(9, '0');
      
      console.log('=== BROTHER PRINTER SERVICE DEBUG ===');
      console.log('PlantId received:', plantId);
      console.log('FormattedId:', formattedId);
      console.log('GuildName:', guildName);
      console.log('RegionName:', regionName);
      console.log('PrinterIp:', printerIp);
      console.log('Display options:', options);
      
      if (!BrotherPrinterModule) {
        throw new Error('Нативный модуль Brother Printer недоступен. Убедитесь, что Development Build содержит Brother SDK.');
      }
      
      const result = await BrotherPrinterModule.printBarcode(plantId, printerIp, guildName, regionName);
      return { success: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка печати';
      
      // Не выводим в консоль ошибку OpenStreamFailure
      if (!errorMessage.includes('OpenStreamFailure')) {
        console.error('Ошибка печати штрихкода:', error);
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  /**
   * Поиск принтеров Brother в локальной сети
   */
  static async searchPrinters(): Promise<PrinterInfo[]> {
    try {
      
      if (!BrotherPrinterModule) {
        throw new Error('Нативный модуль Brother Printer недоступен. Убедитесь, что Development Build содержит Brother SDK.');
      }
      
      const printers = await BrotherPrinterModule.searchPrinters();
      return printers.map((p: any) => ({
        ip: p.ip,
        model: p.model,
        name: p.name
      }));
    } catch (error) {
      console.error('Ошибка поиска принтеров:', error);
      return [];
    }
  }

  /**
   * Проверка подключения к принтеру
   * @param ip IP-адрес принтера
   */
  static async testConnection(ip: string): Promise<PrintResult> {
    try {
      if (!PrinterSettings.isValidIp(ip)) {
        return { success: false, error: 'Неверный формат IP-адреса' };
      }

      
      if (!BrotherPrinterModule) {
        console.warn('Нативный модуль недоступен, используем HTTP fallback');
        // Простая HTTP проверка
        try {
          const response = await fetch(`http://${ip}`, { method: 'GET', timeout: 5000 });
          return { success: response.ok };
        } catch (error) {
          return { success: false, error: 'Принтер недоступен' };
        }
      }
      
      const result = await BrotherPrinterModule.testConnection(ip);
      return { success: result };
    } catch (error) {
      console.error('Ошибка проверки подключения:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Ошибка подключения к принтеру'
      };
    }
  }

  /**
   * Получить текущий IP-адрес принтера из настроек
   */
  static async getPrinterIp(): Promise<string> {
    return await PrinterSettings.getPrinterIp();
  }

  /**
   * Установить IP-адрес принтера в настройки
   * @param ip IP-адрес принтера
   */
  static async setPrinterIp(ip: string): Promise<void> {
    if (!PrinterSettings.isValidIp(ip)) {
      throw new Error('Неверный формат IP-адреса');
    }
    await PrinterSettings.setPrinterIp(ip);
  }


  /**
   * Симуляция печати для тестирования
   */
  private static async simulatePrint(formattedId: string): Promise<void> {
    // Симуляция времени печати
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`Штрихкод ${formattedId} успешно напечатан`);
  }

  /**
   * Симуляция проверки подключения
   */
  private static async simulateConnectionTest(ip: string): Promise<void> {
    // Симуляция времени проверки
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Подключение к ${ip} проверено`);
  }
}
