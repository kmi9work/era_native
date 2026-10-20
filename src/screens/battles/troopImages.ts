/**
 * Символы отрядов из ~/learn/era/detachments.png (порядок в файле: конница,
 * пехота, тяжёлая пехота, пушка). Файл разрезан на четыре PNG скриптом
 * (см. assets/detachments), чтобы карточка показывала нужный символ без
 * сторонних библиотек вроде react-native-svg.
 */
import type { ImageSourcePropType } from 'react-native';
import type { TroopKind } from '../../services/battleRules';

export const TROOP_IMAGE: Record<TroopKind, ImageSourcePropType> = {
  cavalry: require('../../../assets/detachments/cavalry.png'),
  infantry: require('../../../assets/detachments/infantry.png'),
  heavy_infantry: require('../../../assets/detachments/heavy_infantry.png'),
  cannon: require('../../../assets/detachments/cannon.png'),
};
