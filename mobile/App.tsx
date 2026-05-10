import NetInfo from '@react-native-community/netinfo';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { onlineManager } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemedStatusBar } from './src/components/ThemedStatusBar';
import { queryClient } from './src/lib/queryClient';
import { asyncStoragePersister } from './src/lib/queryPersister';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppThemeProvider } from './src/theme/AppThemeProvider';

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected == null && state.isInternetReachable == null) {
      setOnline(true);
      return;
    }
    setOnline(state.isConnected === true);
  });
});

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: asyncStoragePersister,
              maxAge: 1000 * 60 * 60 * 24 * 7,
            }}
          >
            <RootNavigator />
            <ThemedStatusBar />
          </PersistQueryClientProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
