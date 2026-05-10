import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';

export function RootNavigator() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
