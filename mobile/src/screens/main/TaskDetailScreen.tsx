import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@mlm/shared';
import { TaskActivityTimeline } from '../../components/tasks/TaskActivityTimeline';
import { useTaskActivity } from '../../hooks/useTaskActivity';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { getTaskStableId } from '../../lib/calendarEntityIds';
import type { AppStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../theme/AppThemeProvider';

type Props = NativeStackScreenProps<AppStackParamList, 'TaskDetail'>;

export function TaskDetailScreen({ route, navigation }: Props) {
  const { colors } = useAppTheme();
  const { task } = route.params;
  const activityTaskId = task.originalTaskId ?? task.id;
  const teamId = task.teamId ?? null;

  const activityQuery = useTaskActivity(activityTaskId);
  const { data: members = [] } = useTeamMembers(teamId);

  const priorityColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[2];
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? '';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('TaskEdit', { taskId: getTaskStableId(task) })}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Edytuj</Text>
        </Pressable>
      ),
    });
  }, [navigation, task, colors.primary]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: colors.background,
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
          color: colors.text,
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
          color: colors.textMuted,
          fontWeight: '600',
        },
        metaMuted: {
          fontSize: 14,
          color: colors.textMuted,
        },
        description: {
          fontSize: 15,
          color: colors.text,
          lineHeight: 22,
          marginBottom: 20,
        },
        noDescription: {
          fontSize: 14,
          color: colors.textMuted,
          fontStyle: 'italic',
          marginBottom: 20,
        },
      }),
    [colors],
  );

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
