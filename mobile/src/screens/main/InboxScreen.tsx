import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Task } from '@mlm/shared';
import { TaskListItem } from '../../components/tasks/TaskListItem';
import { useCompleteTaskMutation } from '../../hooks/useCompleteTaskMutation';
import { useInboxTasks } from '../../hooks/useInboxTasks';
import { getApiErrorMessage } from '../../lib/apiErrors';

/** Eksport typu dla zapytań inbox (taskQuerySchema / teamId). */
export type { TaskQuery } from '@mlm/shared';

export function InboxScreen() {
  const { data: tasks, isLoading, isError, error, refetch, isFetching } = useInboxTasks();
  const completeMutation = useCompleteTaskMutation();

  const onSwipeComplete = useCallback(
    (taskId: string) => {
      completeMutation.mutate(taskId);
    },
    [completeMutation],
  );

  const renderItem: ListRenderItem<Task> = useCallback(
    ({ item }) => <TaskListItem task={item} onSwipeComplete={onSwipeComplete} />,
    [onSwipeComplete],
  );

  const keyExtractor = useCallback((item: Task) => item.id, []);

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      );
    }
    if (isError) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Nie udało się wczytać skrzynki</Text>
          <Text style={styles.errorBody}>{getApiErrorMessage(error)}</Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Brak zadań w skrzynce</Text>
        <Text style={styles.emptyBody}>Nowe zadania pojawią się tutaj.</Text>
      </View>
    );
  }, [isLoading, isError, error]);

  return (
    <View style={styles.screen}>
      <FlatList
        data={tasks ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
});
