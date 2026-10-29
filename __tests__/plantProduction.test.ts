/**
 * Тесты единого расчёта переработки (`src/services/plantProduction.ts`).
 *
 * Формулы взяты из сидов (`eraofchange/db/seeds/5_economics.rb`) — это данные игры, а не выдумка:
 *   - Лесопилка, ур. 1 (строка 200): timber 2 → boards 3, max_product boards 300;
 *   - Кузница, ур. 3: три формулы на общих ресурсах boards/metal — проверка последовательного расхода.
 * Ожидаемые числа — то, что выдаёт серверная `PlantLevel#feed_to_plant!` с открытой технологией
 * «Технические училища» (coof 1.5) и без неё.
 */
import {
  countRequest,
  feedToPlant,
  isTechSchoolsOpen,
  techSchoolsOpenForPlant,
  TECH_SCHOOLS_MULTIPLIER,
} from '../src/services/plantProduction';

const sawMillLevel1 = {
  from: [{ identificator: 'timber', count: 2 }],
  to: [{ identificator: 'boards', count: 3 }],
  max_product: [{ identificator: 'boards', count: 300 }],
};

// Кузница, ур. 3: формулы делят boards и metal между собой.
const smithyLevel3 = [
  {
    from: [
      { identificator: 'boards', count: 1 },
      { identificator: 'metal', count: 1 },
    ],
    to: [{ identificator: 'tools', count: 1 }],
    max_product: [{ identificator: 'tools', count: 150 }],
  },
  {
    from: [
      { identificator: 'boards', count: 1 },
      { identificator: 'metal', count: 2 },
    ],
    to: [{ identificator: 'weapon', count: 1 }],
    max_product: [{ identificator: 'weapon', count: 80 }],
  },
  {
    from: [{ identificator: 'metal', count: 4 }],
    to: [{ identificator: 'armor', count: 1 }],
    max_product: [{ identificator: 'armor', count: 20 }],
  },
];

describe('isTechSchoolsOpen', () => {
  it('читает признак из ответа уровня в обоих формах', () => {
    expect(isTechSchoolsOpen({ tech_schools_open: true })).toBe(true);
    expect(isTechSchoolsOpen({ tech_schools_open: 1 })).toBe(true);
  });

  it('считает технологию закрытой при 0, false и отсутствии поля', () => {
    expect(isTechSchoolsOpen({ tech_schools_open: false })).toBe(false);
    expect(isTechSchoolsOpen({ tech_schools_open: 0 })).toBe(false);
    expect(isTechSchoolsOpen({})).toBe(false);
    expect(isTechSchoolsOpen(undefined)).toBe(false);
    expect(isTechSchoolsOpen(null)).toBe(false);
  });
});

describe('feedToPlant: направление «из сырья» (way=from)', () => {
  it('без технологии отдаёт базовый выпуск', () => {
    const result = feedToPlant([sawMillLevel1], [{ identificator: 'timber', count: 100 }], 'from');

    expect(result.from).toEqual([{ identificator: 'timber', count: 100 }]);
    expect(result.to).toEqual([{ identificator: 'boards', count: 150 }]);
    expect(result.change).toEqual([]);
  });

  it('с открытыми Техническими училищами умножает выпуск на 1.5', () => {
    const result = feedToPlant([sawMillLevel1], [{ identificator: 'timber', count: 100 }], 'from', {
      techSchoolsOpen: true,
    });

    expect(result.from).toEqual([{ identificator: 'timber', count: 100 }]);
    expect(result.to).toEqual([{ identificator: 'boards', count: 150 * TECH_SCHOOLS_MULTIPLIER }]);
  });

  it('не превышает max_product уровня (потолок считается по базовому выпуску)', () => {
    const without = feedToPlant([sawMillLevel1], [{ identificator: 'timber', count: 1000 }], 'from');
    expect(without.from).toEqual([{ identificator: 'timber', count: 200 }]);
    expect(without.to).toEqual([{ identificator: 'boards', count: 300 }]);
    expect(without.change).toEqual([{ identificator: 'timber', count: 800 }]);

    const withTech = feedToPlant([sawMillLevel1], [{ identificator: 'timber', count: 1000 }], 'from', {
      techSchoolsOpen: true,
    });
    expect(withTech.from).toEqual([{ identificator: 'timber', count: 200 }]);
    expect(withTech.to).toEqual([{ identificator: 'boards', count: 450 }]);
  });

  it('возвращает только остаток запроса, если ресурса нет в формулах уровня', () => {
    const result = feedToPlant([sawMillLevel1], [{ identificator: 'grain', count: 40 }], 'from');

    expect(result.from).toEqual([]);
    expect(result.to).toEqual([]);
    expect(result.change).toEqual([{ identificator: 'grain', count: 40 }]);
  });
});

