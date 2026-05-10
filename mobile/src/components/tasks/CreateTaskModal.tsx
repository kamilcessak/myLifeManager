import { zodResolver } from '@hookform/resolvers/zod';
import { createTaskSchema } from '@mlm/shared';
import { useCallback, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { z } from 'zod';
import { useCreateTaskMutation } from '../../hooks/useCreateTaskMutation';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { useAppTheme } from '../../theme/AppThemeProvider';

const createTaskQuickSchema = createTaskSchema.pick({ title: true, description: true });
type CreateTaskQuickValues = z.infer<typeof createTaskQuickSchema>;

export type CreateTaskModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function CreateTaskModal({ visible, onClose }: CreateTaskModalProps) {
  const { colors } = useAppTheme();
  const createMutation = useCreateTaskMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTaskQuickValues>({
    resolver: zodResolver(createTaskQuickSchema),
    defaultValues: { title: '', description: '' },
  });

  const close = useCallback(() => {
    reset({ title: '', description: '' });
    onClose();
  }, [onClose, reset]);

  const onValid = useCallback(
    (values: CreateTaskQuickValues) => {
      createMutation.mutate(
        {
          title: values.title.trim(),
          ...(values.description?.trim() ? { description: values.description.trim() } : {}),
        },
        {
          onSuccess: () => {
            close();
          },
          onError: (e) => {
            Alert.alert('Nie udało się utworzyć zadania', getApiErrorMessage(e));
          },
        },
      );
    },
    [close, createMutation],
  );

  const themed = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 28,
          maxHeight: '85%',
        },
        title: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 14,
        },
        label: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 6,
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: Platform.OS === 'ios' ? 12 : 8,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.surfaceMuted,
          marginBottom: 12,
        },
        inputMultiline: {
          minHeight: 100,
          textAlignVertical: 'top',
        },
        fieldError: {
          color: colors.danger,
          fontSize: 13,
          marginTop: -8,
          marginBottom: 8,
        },
        actions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 12,
          marginTop: 8,
        },
        btnGhost: {
          paddingVertical: 12,
          paddingHorizontal: 16,
        },
        btnGhostText: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.textMuted,
        },
        btnPrimary: {
          backgroundColor: colors.primary,
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 10,
          minWidth: 120,
          alignItems: 'center',
        },
        btnPrimaryText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: '700',
        },
      }),
    [colors],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={themed.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={themed.sheet}>
            <Text style={themed.title}>Nowe zadanie</Text>

            <Text style={themed.label}>Tytuł</Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={themed.input}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Np. Kupić mleko"
                  placeholderTextColor={colors.textMuted}
                />
              )}
            />
            {errors.title ? <Text style={themed.fieldError}>{errors.title.message}</Text> : null}

            <Text style={themed.label}>Opis (opcjonalnie)</Text>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[themed.input, themed.inputMultiline]}
                  value={value ?? ''}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Szczegóły…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              )}
            />
            {errors.description ? (
              <Text style={themed.fieldError}>{errors.description.message}</Text>
            ) : null}

            <View style={themed.actions}>
              <Pressable style={themed.btnGhost} onPress={close} disabled={createMutation.isPending}>
                <Text style={themed.btnGhostText}>Anuluj</Text>
              </Pressable>
              <Pressable
                style={[themed.btnPrimary, createMutation.isPending && { opacity: 0.7 }]}
                onPress={() => void handleSubmit(onValid)()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={themed.btnPrimaryText}>Utwórz</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
