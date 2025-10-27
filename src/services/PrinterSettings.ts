import AsyncStorage from '@react-native-async-storage/async-storage';

const PRINTER_IP_KEY = 'brother_printer_ip';

export class PrinterSettings {
  static async getPrinterIp(): Promise<string> {
    try {
      const ip = await AsyncStorage.getItem(PRINTER_IP_KEY);
      return ip || '';
    } catch (error) {
      console.error('Failed to get printer IP from storage:', error);
      return '';
    }
  }

  static async setPrinterIp(ip: string): Promise<void> {
    try {
      await AsyncStorage.setItem(PRINTER_IP_KEY, ip);
    } catch (error) {
      console.error('Failed to save printer IP to storage:', error);
      throw error;
    }
  }

  static isValidIp(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }
}
