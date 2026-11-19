import { Platform } from 'react-native';
import { createColors, createType as makeType, motion, radius, space } from './tokens';

export { motion, radius, space };
export function createColorsSafe(scheme) {
  return createColors(scheme);
}
// iOS does not render fontWeight 800 reliably — map to 700 on iOS.
export function createType(colors) {
  const t = makeType(colors);
  if (Platform.OS !== 'ios') return t;
  const fixed = {};
  Object.keys(t).forEach((key) => {
    const style = t[key] || {};
    fixed[key] = {
      ...style,
      fontWeight: style.fontWeight === '800' ? '700' : style.fontWeight,
    };
  });
  return fixed;
}