import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '../theme/AppThemeProvider';

export function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
