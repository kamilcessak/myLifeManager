import type { Attachment } from '@mlm/shared';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { deleteAttachment, uploadAttachment, type PickedUploadFile } from '../../lib/attachmentsApi';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { resolveMediaUrl } from '../../config/apiBaseUrl';
import { useAppTheme } from '../../theme/AppThemeProvider';

const MAX_BYTES = 5 * 1024 * 1024;
const THUMB_SIZE = 56;

export type AttachmentPanelProps = {
  variant: 'task' | 'event';
  parentId: string;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  readOnly?: boolean;
};

export function AttachmentPanel({
  variant,
  parentId,
  attachments,
  onAttachmentsChange,
  readOnly = false,
}: AttachmentPanelProps) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const runUpload = useCallback(
    async (file: PickedUploadFile) => {
      setBusy(true);
      try {
        const attachment = await uploadAttachment(file, {
          taskId: variant === 'task' ? parentId : undefined,
          eventId: variant === 'event' ? parentId : undefined,
        });
        onAttachmentsChange([attachment, ...attachments]);
      } catch (e) {
        Alert.alert('Wysyłka nie powiodła się', getApiErrorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [attachments, onAttachmentsChange, parentId, variant],
  );

  const onPickGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Brak dostępu', 'Zezwól na dostęp do galerii w ustawieniach systemu.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.fileSize != null && a.fileSize > MAX_BYTES) {
      Alert.alert('Plik za duży', 'Maksymalny rozmiar załącznika to 5 MB.');
      return;
    }
    const uri = a.uri;
    const name = a.fileName ?? `photo-${Date.now()}.jpg`;
    const type = a.mimeType ?? 'image/jpeg';
    await runUpload({ uri, name, type });
  }, [runUpload]);

  const onPickCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Brak dostępu', 'Zezwól na dostęp do aparatu w ustawieniach systemu.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.fileSize != null && a.fileSize > MAX_BYTES) {
      Alert.alert('Plik za duży', 'Maksymalny rozmiar załącznika to 5 MB.');
      return;
    }
    await runUpload({
      uri: a.uri,
      name: a.fileName ?? `camera-${Date.now()}.jpg`,
      type: a.mimeType ?? 'image/jpeg',
    });
  }, [runUpload]);

  const onPickPdf = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    if (!a) return;
    if (a.size != null && a.size > MAX_BYTES) {
      Alert.alert('Plik za duży', 'Maksymalny rozmiar załącznika to 5 MB.');
      return;
    }
    await runUpload({
      uri: a.uri,
      name: a.name ?? 'document.pdf',
      type: a.mimeType ?? 'application/pdf',
    });
  }, [runUpload]);

  const onRemove = useCallback(
    (id: string) => {
      Alert.alert('Usunąć załącznik?', 'Tej operacji nie cofniesz.', [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setRemovingId(id);
              try {
                await deleteAttachment(id);
                onAttachmentsChange(attachments.filter((x) => x.id !== id));
              } catch (e) {
                Alert.alert('Błąd', getApiErrorMessage(e));
              } finally {
                setRemovingId(null);
              }
            })();
          },
        },
      ]);
    },
    [attachments, onAttachmentsChange],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: 10, marginTop: 8 },
        title: { fontSize: 16, fontWeight: '700', color: colors.text },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        chip: {
          backgroundColor: colors.surfaceMuted,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
        },
        chipDisabled: { opacity: 0.5 },
        chipText: { color: colors.text, fontWeight: '600', fontSize: 14 },
        uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        hint: { color: colors.textMuted, fontSize: 14 },
        scroll: { flexGrow: 0 },
        thumbWrap: { marginRight: 10, position: 'relative' },
        thumb: {
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: 8,
          backgroundColor: colors.surfaceMuted,
        },
        pdfThumb: { alignItems: 'center', justifyContent: 'center' },
        pdfLabel: { fontWeight: '800', color: colors.primary, fontSize: 12 },
        removeBtn: {
          position: 'absolute',
          top: -6,
          right: -6,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: 'rgba(220,38,38,0.95)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        removeText: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: -2 },
        empty: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
      }),
    [colors],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Załączniki</Text>
      {!readOnly ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.chip, busy && styles.chipDisabled]}
            onPress={() => void onPickGallery()}
            disabled={busy}
          >
            <Text style={styles.chipText}>Galeria</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, busy && styles.chipDisabled]}
            onPress={() => void onPickCamera()}
            disabled={busy}
          >
            <Text style={styles.chipText}>Aparat</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, busy && styles.chipDisabled]}
            onPress={() => void onPickPdf()}
            disabled={busy}
          >
            <Text style={styles.chipText}>PDF</Text>
          </Pressable>
        </View>
      ) : null}
      {busy ? (
        <View style={styles.uploadRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Wysyłanie…</Text>
        </View>
      ) : null}

      {attachments.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
          {attachments.map((a) => {
            const isImage = a.mimetype.startsWith('image/');
            const uri = resolveMediaUrl(a.url);
            return (
              <View key={a.id} style={styles.thumbWrap}>
                {isImage ? (
                  <Image
                    source={{ uri }}
                    style={styles.thumb}
                    contentFit="cover"
                    recyclingKey={a.id}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[styles.thumb, styles.pdfThumb]}>
                    <Text style={styles.pdfLabel}>PDF</Text>
                  </View>
                )}
                {!readOnly ? (
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => onRemove(a.id)}
                    disabled={removingId === a.id}
                  >
                    {removingId === a.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.removeText}>×</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>Brak załączników</Text>
      )}
    </View>
  );
}
