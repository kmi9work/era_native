/**
 * Щиты армий на карте: какой PNG рисовать для армии и какого она «вида».
 *
 * Иконки вырезаны из PSD заказчика скриптом `scripts/extract-shields.py`
 * (assets/map/shields): 16 родовых щитов знати, два государственных (Москва,
 * Новгород) и два служебных — «враг» (сплошной оранжевый) и «бунт» (сплошной
 * чёрный). Правило заказчика:
 *
 *   - знать и государства Москва/Новгород — свой родовой/государственный щит;
 *   - чужие государства (враги) — полностью оранжевый щит;
 *   - «Дух народного бунта» — полностью чёрный щит.
 *
 * Отдельного признака «враг» в данных нет: армия иностранного государства —
 * это любая армия, чей владелец не входит в московские/новгородские роды.
 */
import type { ImageSourcePropType } from 'react-native';
import type { Army } from '../../types';

export type ShieldKind = 'family' | 'state' | 'enemy' | 'rebel';

export interface ArmyShieldInfo {
  source: ImageSourcePropType;
  kind: ShieldKind;
  /** Подпись для легенды и панели армии. */
  label: string;
}

const ICONS: Record<string, ImageSourcePropType> = {
  aksakovy: require('../../../assets/map/shields/aksakovy.png'),
  bolshiy: require('../../../assets/map/shields/bolshiy.png'),
  boretsky: require('../../../assets/map/shields/boretsky.png'),
  esipov: require('../../../assets/map/shields/esipov.png'),
  golitsyny: require('../../../assets/map/shields/golitsyny.png'),
  kolychevi: require('../../../assets/map/shields/kolychevi.png'),
  mishinich: require('../../../assets/map/shields/mishinich.png'),
  molodye: require('../../../assets/map/shields/molodye.png'),
  moscow: require('../../../assets/map/shields/moscow.png'),
  novgorod: require('../../../assets/map/shields/novgorod.png'),
  ontsiforovich: require('../../../assets/map/shields/ontsiforovich.png'),
  ovinov: require('../../../assets/map/shields/ovinov.png'),
  patrikeevy: require('../../../assets/map/shields/patrikeevy.png'),
  prokshinich: require('../../../assets/map/shields/prokshinich.png'),
  rogovichi: require('../../../assets/map/shields/rogovichi.png'),
  ryurikovichi: require('../../../assets/map/shields/ryurikovichi.png'),
  svoezemtsev: require('../../../assets/map/shields/svoezemtsev.png'),
  volotskie: require('../../../assets/map/shields/volotskie.png'),
  enemy: require('../../../assets/map/shields/enemy.png'),
  rebel: require('../../../assets/map/shields/rebel.png'),
};

/**
 * Родовой щит. Ключи — и фамилия («Аксаковы»), и имя знатного игрока
 * («Аксаков»): в сидах ядра поле `family` раздаётся случайно, а имя боярина
 * исторически совпадает с родом, поэтому щит берём по тому, что найдётся.
 */
const FAMILY_ICONS: Array<{ icon: string; keys: string[] }> = [
  { icon: 'ryurikovichi', keys: ['рюриковичи', 'рюрикович'] },
  { icon: 'aksakovy', keys: ['аксаковы', 'аксаков'] },
  { icon: 'patrikeevy', keys: ['патрикеевы', 'патрикеев'] },
  { icon: 'volotskie', keys: ['волоцкие', 'волоцкий'] },
  { icon: 'bolshiy', keys: ['большие', 'большой'] },
  { icon: 'molodye', keys: ['молодые', 'молодой'] },
  { icon: 'golitsyny', keys: ['голицыны', 'голицын'] },
  { icon: 'boretsky', keys: ['борецкие', 'борецкий'] },
  { icon: 'mishinich', keys: ['мишиничи', 'мишинич'] },
  { icon: 'ontsiforovich', keys: ['онцифоровичи', 'онцифорович'] },
  { icon: 'prokshinich', keys: ['прокшиничи', 'прокшинич'] },
  { icon: 'svoezemtsev', keys: ['своеземцевы', 'своеземцев'] },
  { icon: 'esipov', keys: ['есиповы', 'есипов'] },
  { icon: 'ovinov', keys: ['овиновы', 'овинов'] },
  { icon: 'kolychevi', keys: ['колычевы', 'колычев', 'колечевы', 'колечев'] },
  { icon: 'rogovichi', keys: ['роговичи', 'рогович'] },
];

const FAMILY_BY_KEY = new Map<string, string>();
FAMILY_ICONS.forEach(({ icon, keys }) => keys.forEach(key => FAMILY_BY_KEY.set(key, icon)));

/** Нормализация названия: регистр, «ё», лишние пробелы. */
const normalize = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

/** «Дух народного бунта» — и по типу игрока, и по имени (в сидах это знатный). */
export const isRebelArmy = (army: Army): boolean => {
  const owner = army.owner;
  if (!owner) return false;
  const values = [owner.name, owner.player_type?.name].map(normalize);
  return values.some(value => value.includes('бунт'));
};

/** Государственный щит Москвы/Новгорода по названию государства. */
const stateIcon = (army: Army): string | null => {
  const names = [
    army.country?.name,
    army.country?.short_name,
    army.owner?.country?.name,
  ].map(normalize);
  if (names.some(name => name.includes('новгород'))) return 'novgorod';
  if (names.some(name => name.includes('москов') || name === 'москва')) return 'moscow';
  return null;
};

const familyIcon = (army: Army): string | null => {
  const candidates = [army.owner?.family?.name, army.owner?.name].map(normalize);
  for (const candidate of candidates) {
    const icon = FAMILY_BY_KEY.get(candidate);
    if (icon) return icon;
  }
  return null;
};

/** Щит армии: родовой → государственный → оранжевый «враг»; бунт — чёрный. */
export const shieldForArmy = (army: Army): ArmyShieldInfo => {
  if (isRebelArmy(army)) return { source: ICONS.rebel, kind: 'rebel', label: 'бунт' };

  const family = familyIcon(army);
  if (family) return { source: ICONS[family], kind: 'family', label: 'родовой щит' };

  const state = stateIcon(army);
  if (state) return { source: ICONS[state], kind: 'state', label: 'щит государства' };

  return { source: ICONS.enemy, kind: 'enemy', label: 'враг' };
};

/** Легенда карты (щиты). */
export const SHIELD_LEGEND: Array<{ key: string; label: string }> = [
  { key: 'family', label: 'родовой щит' },
  { key: 'enemy', label: 'враг' },
  { key: 'rebel', label: 'бунт' },
];
