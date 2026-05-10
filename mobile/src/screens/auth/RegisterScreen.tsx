import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { registerFormSchema } from '../../lib/authFormSchemas';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type RegisterFormValues = {
  email: string;
  password: string;
  name: string;
};

type RegisterSubmitValues = z.infer<typeof registerFormSchema>;

export function RegisterScreen({ navigation }: Props) {
  const register = useAuthStore((s) => s.register);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<RegisterFormValues, unknown, RegisterSubmitValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { email: '', password: '', name: '' },
  });

  const onValid = async (data: RegisterSubmitValues) => {
    try {
      await register(data.email, data.password, data.name);
    } catch (e) {
      Alert.alert('Rejestracja', getApiErrorMessage(e));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Imię (opcjonalnie)</Text>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput style={styles.input} value={value} onBlur={onBlur} onChangeText={onChange} placeholder="Jan" />
        )}
      />
      {errors.name ? <Text style={styles.fieldError}>{errors.name.message}</Text> : null}
      <Text style={styles.label}>E-mail</Text>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="you@example.com"
          />
        )}
      />
      {errors.email ? <Text style={styles.fieldError}>{errors.email.message}</Text> : null}
      <Text style={styles.label}>Hasło</Text>
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={styles.input}
            secureTextEntry
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="min. 6 znaków"
          />
        )}
      />
      {errors.password ? <Text style={styles.fieldError}>{errors.password.message}</Text> : null}
      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={() => void handleSubmit(onValid)()}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Tworzenie…' : 'Utwórz konto'}</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>Masz konto? Zaloguj się</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 24,
    gap: 8,
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563eb',
    fontSize: 15,
  },
  fieldError: {
    color: '#b91c1c',
    fontSize: 13,
    marginTop: 2,
  },
});
