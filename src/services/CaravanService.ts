import { Country, Resource } from '../types';

interface CaravanResources {
  off_market: Resource[];
  to_market: Resource[];
}

interface CaravanResult {
  res_to_player: Array<{
    name: string;
    identificator: string;
    count: number;
  }>;
  total_purchase_cost: number;
  total_sale_income: number;
}

class CaravanService {
  private resources: CaravanResources = { off_market: [], to_market: [] };
  private countries: Country[] = [];

  // Установить ресурсы
  setResources(newResources: CaravanResources): void {
    this.resources = newResources;
  }

  // Установить страны
  setCountries(newCountries: Country[]): void {
    this.countries = newCountries;
  }

  // Получить ресурс по идентификатору
  getResourceByIdentificator(identificator: string): Resource | undefined {
    const allResources = [...this.resources.off_market, ...this.resources.to_market];
    return allResources.find(r => r.identificator === identificator);
  }

  // Получить страну по ID
  getCountryById(countryId: number): Country | undefined {
    return this.countries.find(c => c.id === countryId);
  }

  /**
   * Фильтрует ресурсы по стране (оставляет только те, что принимает данная страна)
   */
  countryFilter(countryId: number, resourcesList: Array<{ identificator: string; count?: number | null }>): Array<{ identificator: string; count?: number | null }> {
    if (!countryId || !resourcesList || !Array.isArray(resourcesList)) {
      return [];
    }

    // Получаем все ресурсы, которые принимает эта страна (из обоих списков)
    const allResources = [...this.resources.off_market, ...this.resources.to_market];
    const countryResources = allResources.filter(r =>
      r.country_id === countryId || r.country?.id === countryId
    );
    const countryIdentificators = countryResources.map(r => r.identificator);

    // Фильтруем входящий список
    return resourcesList.filter(res =>
      countryIdentificators.includes(res.identificator)
    );
  }

  /**
   * Вычисляет стоимость транзакции
   * @param transactionType - 'buy' (игрок продает) или 'sale' (игрок покупает)
   * @param amount - Количество ресурса
   * @param resource - Объект ресурса с ценами
   */
  calculateCost(
    transactionType: 'buy' | 'sale',
    amount: number,
    resource: Resource
  ): { identificator: string; count: number; cost: number | null; embargo: number } {
    const countryId = resource.country_id || resource.country?.id;

    if (!resource || !countryId) {
      return {
        identificator: resource?.identificator || '',
        count: amount,
        cost: null,
        embargo: 0
      };
    }

    const country = this.getCountryById(countryId);
    if (!country) {
      return {
        identificator: resource.identificator,
        count: amount,
        cost: null,
        embargo: 0
      };
    }

    // Определяем, какое поле с ценой использовать
    let unitCost: number | undefined;
    if (transactionType === 'buy') {
      // Игрок продает рынку - используем sell_price (из to_market)
      unitCost = resource.sell_price;
    } else {
      // Игрок покупает с рынка - используем buy_price (из off_market)
      unitCost = resource.buy_price;
    }

    if (unitCost !== undefined && unitCost !== null) {
      return {
        identificator: resource.identificator,
        count: amount,
        cost: unitCost * parseInt(String(amount), 10),
        embargo: country.params?.embargo || 0
      };
    }

    return {
      identificator: resource.identificator,
      count: amount,
      cost: null,
      embargo: country.params?.embargo || 0
    };
  }

  /**
   * Основная функция расчета караванов (аналог send_caravan на бэкенде)
   */
  calculateCaravan(
    countryId: number,
    resPlSells: Array<{ identificator: string; count?: number | null; name?: string }> = [],
    resPlBuys: Array<{ identificator: string; count?: number | null; name?: string }> = []
  ): CaravanResult {
    // Валидация
    if (!countryId) {
      throw new Error('country_id is required');
    }
    if (!Array.isArray(resPlSells)) {
      throw new Error('res_pl_sells must be an array');
    }
    if (!Array.isArray(resPlBuys)) {
      throw new Error('res_pl_buys must be an array');
    }

    // Извлекаем золото из ресурсов, которые игрок продает
    const goldItem = resPlSells.find(d => d.identificator === 'gold');
    let gold = goldItem?.count ? Number(goldItem.count) : 0;

    // Отдельно считаем стоимость покупки и выручку от продажи
    let purchaseCost = 0;  // Стоимость покупаемых товаров
    let saleIncome = 0;    // Выручка от продажи товаров

    // Обрабатываем ресурсы, которые игрок продает рынку
    const eligibleSellResources = this.countryFilter(countryId, resPlSells);

    eligibleSellResources.forEach(res => {
      if (res.identificator === 'gold') return; // Пропускаем золото
      if (!res.count || res.count <= 0) return; // Пропускаем пустые значения

      // Для продажи ищем в to_market (там есть sell_price)
      const resourceObj = this.resources.to_market.find(r =>
        r.identificator === res.identificator &&
        (r.country_id === countryId || r.country?.id === countryId)
      );
      if (!resourceObj) return; // Пропускаем несуществующие ресурсы

      const costResult = this.calculateCost('buy', Number(res.count), resourceObj);
      if (costResult.cost) {
        gold += costResult.cost;
        saleIncome += costResult.cost;  // Сохраняем выручку от продажи
      }
    });

    // Обрабатываем ресурсы, которые игрок покупает с рынка
    const resToPlayer: Array<{ name: string; identificator: string; count: number }> = [];
    const eligibleBuyResources = this.countryFilter(countryId, resPlBuys);

    eligibleBuyResources.forEach(res => {
      if (!res.count || res.count <= 0) return; // Пропускаем пустые значения

      // Для покупки ищем в off_market (там есть buy_price)
      const resourceObj = this.resources.off_market.find(r =>
        r.identificator === res.identificator &&
        (r.country_id === countryId || r.country?.id === countryId)
      );
      if (!resourceObj) return; // Пропускаем несуществующие ресурсы

      const costResult = this.calculateCost('sale', Number(res.count), resourceObj);
      if (!costResult.cost) return; // Пропускаем ресурсы, которые нельзя купить

      gold -= costResult.cost;
      purchaseCost += costResult.cost;  // Сохраняем стоимость покупки

      resToPlayer.push({
        name: resourceObj.name,
        identificator: resourceObj.identificator,
        count: parseInt(String(costResult.count), 10)
      });
    });

    // Добавляем итоговое золото к результату
    const allResources = [...this.resources.off_market, ...this.resources.to_market];
    const goldAsRes = allResources.find(r => r.identificator === 'gold');
    if (gold !== 0) {
      resToPlayer.push({
        name: goldAsRes?.name || 'Золото',
        identificator: 'gold',
        count: gold
      });
    }

    return {
      res_to_player: resToPlayer,
      total_purchase_cost: purchaseCost,
      total_sale_income: saleIncome
    };
  }
}

export default new CaravanService();
