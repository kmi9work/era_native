/* eslint-env jest */
/**
 * Мок Reanimated для Jest.
 *
 * Настоящий модуль тянет нативный TurboModule, которого в Node нет, а
 * `react-native-reanimated/mock` импортирует внутренности библиотеки. Здесь
 * достаточно статического поведения: анимации считаются мгновенными, стиль —
 * обычный объект. Тесты проверяют шаги сцены и раскладку (чистые функции) и
 * тексты экрана, а не промежуточные кадры анимации.
 */
const React = require('react');
const RN = require('react-native');

const identity = value => value;
const easingFn = t => t;
const Easing = {
  linear: easingFn,
  ease: easingFn,
  quad: easingFn,
  cubic: easingFn,
  sin: easingFn,
  circle: easingFn,
  in: fn => fn,
  out: fn => fn,
  inOut: fn => fn,
  bezier: () => easingFn,
};

const animation = toValue => ({ toValue });
const withTiming = toValue => animation(toValue);
const withSpring = toValue => animation(toValue);
const withDecay = () => animation(0);
const withDelay = (_delay, next) => next;
const withSequence = (...animations) => animations[animations.length - 1];
const withRepeat = next => next;

const shared = init => ({ value: init });

const useSharedValue = init => React.useRef(shared(init)).current;
const useAnimatedStyle = factory => (typeof factory === 'function' ? factory() : {});
const useAnimatedProps = factory => (typeof factory === 'function' ? factory() : {});
const useAnimatedRef = () => React.createRef();
const useAnimatedScrollHandler = () => () => {};
const useDerivedValue = factory => shared(typeof factory === 'function' ? factory() : undefined);
const useFrameCallback = () => ({ setActive: () => {}, isActive: false });
const useEvent = () => () => {};
const useHandler = () => ({ context: {}, doDependenciesDiffer: false });

const animatedComponent = Component => Component;

const Animated = {
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  createAnimatedComponent: animatedComponent,
  Value: RN.Animated.Value,
  timing: RN.Animated.timing,
  sequence: RN.Animated.sequence,
  parallel: RN.Animated.parallel,
  loop: RN.Animated.loop,
};

module.exports = {
  __esModule: true,
  default: Animated,
  Easing,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  cancelAnimation: () => {},
  createAnimatedComponent: animatedComponent,
  interpolate: (value, input, output) => (Array.isArray(output) ? output[0] : value),
  interpolateColor: (value, input, output) => (Array.isArray(output) ? output[0] : value),
  measure: () => null,
  runOnJS: fn => fn,
  runOnUI: fn => fn,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useEvent,
  useFrameCallback,
  useHandler,
  useSharedValue,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
};
