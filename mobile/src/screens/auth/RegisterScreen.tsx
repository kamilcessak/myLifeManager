import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { registerSchema } from '@mlm/shared';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const register = useAuthStore((s) => s.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const parsed = registerSchema.safeParse({
      email,
      password,
      name: name.trim() === '' ? undefined : name.trim(),
    });
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      Alert.alert('Walidacja', Object.values(msg).flat().filter(Boolean).join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      await register(parsed.data.email, parsed.data.password, parsed.data.name);
    } catch {
      // TODO(Phase 2): obsługa 409 (email zajęty) i innych kodów z /api/auth/register
      Alert.alert('Rejestracja', 'Nie udało się utworzyć konta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Imię (opcjonalnie)</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Jan" />
      <Text style={styles.label}>E-mail</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />
      <Text style={styles.label}>Hasło</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="min. 6 znaków"
      />
      <Pressable
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>{submitting ? 'Tworzenie…' : 'Utwórz konto'}</Text>
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
});
