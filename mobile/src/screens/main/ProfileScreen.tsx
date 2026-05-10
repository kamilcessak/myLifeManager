import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import type { ProfileStackParamList } from '../../navigation/ProfileStack';
import { useAuthStore } from '../../store/authStore';
import { useAppTheme } from '../../theme/AppThemeProvider';

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>>();
  const { colors } = useAppTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [editOpen, setEditOpen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerLeft: undefined });
  }, [navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, padding: 20, gap: 10, backgroundColor: colors.background },
        title: { fontSize: 22, fontWeight: '700', marginBottom: 4, color: colors.text },
        meta: { fontSize: 16, marginBottom: 4, color: colors.text },
        link: {
          marginTop: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
        },
        linkText: { fontSize: 16, fontWeight: '600', color: colors.text },
        linkHint: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
        button: {
          marginTop: 20,
          alignSelf: 'flex-start',
          backgroundColor: colors.danger,
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 8,
        },
        buttonText: {
          color: '#fff',
          fontWeight: '600',
          fontSize: 16,
        },
      }),
    [colors],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      {user ? (
        <>
          <Text style={styles.meta}>E-mail: {user.email}</Text>
          <Text style={styles.meta}>Imię: {user.name ?? '—'}</Text>
        </>
      ) : null}

      <Pressable style={styles.link} onPress={() => setEditOpen(true)}>
        <Text style={styles.linkText}>Edytuj profil</Text>
        <Text style={styles.linkHint}>Zmiana imienia</Text>
      </Pressable>

      <Pressable style={styles.link} onPress={() => navigation.navigate('Preferences')}>
        <Text style={styles.linkText}>Ustawienia wyglądu</Text>
        <Text style={styles.linkHint}>Jasny, ciemny lub zgodny z systemem</Text>
      </Pressable>

      <Pressable style={styles.link} onPress={() => navigation.navigate('Account')}>
        <Text style={styles.linkText}>Konto i dane</Text>
        <Text style={styles.linkHint}>Eksport RODO, usunięcie konta</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => {
          void logout();
        }}
      >
        <Text style={styles.buttonText}>Wyloguj</Text>
      </Pressable>

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        initialName={user?.name ?? ''}
      />
    </View>
  );
}
