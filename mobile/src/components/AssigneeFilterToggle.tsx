import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAssigneeFilterStore } from '../store/assigneeFilterStore';

export function AssigneeFilterToggle() {
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const setOnlyMine = useAssigneeFilterStore((s) => s.setOnlyMine);

  const toggle = useCallback(() => {
    setOnlyMine(!onlyMine);
  }, [onlyMine, setOnlyMine]);

  return (
    <Pressable
      onPress={toggle}
      style={[styles.wrap, onlyMine && styles.wrapOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: onlyMine }}
      accessibilityLabel="Tylko moje przypisania"
    >
      <Text style={[styles.label, onlyMine && styles.labelOn]} numberOfLines={1}>
        Tylko moje
      </Text>
      <View style={[styles.track, onlyMine && styles.trackOn]}>
        <View style={[styles.knob, onlyMine && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginLeft: 8,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    maxWidth: 200,
  },
  wrapOn: {
    backgroundColor: '#dbeafe',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    flexShrink: 1,
  },
  labelOn: {
    color: '#1e40af',
  },
  track: {
    width: 36,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#d1d5db',
    padding: 2,
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: '#2563eb',
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
});