describe('feedToPlant: направление «на желаемый выпуск» (way=to)', () => {
  it('без технологии считает сырьё по базовой формуле', () => {
    const result = feedToPlant([sawMillLevel1], [{ identificator: 'boards', count: 150 }], 'to');

    expect(result.from).toEqual([{ identificator: 'timber', count: 100 }]);
    expect(result.change).toEqual([]);
  });

  it('с технологией делит потребность в сырье на 1.5 (округление вверх)', () => {
    const result = feedToPlant([sawMillLevel1], [{ identificator: 'boards', count: 150 }], 'to', {
      techSchoolsOpen: true,
    });

    // 150 / 1.5 = 100 базовых досок → 33 прогона формулы → 66 timber и 99 базовых досок (×1.5 = 148.5).
    expect(result.from).toEqual([{ identificator: 'timber', count: 66 }]);
    expect(result.to).toEqual([{ identificator: 'boards', count: 148.5 }]);
    expect(result.change).toEqual([{ identificator: 'boards', count: 1 }]);
  });
});

describe('feedToPlant: несколько формул на одном уровне', () => {
  it('расходует сырьё последовательно: вторая формула видит остаток', () => {
    // 5 boards + 5 metal целиком уходят в первую формулу (tools),
    // поэтому оружие и броня не производятся — как на сервере.
    const result = feedToPlant(smithyLevel3, [
      { identificator: 'boards', count: 5 },
      { identificator: 'metal', count: 5 },
    ], 'from');

    expect(result.from).toEqual([
      { identificator: 'boards', count: 5 },
      { identificator: 'metal', count: 5 },
    ]);
    expect(result.to).toEqual([{ identificator: 'tools', count: 5 }]);
    expect(result.change).toEqual([]);
  });

  it('суммарный расход сырья не превышает ввод', () => {
    // 12 boards + 9 metal: первая формула забирает 9 boards и 9 metal (9 tools),
    // на оружие (нужно 2 metal на штуку) металла уже не остаётся, остаток — 3 boards.
    const result = feedToPlant(smithyLevel3, [
      { identificator: 'boards', count: 12 },
      { identificator: 'metal', count: 9 },
    ], 'from');

    expect(result.from).toEqual([
      { identificator: 'boards', count: 9 },
      { identificator: 'metal', count: 9 },
    ]);
    expect(result.to).toEqual([{ identificator: 'tools', count: 9 }]);
    expect(result.change).toEqual([{ identificator: 'boards', count: 3 }]);
  });
});

describe('countRequest', () => {
  it('считает число прогонов формулы в пределах запроса и max_product', () => {
    const { from, to } = countRequest(sawMillLevel1, [{ identificator: 'timber', count: 10 }], 'from');

    expect(from).toEqual([{ identificator: 'timber', count: 10 }]);
    expect(to).toEqual([{ identificator: 'boards', count: 15 }]);
  });
});


describe('techSchoolsOpenForPlant («Технические училища» по землям предприятия)', () => {
  it('признак предприятия приоритетнее глобального справочника уровней', () => {
    // Предприятие на новгородских землях, технология открыта в Москве (глобальный
    // справочник уровней говорит true) — бонуса у этого предприятия быть не должно.
    const plant = { tech_schools_open: false, plant_level: { tech_schools_open: false } };

    expect(techSchoolsOpenForPlant(plant, { tech_schools_open: true })).toBe(false);
  });

  it('открыта на землях предприятия — бонус есть', () => {
    expect(techSchoolsOpenForPlant({ plant_level: { tech_schools_open: true } })).toBe(true);
    expect(techSchoolsOpenForPlant({ tech_schools_open: 1 })).toBe(true);
  });

  it('без признака предприятия падает на запасной уровень, а без него — false', () => {
    expect(techSchoolsOpenForPlant({}, { tech_schools_open: true })).toBe(true);
    expect(techSchoolsOpenForPlant({})).toBe(false);
    expect(techSchoolsOpenForPlant(null, { tech_schools_open: true })).toBe(true);
  });
});
