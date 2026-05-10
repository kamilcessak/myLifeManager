import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect, useMemo } from 'react';
import { OfflineBanner } from '../components/OfflineBanner';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuthStore } from '../store/authStore';
import { useAppTheme } from '../theme/AppThemeProvider';
import { AppStack } from './AppStack';
import { AuthStack } from './AuthStack';

export function RootNavigator() {
  const { colors, isDark } = useAppTheme();

  const navigationTheme = useMemo(
    () => {
      const base = isDark ? NavigationDarkTheme : NavigationDefaultTheme;
      const bg = isDark ? '#121212' : '#ffffff';
      return {
        ...base,
        dark: isDark,
        colors: {
          ...base.colors,
          background: bg,
          card: bg,
          primary: colors.primary,
          text: colors.text,
          border: colors.border,
          notification: colors.danger,
        },
      };
    },
    [colors.border, colors.danger, colors.primary, colors.text, isDark],
  );
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  usePushNotifications(isAuthenticated && !isLoading);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.shell, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <NavigationContainer theme={navigationTheme}>
        {isAuthenticated ? <AppStack /> : <AuthStack />}
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
