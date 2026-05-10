import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiClient } from '../../lib/apiClient';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { wipeLocalSessionAfterAccountDeletion } from '../../lib/fullLocalReset';
import { useAppTheme } from '../../theme/AppThemeProvider';

export function AccountScreen() {
  const { colors } = useAppTheme();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: colors.background, gap: 16 },
    title: { fontSize: 17, fontWeight: '700', color: colors.text },
    body: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
    btn: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    btnText: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
    dangerBtn: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
    },
    dangerText: { fontSize: 16, fontWeight: '700', color: colors.danger, textAlign: 'center' },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 20,
      gap: 12,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    modalBody: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
    secondary: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.surfaceMuted,
    },
    secondaryText: { fontWeight: '600', color: colors.text },
    primaryDanger: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.danger,
      minWidth: 100,
      alignItems: 'center',
    },
    primaryDangerText: { fontWeight: '700', color: '#fff' },
  });

  const onExport = async () => {
    setExporting(true);
    try {
      const { data } = await apiClient.get<string>('/auth/export', { responseType: 'text' });
      const raw = data;
      const filename = `mlm-export-${Date.now()}.json`;
      const base = cacheDirectory ?? documentDirectory;
      if (!base) {
        Alert.alert('Eksport', 'Brak katalogu cache — nie można zapisać pliku.');
        return;
      }
      const path = `${base}${filename}`;
      await writeAsStringAsync(path, raw);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Eksport danych' });
      } else {
        Alert.alert('Zapisano', `Plik: ${path}`);
      }
    } catch (e) {
      Alert.alert('Eksport', getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (deletePhrase.trim().toLowerCase() !== 'usuń') {
      Alert.alert('Potwierdzenie', 'Wpisz dokładnie: USUŃ');
      return;
    }
    setDeleting(true);
    try {
      await apiClient.delete('/auth/me');
      await wipeLocalSessionAfterAccountDeletion();
      setDeleteOpen(false);
      setDeletePhrase('');
    } catch (e) {
      Alert.alert('Usuwanie konta', getApiErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dane osobowe (RODO)</Text>
      <Text style={styles.body}>
        Możesz pobrać kopię swoich danych przechowywanych w serwisie w formacie JSON albo trwale usunąć konto.
      </Text>

      <Pressable style={styles.btn} onPress={() => void onExport()} disabled={exporting}>
        {exporting ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.btnText}>Pobierz moje dane</Text>
        )}
      </Pressable>

      <Pressable style={styles.dangerBtn} onPress={() => setDeleteOpen(true)}>
        <Text style={styles.dangerText}>Usuń konto na stałe</Text>
      </Pressable>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => !deleting && setDeleteOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Usunąć konto?</Text>
            <Text style={styles.modalBody}>
              Ta operacja jest nieodwracalna. Aby potwierdzić, wpisz USUŃ (wielkość liter bez znaczenia).
            </Text>
            <TextInput
              style={styles.input}
              value={deletePhrase}
              onChangeText={setDeletePhrase}
              placeholder="USUŃ"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              editable={!deleting}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondary} onPress={() => setDeleteOpen(false)} disabled={deleting}>
                <Text style={styles.secondaryText}>Anuluj</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryDanger, deleting && { opacity: 0.7 }]}
                onPress={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryDangerText}>Usuń</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
