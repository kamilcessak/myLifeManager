import { Pressable, StyleSheet, Text, View } from 'react-native';
import { updateProfileSchema } from '@mlm/shared';
import { useAuthStore } from '../../store/authStore';

/** Schema gotowe na formularz PATCH /auth/me w Phase 2. */
export const profileUpdateSchema = updateProfileSchema;

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      {user ? (
        <>
          <Text style={styles.meta}>E-mail: {user.email}</Text>
          <Text style={styles.meta}>Imię: {user.name ?? '—'}</Text>
        </>
      ) : null}
      <Text style={styles.body}>
        {/* TODO(Phase 2): PATCH /api/auth/me + UpdateProfileInput / profileUpdateSchema */}
        Edycja danych konta — w kolejnej fazie, z walidacją przez profileUpdateSchema.
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => {
          void logout();
        }}
      >
        <Text style={styles.buttonText}>Wyloguj</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  meta: {
    fontSize: 16,
    marginBottom: 4,
  },
  body: {
    fontSize: 16,
    color: '#444',
    marginTop: 8,
    lineHeight: 22,
  },
  button: {
    marginTop: 24,
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
