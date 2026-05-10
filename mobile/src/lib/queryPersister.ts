import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const QUERY_CACHE_KEY = 'mlm-tanstack-query-cache';

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 2000,
});

export async function purgePersistedQueryCache(): Promise<void> {
  await Promise.resolve(asyncStoragePersister.removeClient());
}
