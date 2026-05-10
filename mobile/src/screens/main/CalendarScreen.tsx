import { StyleSheet, Text, View } from 'react-native';

/** Eksport typu na Phase 2 (GET /api/events + dateRangeQuerySchema). */
export type { DateRangeQuery } from '@mlm/shared';

export function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kalendarz</Text>
      <Text style={styles.body}>
        {/* TODO(Phase 2): widok kalendarza + GET /api/events z dateRangeQuerySchema */}
        Tutaj pojawi się widok kalendarza i zaplanowane bloki czasu.
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
