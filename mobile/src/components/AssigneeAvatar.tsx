import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { resolveAvatarUri } from '../lib/resolveAvatarUri';

export type AssigneeAvatarUser = {
  id: string;
  name: string | null;
  email?: string | null;
  avatarUrl: string | null;
};

export type AssigneeAvatarProps = {
  assignee: AssigneeAvatarUser;
  size?: number;
  accessibilityLabel?: string;
};

function initialLetter(assignee: Pick<AssigneeAvatarUser, 'name' | 'email'>): string {
  const fromName = assignee.name?.trim();
  if (fromName) return fromName.charAt(0).toUpperCase();
  const fromEmail = assignee.email?.trim();
  if (fromEmail) return fromEmail.charAt(0).toUpperCase();
  return '?';
}

export function AssigneeAvatar({
  assignee,
  size = 32,
  accessibilityLabel,
}: AssigneeAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const uri = useMemo(() => resolveAvatarUri(assignee.avatarUrl), [assignee.avatarUrl]);
  const letter = useMemo(() => initialLetter(assignee), [assignee.email, assignee.name]);
  const showImage = Boolean(uri) && !imageFailed;

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      accessibilityLabel={accessibilityLabel ?? assignee.name ?? assignee.email ?? 'Awatar'}
    >
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
});
