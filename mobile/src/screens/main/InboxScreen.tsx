import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useMemo } from 'react';
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
import { AssigneeFilterToggle } from '../../components/AssigneeFilterToggle';
import { CreateTaskFab } from '../../components/tasks/CreateTaskFab';
import { TaskListItem } from '../../components/tasks/TaskListItem';
import { useCompleteTaskMutation } from '../../hooks/useCompleteTaskMutation';
import { useInboxTasks } from '../../hooks/useInboxTasks';
import { getApiErrorMessage } from '../../lib/apiErrors';
import type { AppStackParamList } from '../../navigation/types';
import { useAssigneeFilterStore } from '../../store/assigneeFilterStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppTheme } from '../../theme/AppThemeProvider';

/** Eksport typu dla zapytań inbox (taskQuerySchema / teamId). */
export type { TaskQuery } from '@mlm/shared';

export function InboxScreen() {
  const { colors } = useAppTheme();
  const tabNavigation = useNavigation();
  const stackNavigation =
    tabNavigation.getParent<NativeStackNavigationProp<AppStackParamList>>();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);

  const { data: tasks, isLoading, isError, error, refetch, isFetching } = useInboxTasks();
  const completeMutation = useCompleteTaskMutation();

  useLayoutEffect(() => {
    tabNavigation.setOptions({
      headerLeft:
        activeWorkspaceId !== null
          ? () => (
              <View style={styles.headerLeft}>
                <AssigneeFilterToggle />
              </View>
            )
          : undefined,
    });
  }, [tabNavigation, activeWorkspaceId, onlyMine]);

  const onOpenTask = useCallback(
    (task: Task) => {
      stackNavigation?.navigate('TaskDetail', { task });
    },
    [stackNavigation],
  );

  const onSwipeComplete = useCallback(
    (taskId: string) => {
      completeMutation.mutate(taskId);
    },
    [completeMutation],
  );

  const renderItem: ListRenderItem<Task> = useCallback(
    ({ item }) => (
      <TaskListItem
        task={item}
        onSwipeComplete={onSwipeComplete}
        onPress={onOpenTask}
      />
    ),
    [onOpenTask, onSwipeComplete],
  );

  const keyExtractor = useCallback((item: Task) => item.id, []);

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (isError) {
      return (
        <View style={styles.centered}>
          <Text style={[styles.errorTitle, { color: colors.danger }]}>Nie udało się wczytać skrzynki</Text>
          <Text style={[styles.errorBody, { color: colors.textMuted }]}>{getApiErrorMessage(error)}</Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Brak zadań w skrzynce</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Nowe zadania pojawią się tutaj.</Text>
      </View>
    );
  }, [isLoading, isError, error, colors.danger, colors.text, colors.textMuted, colors.primary]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={tasks ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={[styles.listContent, styles.listContentWithFab]}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />
        }
      />
      <CreateTaskFab />
    </View>
  );
}

const styles = StyleSheet.create({
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screen: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 24,
  },
  listContentWithFab: {
    paddingBottom: 100,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 15,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 15,
    textAlign: 'center',
  },
});
