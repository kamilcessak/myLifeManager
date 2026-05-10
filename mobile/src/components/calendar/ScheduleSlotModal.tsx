import type { Task } from '@mlm/shared';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@mlm/shared';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type ScheduleSlotModalProps = {
  visible: boolean;
  onClose: () => void;
  slotLabel: string;
  inboxTasks: Task[] | undefined;
  isLoadingInbox: boolean;
  onSelectTask: (task: Task) => void;
  isScheduling: boolean;
};

function isSchedulableInboxTask(task: Task): boolean {
  if (task.isCompleted) return false;
  if (task.scheduledStart != null) return false;
  if (task.isRecurringInstance) return false;
  return true;
}

export function ScheduleSlotModal({
  visible,
  onClose,
  slotLabel,
  inboxTasks,
  isLoadingInbox,
  onSelectTask,
  isScheduling,
}: ScheduleSlotModalProps) {
  const candidates = useMemo(
    () => (inboxTasks ?? []).filter(isSchedulableInboxTask),
    [inboxTasks],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Zaplanuj zadanie</Text>
          <Text style={styles.slotText}>{slotLabel}</Text>
          <Text style={styles.hint}>Wybierz niezaplanowane zadanie z inboxa</Text>

          {isLoadingInbox ? (
            <ActivityIndicator style={styles.loader} />
          ) : candidates.length === 0 ? (
            <Text style={styles.empty}>Brak niezaplanowanych zadań w tym workspace.</Text>
          ) : (
            <FlatList
              data={candidates}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const pColor = PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS[2];
                const pLabel = PRIORITY_LABELS[item.priority] ?? '';
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.taskRow,
                      pressed && styles.taskRowPressed,
                      { borderLeftColor: pColor },
                    ]}
                    onPress={() => onSelectTask(item)}
                    disabled={isScheduling}
                  >
                    <Text style={styles.taskTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={styles.taskMeta}>
                      <View style={[styles.dot, { backgroundColor: pColor }]} />
                      <Text style={styles.metaText}>{pLabel}</Text>
                      {item.category?.name ? (
                        <Text style={styles.metaMuted}> · {item.category.name}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          {isScheduling ? (
            <View style={styles.savingRow}>
              <ActivityIndicator />
              <Text style={styles.savingText}>Zapisywanie…</Text>
            </View>
          ) : null}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Anuluj</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '72%',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  slotText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  loader: {
    marginVertical: 24,
  },
  empty: {
    fontSize: 15,
    color: '#6B7280',
    marginVertical: 16,
  },
  taskRow: {
    borderLeftWidth: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskRowPressed: {
    opacity: 0.92,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  metaMuted: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  savingText: {
    fontSize: 14,
    color: '#374151',
  },
  cancelBtn: {
    marginTop: 16,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});
