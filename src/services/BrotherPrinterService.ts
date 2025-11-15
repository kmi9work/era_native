import { NativeModules } from 'react-native';
import { PrinterSettings } from './PrinterSettings';

const { BrotherPrinterModule } = NativeModules;

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
      
      if (!BrotherPrinterModule) {
        throw new Error('Нативный модуль Brother Printer недоступен. Убедитесь, что Development Build содержит Brother SDK.');
      }
      
      if (!printerIp) {
        return { 
          success: false, 
          error: 'IP-адрес принтера не настроен. Укажите IP-адрес в настройках.'
        };
      }

      const result = await BrotherPrinterModule.printBarcode(plantId, printerIp, guildName, regionName);
      return { success: result };
    } catch (error) {
      let errorMessage = 'Неизвестная ошибка печати';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Улучшаем сообщения об ошибках подключения
        if (errorMessage.includes('OPEN_CHANNEL_ERROR') || errorMessage.includes('Failed to open printer channel')) {
          errorMessage = 'Не удалось подключиться к принтеру. Проверьте:\n1. IP-адрес принтера\n2. Настройки роутера (AP Isolation должен быть отключен)\n3. Firewall правила на роутере\n4. Убедитесь, что принтер включен и подключен к той же WiFi сети';
        }
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
        // Простая HTTP проверка
        try {
          const response = await fetch(`http://${ip}`, { method: 'GET', timeout: 5000 });
          return { success: response.ok };
        } catch (error) {
          return { success: false, error: 'Принтер недоступен. Проверьте IP-адрес и настройки роутера (AP Isolation должен быть отключен).' };
        }
      }
      
      const result = await BrotherPrinterModule.testConnection(ip);
      // Результат может быть boolean или объект
      if (typeof result === 'boolean') {
        if (result) {
          return { success: true };
        } else {
          return { 
            success: false, 
            error: 'Не удалось подключиться к принтеру. Проверьте:\n1. IP-адрес принтера\n2. Настройки роутера (AP Isolation должен быть отключен)\n3. Firewall правила на роутере'
          };
        }
      }
      
      if (result && result.success) {
        return { success: true };
      }
      
      return { 
        success: false, 
        error: result?.error || 'Ошибка подключения к принтеру. Проверьте настройки роутера (AP Isolation должен быть отключен).'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка подключения к принтеру';
      return { 
        success: false, 
        error: `${errorMessage}. Проверьте настройки роутера Mikrotik (AP Isolation должен быть отключен).`
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
    return;
  }

  /**
   * Симуляция проверки подключения
   */
  private static async simulateConnectionTest(ip: string): Promise<void> {
    // Симуляция времени проверки
    await new Promise(resolve => setTimeout(resolve, 1000));
    return;
  }
}
