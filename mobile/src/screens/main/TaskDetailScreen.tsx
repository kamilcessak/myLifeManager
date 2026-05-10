import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@mlm/shared';
import { TaskActivityTimeline } from '../../components/tasks/TaskActivityTimeline';
import { useTaskActivity } from '../../hooks/useTaskActivity';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'TaskDetail'>;

export function TaskDetailScreen({ route }: Props) {
  const { task } = route.params;
  const activityTaskId = task.originalTaskId ?? task.id;
  const teamId = task.teamId ?? null;

  const activityQuery = useTaskActivity(activityTaskId);
  const { data: members = [] } = useTeamMembers(teamId);

  const priorityColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[2];
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.priorityStripe, { backgroundColor: priorityColor }]} />
        <Text style={styles.title}>{task.title}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={styles.metaText}>{priorityLabel}</Text>
          {task.category?.name ? (
            <Text style={styles.metaMuted}> · {task.category.name}</Text>
          ) : null}
        </View>
        {task.description?.trim() ? (
          <Text style={styles.description}>{task.description}</Text>
        ) : (
          <Text style={styles.noDescription}>Brak opisu</Text>
        )}

        <TaskActivityTimeline
          entries={activityQuery.data}
          members={members}
          isLoading={activityQuery.isLoading}
          isError={activityQuery.isError}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  priorityStripe: {
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    width: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  metaMuted: {
    fontSize: 14,
    color: '#6b7280',
  },
  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 20,
  },
  noDescription: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 20,
  },
});
