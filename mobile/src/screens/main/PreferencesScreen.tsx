import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemePreference } from '../../store/themePreferencesStore';
import { useThemePreferencesStore } from '../../store/themePreferencesStore';
import { useAppTheme } from '../../theme/AppThemeProvider';

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'light', label: 'Jasny', hint: 'Zawsze jasny motyw' },
  { value: 'dark', label: 'Ciemny', hint: 'Zawsze ciemny motyw' },
  { value: 'system', label: 'Systemowy', hint: 'Dopasuj do ustawień telefonu' },
];

export function PreferencesScreen() {
  const { colors } = useAppTheme();
  const themePreference = useThemePreferencesStore((s) => s.themePreference);
  const setThemePreference = useThemePreferencesStore((s) => s.setThemePreference);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, padding: 20, backgroundColor: colors.background },
        title: { fontSize: 15, fontWeight: '700', color: colors.textMuted, marginBottom: 12 },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        row: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowLast: { borderBottomWidth: 0 },
        rowActive: { backgroundColor: colors.surfaceMuted },
        label: { fontSize: 16, fontWeight: '600', color: colors.text },
        hint: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
      }),
    [colors],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Motyw aplikacji</Text>
      <View style={styles.card}>
        {OPTIONS.map((opt, index) => {
          const active = themePreference === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setThemePreference(opt.value)}
              style={[styles.row, index === OPTIONS.length - 1 && styles.rowLast, active && styles.rowActive]}
            >
              <Text style={styles.label}>{opt.label}</Text>
              <Text style={styles.hint}>{opt.hint}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
