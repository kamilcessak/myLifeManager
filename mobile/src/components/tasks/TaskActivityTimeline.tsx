import { format, formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import type { ActivityLogAction, ActivityLogEntry } from '@mlm/shared';
import { AssigneeAvatar } from '../AssigneeAvatar';
import type { TeamMemberListItem } from '../../hooks/useTeamMembers';

type MemberLookup = Map<string, TeamMemberListItem>;

function findMember(members: MemberLookup, userId: string | null): TeamMemberListItem | undefined {
  if (!userId) return undefined;
  return members.get(userId);
}

function assigneeDisplayName(members: MemberLookup, userId: string | null): string {
  if (!userId) return 'nikogo';
  const member = findMember(members, userId);
  if (!member) return 'nieznanego użytkownika';
  return member.user.name || member.user.email;
}

function formatStatusValue(value: string | null | undefined): string {
  if (value === 'completed') return 'wykonane';
  if (value === 'open') return 'do zrobienia';
  return value ?? '';
}

function formatDeadlineValue(value: string | null | undefined): string {
  if (!value) return 'brak';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, 'd MMM yyyy, HH:mm', { locale: pl });
}

function renderActionLine(
  entry: ActivityLogEntry,
  members: MemberLookup,
): { fragment: ReactNode; trailingAvatar?: ReactNode } {
  const action = entry.action as ActivityLogAction;
  switch (action) {
    case 'CREATED':
      return { fragment: 'utworzył(a) zadanie' };
    case 'UPDATED_STATUS':
      return {
        fragment: (
          <>
            zmienił(a) status na{' '}
            <Text style={styles.emphasis}>{formatStatusValue(entry.newValue)}</Text>
          </>
        ),
      };
    case 'CHANGED_ASSIGNEE': {
      const newAssigneeId = entry.newValue;
      if (!newAssigneeId) {
        return { fragment: 'usunął(a) przypisanie' };
      }
      const member = findMember(members, newAssigneeId);
      const newName = assigneeDisplayName(members, newAssigneeId);
      return {
        fragment: (
          <>
            przypisał(a) zadanie do <Text style={styles.emphasis}>{newName}</Text>
          </>
        ),
        trailingAvatar: member ? (
          <AssigneeAvatar
            assignee={{
              id: member.user.id,
              name: member.user.name,
              email: member.user.email,
              avatarUrl: member.user.avatarUrl,
            }}
            size={22}
          />
        ) : undefined,
      };
    }
    case 'CHANGED_DEADLINE': {
      const prev = formatDeadlineValue(entry.oldValue);
      const next = formatDeadlineValue(entry.newValue);
      return {
        fragment: (
          <>
            zmienił(a) termin z <Text style={styles.emphasis}>{prev}</Text> na{' '}
            <Text style={styles.emphasis}>{next}</Text>
          </>
        ),
      };
    }
    default:
      return {
        fragment: (
          <>
            wykonał(a) akcję <Text style={styles.mono}>{entry.action}</Text>
          </>
        ),
      };
  }
}

export type TaskActivityTimelineProps = {
  entries: ActivityLogEntry[] | undefined;
  members: TeamMemberListItem[];
  isLoading: boolean;
  isError: boolean;
};

export function TaskActivityTimeline({
  entries,
  members,
  isLoading,
  isError,
}: TaskActivityTimelineProps) {
  const memberMap: MemberLookup = new Map(members.map((m) => [m.user.id, m]));

  if (isLoading) {
    return (
      <View style={styles.centerRow}>
        <ActivityIndicator />
        <Text style={styles.muted}>Ładowanie historii…</Text>
      </View>
    );
  }

  if (isError) {
    return <Text style={styles.error}>Nie udało się pobrać historii zmian.</Text>;
  }

  if (!entries || entries.length === 0) {
    return <Text style={styles.muted}>Brak zapisanych zdarzeń.</Text>;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Historia zmian</Text>
      <View style={styles.timeline}>
        {entries.map((entry, index) => {
          const { fragment, trailingAvatar } = renderActionLine(entry, memberMap);
          const relative = formatDistanceToNow(new Date(entry.createdAt), {
            addSuffix: true,
            locale: pl,
          });
          const absolute = format(new Date(entry.createdAt), 'd MMM yyyy, HH:mm', {
            locale: pl,
          });
          const actorName = entry.user.name?.trim() || 'Użytkownik';

          return (
            <View key={entry.id} style={styles.row}>
              <View style={styles.gutter}>
                <View style={[styles.dot, index === 0 && styles.dotStrong]} />
                {index < entries.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.body}>
                <View style={styles.actorRow}>
                  <AssigneeAvatar
                    assignee={{
                      id: entry.user.id,
                      name: entry.user.name,
                      avatarUrl: entry.user.avatarUrl,
                    }}
                    size={36}
                  />
                  <View style={styles.actorText}>
                    <View style={styles.actionWrap}>
                      <Text style={styles.actionLine}>
                        <Text style={styles.actorName}>{actorName}</Text> {fragment}
                      </Text>
                      {trailingAvatar ? (
                        <View style={styles.trailingAvatar}>{trailingAvatar}</View>
                      ) : null}
                    </View>
                    <Text style={styles.time} accessibilityLabel={absolute}>
                      {relative}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  muted: {
    fontSize: 14,
    color: '#6b7280',
  },
  error: {
    fontSize: 14,
    color: '#b91c1c',
  },
  timeline: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
  },
  gutter: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#93c5fd',
    borderWidth: 2,
    borderColor: '#fff',
    marginTop: 14,
  },
  dotStrong: {
    backgroundColor: '#2563eb',
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
    minHeight: 24,
  },
  body: {
    flex: 1,
    paddingBottom: 16,
    paddingLeft: 8,
  },
  actorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  actorText: {
    flex: 1,
    minWidth: 0,
  },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  actionLine: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flexShrink: 1,
  },
  actorName: {
    fontWeight: '700',
    color: '#111827',
  },
  emphasis: {
    fontWeight: '600',
    color: '#111827',
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
  },
  time: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
  trailingAvatar: {
    flexShrink: 0,
  },
});
