import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AttachmentPanel } from '../../components/attachments/AttachmentPanel';
import { useEventDetailQuery } from '../../hooks/useEventDetailQuery';
import { useUpdateEventMutation } from '../../hooks/useUpdateEventMutation';
import { eventDetailQueryKey } from '../../lib/queryKeys';
import type { AppStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../theme/AppThemeProvider';

type Props = NativeStackScreenProps<AppStackParamList, 'EventEdit'>;

type PickerTarget = 'start' | 'end' | null;

export function EventEditScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const { data: event, isLoading, isError, error } = useEventDetailQuery(eventId);
  const updateMutation = useUpdateEventMutation(eventId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date());
  const [isAllDay, setIsAllDay] = useState(false);
  const [picker, setPicker] = useState<PickerTarget>(null);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setDescription(event.description ?? '');
    setLocation(event.location ?? '');
    setStart(new Date(event.startTime));
    setEnd(new Date(event.endTime));
    setIsAllDay(event.isAllDay);
  }, [event]);

  const attachments = event?.attachments ?? [];

  const setAttachments = (next: typeof attachments) => {
    if (!event) return;
    queryClient.setQueryData(eventDetailQueryKey(eventId), { ...event, attachments: next });
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
        multiline: { minHeight: 88, textAlignVertical: 'top' },
        rowBetween: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          paddingVertical: 4,
        },
        timeBtn: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          backgroundColor: colors.surface,
          marginBottom: 12,
        },
        timeBtnText: { color: colors.text, fontWeight: '600' },
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
      Alert.alert('Tytuł', 'Podaj tytuł wydarzenia.');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      Alert.alert('Czas', 'Data zakończenia musi być po rozpoczęciu.');
      return;
    }
    updateMutation.mutate(
      {
        title: t,
        description: description.trim() || null,
        location: location.trim() || null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        isAllDay,
      },
      {
        onSuccess: () => navigation.goBack(),
        onError: (e) => {
          Alert.alert('Zapis', e instanceof Error ? e.message : 'Nie udało się zapisać.');
        },
      },
    );
  };

  if (isLoading || !event) {
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
          placeholder="Tytuł"
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

        <Text style={styles.label}>Miejsce</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Opcjonalnie"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.rowBetween}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Całodniowe</Text>
          <Switch value={isAllDay} onValueChange={setIsAllDay} />
        </View>

        <Text style={styles.label}>Rozpoczęcie</Text>
        <Pressable style={styles.timeBtn} onPress={() => setPicker('start')}>
          <Text style={styles.timeBtnText}>{start.toLocaleString()}</Text>
        </Pressable>

        <Text style={styles.label}>Zakończenie</Text>
        <Pressable style={styles.timeBtn} onPress={() => setPicker('end')}>
          <Text style={styles.timeBtnText}>{end.toLocaleString()}</Text>
        </Pressable>

        {picker ? (
          <DateTimePicker
            value={picker === 'start' ? start : end}
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, d) => {
              if (Platform.OS === 'android') {
                setPicker(null);
                if (event.type !== 'set' || !d) return;
              }
              if (!d) return;
              if (picker === 'start') setStart(d);
              else setEnd(d);
            }}
          />
        ) : null}
        {Platform.OS === 'ios' && picker ? (
          <Pressable style={styles.timeBtn} onPress={() => setPicker(null)}>
            <Text style={styles.timeBtnText}>Gotowe</Text>
          </Pressable>
        ) : null}

        <AttachmentPanel
          variant="event"
          parentId={eventId}
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
