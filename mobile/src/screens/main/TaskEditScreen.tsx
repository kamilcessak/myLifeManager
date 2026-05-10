import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PRIORITY_COLORS, PRIORITY_LABELS, type TaskPriority } from '@mlm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AttachmentPanel } from '../../components/attachments/AttachmentPanel';
import { useTaskDetailQuery } from '../../hooks/useTaskDetailQuery';
import { useUpdateTaskMutation } from '../../hooks/useUpdateTaskMutation';
import { taskDetailQueryKey } from '../../lib/queryKeys';
import type { AppStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../theme/AppThemeProvider';

type Props = NativeStackScreenProps<AppStackParamList, 'TaskEdit'>;

export function TaskEditScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const { data: task, isLoading, isError, error } = useTaskDetailQuery(taskId);
  const updateMutation = useUpdateTaskMutation(taskId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(2);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setPriority(task.priority as TaskPriority);
  }, [task]);

  const attachments = task?.attachments ?? [];

  const setAttachments = (next: typeof attachments) => {
    if (!task) return;
    queryClient.setQueryData(taskDetailQueryKey(taskId), { ...task, attachments: next });
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        scroll: { padding: 16, paddingBottom: 40 },
        label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.surface,
          marginBottom: 16,
        },
        multiline: { minHeight: 100, textAlignVertical: 'top' },
        priRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
        priChip: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        priChipActive: { borderWidth: 2 },
        priText: { fontWeight: '600', color: colors.text, fontSize: 13 },
        saveBtn: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          marginTop: 8,
        },
        saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
        err: { color: colors.danger, textAlign: 'center' },
      }),
    [colors],
  );

  const onSave = () => {
    const t = title.trim();
    if (!t) {
      Alert.alert('Tytuł', 'Podaj tytuł zadania.');
      return;
    }
    updateMutation.mutate(
      { title: t, description: description.trim() || null, priority },
      {
        onSuccess: () => {
          navigation.goBack();
        },
        onError: (e) => {
          Alert.alert('Zapis', e instanceof Error ? e.message : 'Nie udało się zapisać.');
        },
      },
    );
  };

  if (isLoading || !task) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          {isError ? (
            <Text style={styles.err}>{error?.message ?? 'Błąd'}</Text>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Tytuł</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Tytuł zadania"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Opis</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Opcjonalny opis"
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <Text style={styles.label}>Priorytet</Text>
        <View style={styles.priRow}>
          {([1, 2, 3, 4] as const).map((p) => {
            const active = priority === p;
            const stripe = PRIORITY_COLORS[p] ?? PRIORITY_COLORS[2];
            return (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                style={[
                  styles.priChip,
                  active && styles.priChipActive,
                  active && { borderColor: stripe },
                ]}
              >
                <Text style={styles.priText}>{PRIORITY_LABELS[p] ?? p}</Text>
              </Pressable>
            );
          })}
        </View>

        <AttachmentPanel
          variant="task"
          parentId={taskId}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
        />

        <Pressable
          style={[styles.saveBtn, updateMutation.isPending && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Zapisz zmiany</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
