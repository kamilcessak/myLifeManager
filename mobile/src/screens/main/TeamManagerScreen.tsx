import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TeamRole } from '@mlm/shared';
import { AssigneeAvatar } from '../../components/AssigneeAvatar';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { getApiErrorMessage } from '../../lib/apiErrors';
import {
  useRemoveMemberMutation,
  useTeamMembers,
  useUpdateMemberRoleMutation,
  type TeamMemberListItem,
} from '../../hooks/useTeamMembers';
import type { AppStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

type Props = NativeStackScreenProps<AppStackParamList, 'TeamManager'>;

function roleLabel(role: TeamRole): string {
  return role === 'OWNER' ? 'Właściciel' : 'Członek';
}

export function TeamManagerScreen({ route, navigation }: Props) {
  const { teamId, teamName } = route.params;
  const currentUserId = useAuthStore((s) => s.user?.id);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  useLayoutEffect(() => {
    navigation.setOptions({ title: teamName });
  }, [navigation, teamName]);

  const { data: members, isLoading, isError, refetch, isFetching } = useTeamMembers(teamId);
  const updateRoleMutation = useUpdateMemberRoleMutation();
  const removeMemberMutation = useRemoveMemberMutation();

  const myRole = useMemo(() => {
    const self = members?.find((m) => m.userId === currentUserId);
    return self?.role;
  }, [members, currentUserId]);

  const isOwner = myRole === 'OWNER';

  const [menuMember, setMenuMember] = useState<TeamMemberListItem | null>(null);
  const [confirmKick, setConfirmKick] = useState<TeamMemberListItem | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const closeMenu = useCallback(() => setMenuMember(null), []);

  const handleToggleRole = useCallback(
    (member: TeamMemberListItem) => {
      closeMenu();
      const nextRole: TeamRole = member.role === 'OWNER' ? 'MEMBER' : 'OWNER';
      updateRoleMutation.mutate(
        { teamId, userId: member.userId, role: nextRole },
        {
          onError: (err) => Alert.alert('Błąd', getApiErrorMessage(err)),
        },
      );
    },
    [closeMenu, teamId, updateRoleMutation],
  );

  const handleKick = useCallback(() => {
    if (!confirmKick) return;
    const member = confirmKick;
    setConfirmKick(null);
    removeMemberMutation.mutate(
      { teamId, targetUserId: member.userId },
      {
        onError: (err) => Alert.alert('Błąd', getApiErrorMessage(err)),
      },
    );
  }, [confirmKick, teamId, removeMemberMutation]);

  const handleLeave = useCallback(() => {
    if (!currentUserId) return;
    setConfirmLeave(false);
    removeMemberMutation.mutate(
      { teamId, targetUserId: currentUserId },
      {
        onSuccess: () => {
          setActiveWorkspace(null);
          navigation.popToTop();
        },
        onError: (err) => Alert.alert('Błąd', getApiErrorMessage(err)),
      },
    );
  }, [currentUserId, teamId, navigation, removeMemberMutation, setActiveWorkspace]);

  const renderMember = useCallback(
    ({ item: m }: { item: TeamMemberListItem }) => {
      const isSelf = m.userId === currentUserId;
      const isMemberOwner = m.role === 'OWNER';
      const canShowActions = isOwner && !isSelf;

      return (
        <View style={styles.memberRow}>
          <AssigneeAvatar
            assignee={{
              id: m.user.id,
              name: m.user.name,
              email: m.user.email,
              avatarUrl: m.user.avatarUrl,
            }}
            size={40}
          />
          <View style={styles.memberMain}>
            <Text style={styles.memberName} numberOfLines={1}>
              {m.user.name?.trim() || m.user.email}
              {isSelf ? <Text style={styles.youBadge}> (Ty)</Text> : null}
            </Text>
            {m.user.name?.trim() ? (
              <Text style={styles.memberEmail} numberOfLines={1}>
                {m.user.email}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.rolePill,
              isMemberOwner ? styles.rolePillOwner : styles.rolePillMember,
            ]}
          >
            <Text
              style={[styles.rolePillText, isMemberOwner ? styles.rolePillTextOwner : null]}
            >
              {roleLabel(m.role)}
            </Text>
          </View>
          {canShowActions ? (
            <Pressable style={styles.moreBtn} onPress={() => setMenuMember(m)} hitSlop={8}>
              <Text style={styles.moreBtnText}>⋮</Text>
            </Pressable>
          ) : (
            <View style={styles.morePlaceholder} />
          )}
        </View>
      );
    },
    [currentUserId, isOwner],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Ładowanie członków…</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>Nie udało się wczytać listy.</Text>
        <Pressable style={styles.retry} onPress={() => void refetch()} disabled={isFetching}>
          <Text style={styles.retryText}>{isFetching ? '…' : 'Spróbuj ponownie'}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Text style={styles.sectionHeading}>Członkowie</Text>

      <FlatList
        data={members ?? []}
        keyExtractor={(m) => m.id}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
        refreshing={isFetching && !isLoading}
        onRefresh={() => void refetch()}
        ListEmptyComponent={<Text style={styles.muted}>Brak członków.</Text>}
      />

      <Pressable
        style={styles.leaveBtn}
        onPress={() => setConfirmLeave(true)}
        disabled={removeMemberMutation.isPending}
      >
        <Text style={styles.leaveBtnText}>Opuść zespół</Text>
      </Pressable>

      <Modal visible={menuMember !== null} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <Pressable style={styles.menuCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.menuTitle}>Akcje członka</Text>
            {menuMember ? (
              <>
                <Pressable
                  style={styles.menuItem}
                  onPress={() => handleToggleRole(menuMember)}
                  disabled={updateRoleMutation.isPending}
                >
                  <Text style={styles.menuItemText}>
                    {menuMember.role === 'OWNER' ? 'Zmień na członka' : 'Uczyń właścicielem'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.menuItem, styles.menuItemDanger]}
                  onPress={() => {
                    setConfirmKick(menuMember);
                    closeMenu();
                  }}
                >
                  <Text style={styles.menuItemDangerText}>Wyrzuć z zespołu</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.menuCancel} onPress={closeMenu}>
              <Text style={styles.menuCancelText}>Anuluj</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        visible={confirmKick !== null}
        title="Wyrzucić członka?"
        message={
          confirmKick
            ? `Czy na pewno chcesz usunąć użytkownika ${
                confirmKick.user.name || confirmKick.user.email
              } z zespołu? Jego przypisania w zadaniach i wydarzeniach zespołu zostaną zresetowane.`
            : ''
        }
        confirmLabel="Wyrzuć"
        destructive
        loading={removeMemberMutation.isPending}
        onCancel={() => setConfirmKick(null)}
        onConfirm={handleKick}
      />

      <ConfirmDialog
        visible={confirmLeave}
        title="Opuścić zespół?"
        message="Stracisz dostęp do zadań, wydarzeń i kategorii tego zespołu. Jeśli jesteś jedynym właścicielem, przekaż własność innej osobie lub usuń zespół."
        confirmLabel="Opuść zespół"
        destructive
        loading={removeMemberMutation.isPending}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={handleLeave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#f9fafb',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  memberMain: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  youBadge: {
    fontWeight: '500',
    color: '#6b7280',
    fontSize: 13,
  },
  memberEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rolePillOwner: {
    backgroundColor: '#fef3c7',
  },
  rolePillMember: {
    backgroundColor: '#f3f4f6',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  rolePillTextOwner: {
    color: '#92400e',
  },
  moreBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  moreBtnText: {
    fontSize: 20,
    color: '#6b7280',
    fontWeight: '700',
  },
  morePlaceholder: {
    width: 22,
  },
  leaveBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
  },
  leaveBtnText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 15,
  },
  muted: {
    color: '#6b7280',
    fontSize: 14,
  },
  error: {
    color: '#b91c1c',
    fontSize: 15,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuTitle: {
    padding: 16,
    fontWeight: '700',
    fontSize: 16,
    color: '#111827',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
  },
  menuItemDanger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  menuItemDangerText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
  },
  menuCancel: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
