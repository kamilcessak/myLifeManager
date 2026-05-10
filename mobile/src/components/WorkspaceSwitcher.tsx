import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PERSONAL_WORKSPACE_LABEL,
  TEAM_WORKSPACE_FALLBACK_LABEL,
} from '@mlm/shared';
import { useTeams } from '../hooks/useTeams';
import { useWorkspaceStore } from '../store/workspaceStore';

export function WorkspaceSwitcher() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const { data: teams, isLoading, isError, refetch, isFetching } = useTeams();
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    if (isLoading) return '…';
    if (activeWorkspaceId === null) return PERSONAL_WORKSPACE_LABEL;
    const team = teams?.find((t) => t.id === activeWorkspaceId);
    return team?.name ?? TEAM_WORKSPACE_FALLBACK_LABEL;
  }, [activeWorkspaceId, isLoading, teams]);

  const pickPersonal = () => {
    setActiveWorkspace(null);
    setOpen(false);
  };

  const pickTeam = (id: string) => {
    setActiveWorkspace(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="Wybierz obszar roboczy"
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Obszar roboczy</Text>
            {isLoading ? (
              <ActivityIndicator style={styles.loader} />
            ) : isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Nie udało się wczytać zespołów.</Text>
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => void refetch()}
                  disabled={isFetching}
                >
                  <Text style={styles.retryBtnText}>{isFetching ? '…' : 'Spróbuj ponownie'}</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                <Pressable
                  style={[styles.option, activeWorkspaceId === null && styles.optionSelected]}
                  onPress={pickPersonal}
                >
                  <Text style={styles.optionTitle}>{PERSONAL_WORKSPACE_LABEL}</Text>
                  {activeWorkspaceId === null ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>

                {teams && teams.length > 0 ? (
                  <Text style={styles.sectionLabel}>Zespoły</Text>
                ) : null}

                {teams?.map((team) => (
                  <Pressable
                    key={team.id}
                    style={[
                      styles.option,
                      activeWorkspaceId === team.id && styles.optionSelected,
                    ]}
                    onPress={() => pickTeam(team.id)}
                  >
                    <Text style={styles.optionTitle} numberOfLines={1}>
                      {team.name}
                    </Text>
                    {activeWorkspaceId === team.id ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable style={styles.closeFooter} onPress={() => setOpen(false)}>
              <Text style={styles.closeFooterText}>Zamknij</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 168,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  triggerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  chevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    color: '#111827',
  },
  loader: {
    padding: 24,
  },
  errorBox: {
    padding: 16,
    gap: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  optionSelected: {
    backgroundColor: '#eff6ff',
  },
  optionTitle: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    marginRight: 8,
  },
  check: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '700',
  },
  closeFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeFooterText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
});
