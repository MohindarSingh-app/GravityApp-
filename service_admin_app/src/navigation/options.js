import { DefaultTheme } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';

export function useStackScreenOptions() {
  const { colors, reduceMotion } = useTheme();
  return {
    headerShown: false,
    animation: reduceMotion ? 'none' : 'slide_from_right',
    animationDuration: reduceMotion ? 0 : 250,
    contentStyle: { backgroundColor: colors.background },
  };
}

export function useNavigationTheme() {
  const { colors } = useTheme();
  const base = DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };
}
