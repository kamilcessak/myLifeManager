import { StyleSheet, Text, View } from 'react-native';

/** Eksport typu na Phase 2 (GET /api/tasks/inbox + taskQuerySchema). */
export type { TaskQuery } from '@mlm/shared';

export function InboxScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inbox</Text>
      <Text style={styles.body}>
        {/* TODO(Phase 2): lista zadań z /api/tasks/inbox + parametry z taskQuerySchema */}
        Tutaj pojawi się skrzynka zadań (time-blocking).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: '#444',
    lineHeight: 22,
  },
});
