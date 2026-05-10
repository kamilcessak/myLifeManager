import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { PRIORITY_COLORS, PRIORITY_LABELS, type Task } from '@mlm/shared';

const SWIPE_TRIGGER = 56;
const MAX_DRAG = 88;

export type TaskListItemProps = {
  task: Task;
  onSwipeComplete: (taskId: string) => void;
  onPress?: (task: Task) => void;
};

function TaskListItemInner({ task, onSwipeComplete, onPress }: TaskListItemProps) {
  const translateX = useSharedValue(0);

  const commitComplete = useCallback(() => {
    onSwipeComplete(task.id);
  }, [onSwipeComplete, task.id]);

  const pan = Gesture.Pan()
    .enabled(!task.isCompleted)
    .activeOffsetX(20)
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      'worklet';
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX, MAX_DRAG);
      } else {
        translateX.value = 0;
      }
    })
    .onEnd(() => {
      'worklet';
      if (translateX.value >= SWIPE_TRIGGER) {
        runOnJS(commitComplete)();
      }
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const priorityColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[2];
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? '';

  return (
    <View style={styles.wrap}>
      <View style={styles.completeWell}>
        <Text style={styles.completeWellText}>✓ Ukończ</Text>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.row,
            rowStyle,
            task.isCompleted && styles.rowCompleted,
            { borderLeftColor: priorityColor },
          ]}
        >
          <Pressable
            style={styles.rowMain}
            onPress={onPress ? () => onPress(task) : undefined}
            disabled={!onPress}
          >
            <Text
              style={[styles.title, task.isCompleted && styles.titleCompleted]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
              <Text style={styles.priorityText}>{priorityLabel}</Text>
              {task.category?.name ? (
                <Text style={styles.categoryText}> · {task.category.name}</Text>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export const TaskListItem = memo(TaskListItemInner);

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    position: 'relative',
  },
  completeWell: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingLeft: 20,
    backgroundColor: '#22c55e',
    borderRadius: 12,
  },
  completeWellText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  rowCompleted: {
    opacity: 0.55,
  },
  rowMain: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  priorityText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  categoryText: {
    fontSize: 13,
    color: '#6b7280',
  },
});
