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
import { loginSchema } from '@mlm/shared';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      Alert.alert('Walidacja', Object.values(msg).flat().filter(Boolean).join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
    } catch {
      // TODO(Phase 2): mapowanie komunikatów z API (401, 422, sieć)
      Alert.alert('Logowanie', 'Nie udało się zalogować. Sprawdź dane lub połączenie z API.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
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
        placeholder="••••••••"
      />
      <Pressable
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={() => void onSubmit()}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>{submitting ? 'Logowanie…' : 'Zaloguj'}</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.linkText}>Nie masz konta? Zarejestruj się</Text>
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
    backgroundColor: '#2563eb',
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
