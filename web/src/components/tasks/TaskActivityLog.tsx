import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { History } from 'lucide-react';
import { tasksApi } from '../../lib/api';
import { useTeamMembers } from '../../hooks/useTeams';
import AssigneeAvatar from '../AssigneeAvatar';
import type { TeamMemberApiRow } from '../../lib/api';
import type { ActivityLogEntry, TaskAssignee } from '../../types';

interface TaskActivityLogProps {
  taskId: string;
  /**
   * ID of the team/workspace the task belongs to. Used to resolve
   * assignee IDs to human-readable names. Pass `null` for personal tasks.
   */
  teamId: string | null;
}

type MemberLookup = Map<string, TeamMemberApiRow>;

function findMember(
  members: MemberLookup,
  userId: string | null,
): TeamMemberApiRow | undefined {
  if (!userId) return undefined;
  return members.get(userId);
}

function assigneeDisplayName(members: MemberLookup, userId: string | null): string {
  if (!userId) return 'nikogo';
  const member = findMember(members, userId);
  if (!member) return 'nieznanego użytkownika';
  return member.user.name || member.user.email;
}

function toAssigneeObject(
  members: MemberLookup,
  userId: string | null,
): TaskAssignee | null {
  if (!userId) return null;
  const member = findMember(members, userId);
  if (!member) return null;
  return {
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    avatarUrl: member.user.avatarUrl,
  };
}

function formatStatusValue(value: string | null | undefined): string {
  if (value === 'completed') return 'wykonane';
  if (value === 'open') return 'do zrobienia';
  return value ?? '';
}

function formatDeadlineValue(value: string | null | undefined): string {
  if (!value) return 'brak';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'd MMM yyyy, HH:mm', { locale: pl });
}

interface RenderedAction {
  text: React.ReactNode;
  trailing?: React.ReactNode;
}

function renderAction(entry: ActivityLogEntry, members: MemberLookup): RenderedAction {
  switch (entry.action) {
    case 'CREATED':
      return { text: <>utworzył(a) zadanie</> };
    case 'UPDATED_STATUS':
      return {
        text: (
          <>
            zmienił(a) status na{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatStatusValue(entry.newValue)}
            </span>
          </>
        ),
      };
    case 'CHANGED_ASSIGNEE': {
      const newAssigneeId = entry.newValue;
      if (!newAssigneeId) {
        return { text: <>usunął(ęła) przypisanie</> };
      }
      const newAssignee = toAssigneeObject(members, newAssigneeId);
      const newName = assigneeDisplayName(members, newAssigneeId);
      return {
        text: (
          <>
            przypisał(a) zadanie do{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">{newName}</span>
          </>
        ),
        trailing: newAssignee ? (
          <AssigneeAvatar assignee={newAssignee} size="xs" showTitle={false} />
        ) : null,
      };
    }
    case 'CHANGED_DEADLINE': {
      const prev = formatDeadlineValue(entry.oldValue);
      const next = formatDeadlineValue(entry.newValue);
      return {
        text: (
          <>
            zmienił(a) termin z{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">{prev}</span>{' '}
            na{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">{next}</span>
          </>
        ),
      };
    }
    default:
      return {
        text: (
          <>
            wykonał(a) akcję <span className="font-mono">{entry.action}</span>
          </>
        ),
      };
  }
}

export default function TaskActivityLog({ taskId, teamId }: TaskActivityLogProps) {
  const {
    data: activity,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['tasks', taskId, 'activity'],
    queryFn: async () => {
      const res = await tasksApi.getActivity(taskId);
      return res.data.data.activity;
    },
    enabled: !!taskId,
  });

  const { data: teamMembersData } = useTeamMembers(teamId ?? null);
  const members: MemberLookup = new Map(
    (teamMembersData ?? []).map((m) => [m.user.id, m]),
  );

  return (
    <section
      aria-label="Historia zmian zadania"
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-transparent"
    >
      <header className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
        <History className="h-4 w-4" />
        Historia zmian
      </header>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ładowanie historii…</p>
      ) : isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          Nie udało się pobrać historii zmian.
        </p>
      ) : !activity || activity.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Brak zapisanych zdarzeń.</p>
      ) : (
        <ol className="relative border-l border-gray-200 pl-5 dark:border-gray-700">
          {activity.map((entry) => {
            const rendered = renderAction(entry, members);
            const actor: TaskAssignee = {
              id: entry.user.id,
              name: entry.user.name,
              email: '',
              avatarUrl: entry.user.avatarUrl,
            };
            const relative = formatDistanceToNow(new Date(entry.createdAt), {
              addSuffix: true,
              locale: pl,
            });
            const absolute = format(new Date(entry.createdAt), 'd MMM yyyy, HH:mm', {
              locale: pl,
            });

            return (
              <li key={entry.id} className="mb-4 last:mb-0">
                <span
                  aria-hidden
                  className="absolute -left-[7px] mt-1.5 block h-3 w-3 rounded-full border-2 border-white bg-blue-500 dark:border-gray-900"
                />
                <div className="flex items-start gap-2">
                  <AssigneeAvatar assignee={actor} size="sm" showTitle={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-gray-700 dark:text-gray-300">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {entry.user.name || 'Użytkownik'}
                      </span>{' '}
                      {rendered.text}
                      {rendered.trailing ? (
                        <span className="ml-1 inline-flex align-middle">
                          {rendered.trailing}
                        </span>
                      ) : null}
                    </p>
                    <time
                      dateTime={entry.createdAt}
                      title={absolute}
                      className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400"
                    >
                      {relative}
                    </time>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
