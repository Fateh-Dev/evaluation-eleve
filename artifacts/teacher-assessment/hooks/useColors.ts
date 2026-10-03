import { useColorScheme } from 'react-native';
import { themePalettes } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';

/** Returns the selected palette, respecting the device light/dark appearance. */
export function useColors() {
  const scheme = useColorScheme();
  const { theme } = useTheme();
  const selectedPalette = themePalettes[theme];
  const palette = scheme === 'dark' ? selectedPalette.dark : selectedPalette.light;
  return { ...palette, radius: 14 };
}
