import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema } from '@mlm/shared';
import { useCallback, useEffect, useMemo } from 'react';
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
import { useUpdateProfileMutation } from '../../hooks/useUpdateProfileMutation';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { useAppTheme } from '../../theme/AppThemeProvider';

type ProfileFormValues = z.infer<typeof updateProfileSchema>;

export type EditProfileModalProps = {
  visible: boolean;
  onClose: () => void;
  initialName: string;
};

export function EditProfileModal({ visible, onClose, initialName }: EditProfileModalProps) {
  const { colors } = useAppTheme();
  const updateMutation = useUpdateProfileMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: initialName, avatarUrl: '' },
  });

  useEffect(() => {
    if (visible) {
      reset({ name: initialName, avatarUrl: '' });
    }
  }, [visible, initialName, reset]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const onValid = useCallback(
    (values: ProfileFormValues) => {
      const trimmed = (values.name ?? '').trim();
      const current = initialName.trim();

      if (trimmed === current) {
        close();
        return;
      }

      if (trimmed.length < 2) {
        Alert.alert('Imię', 'Imię musi mieć co najmniej 2 znaki.');
        return;
      }

      updateMutation.mutate(
        { name: trimmed },
        {
          onSuccess: () => close(),
          onError: (e) => {
            Alert.alert('Nie udało się zapisać profilu', getApiErrorMessage(e));
          },
        },
      );
    },
    [close, initialName, updateMutation],
  );

  const themed = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'center',
          paddingHorizontal: 24,
        },
        sheet: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 22,
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
          marginBottom: 8,
        },
        fieldError: {
          color: colors.danger,
          fontSize: 13,
          marginBottom: 8,
        },
        actions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 12,
          marginTop: 12,
        },
        btnGhost: {
          paddingVertical: 12,
          paddingHorizontal: 12,
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
          minWidth: 110,
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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={themed.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <View style={themed.sheet}>
            <Text style={themed.title}>Edytuj profil</Text>
            <Text style={themed.label}>Imię</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={themed.input}
                  value={value ?? ''}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Twoje imię"
                  placeholderTextColor={colors.textMuted}
                />
              )}
            />
            {errors.name ? <Text style={themed.fieldError}>{errors.name.message}</Text> : null}

            <View style={themed.actions}>
              <Pressable style={themed.btnGhost} onPress={close} disabled={updateMutation.isPending}>
                <Text style={themed.btnGhostText}>Anuluj</Text>
              </Pressable>
              <Pressable
                style={[themed.btnPrimary, updateMutation.isPending && { opacity: 0.7 }]}
                onPress={() => void handleSubmit(onValid)()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={themed.btnPrimaryText}>Zapisz</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
