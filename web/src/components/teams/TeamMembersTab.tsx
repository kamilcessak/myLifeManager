import { useState } from 'react';
import {
  Loader2,
  LogOut,
  MoreVertical,
  Shield,
  ShieldCheck,
  UserMinus,
  UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { TeamRole } from 'shared';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../../store/authStore';
import {
  useRemoveMemberMutation,
  useTeamMembers,
  useUpdateMemberRoleMutation,
} from '../../hooks/useTeams';
import type { TeamMemberApiRow } from '../../lib/api';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import ConfirmDialog from './ConfirmDialog';

function roleLabel(role: TeamRole): string {
  return role === 'OWNER' ? 'Właściciel' : 'Członek';
}

interface TeamMembersTabProps {
  teamId: string;
  isOwner: boolean;
  onLeaveTeam: () => void;
}

export default function TeamMembersTab({
  teamId,
  isOwner,
  onLeaveTeam,
}: TeamMembersTabProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const { data: members, isLoading, isError } = useTeamMembers(teamId);
  const updateRoleMutation = useUpdateMemberRoleMutation();
  const removeMemberMutation = useRemoveMemberMutation();

  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const [confirmKick, setConfirmKick] = useState<TeamMemberApiRow | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const handleToggleRole = (member: TeamMemberApiRow) => {
    setOpenActionsFor(null);
    const nextRole: TeamRole = member.role === 'OWNER' ? 'MEMBER' : 'OWNER';
    updateRoleMutation.mutate(
      { teamId, userId: member.userId, role: nextRole },
      {
        onSuccess: () => {
          toast.success(
            nextRole === 'OWNER' ? 'Nadano rolę właściciela' : 'Zmieniono na członka',
          );
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  const handleKick = () => {
    if (!confirmKick) return;
    const member = confirmKick;
    setConfirmKick(null);
    removeMemberMutation.mutate(
      { teamId, targetUserId: member.userId },
      {
        onSuccess: () => {
          toast.success(`Usunięto: ${member.user.name || member.user.email}`);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  const handleLeave = () => {
    if (!currentUserId) return;
    setConfirmLeave(false);
    removeMemberMutation.mutate(
      { teamId, targetUserId: currentUserId },
      {
        onSuccess: () => {
          toast.success('Opuściłeś zespół');
          setActiveWorkspace(null);
          onLeaveTeam();
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ładowanie listy…
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-red-600 dark:text-red-400">Nie udało się wczytać członków</p>;
  }

  if (!members || members.length === 0) {
    return <p className="text-sm text-[var(--app-text-muted)]">Brak członków do wyświetlenia.</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-[var(--app-border)] rounded-lg border border-[var(--app-border)]">
        {members.map((m) => {
          const isSelf = m.userId === currentUserId;
          const isMemberOwner = m.role === 'OWNER';
          const canShowActions = isOwner && !isSelf;
          const actionsOpen = openActionsFor === m.id;
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium text-[var(--app-text)]">
                    {m.user.name?.trim() || m.user.email}
                    {isSelf ? (
                      <span className="rounded bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-xs text-[var(--app-text-muted)]">
                        Ty
                      </span>
                    ) : null}
                  </p>
                  {m.user.name?.trim() ? (
                    <p className="truncate text-xs text-[var(--app-text-muted)]">{m.user.email}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                    isMemberOwner
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-[var(--app-surface-muted)] text-[var(--app-text)]'
                  }`}
                >
                  {isMemberOwner ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : (
                    <Shield className="h-3.5 w-3.5" />
                  )}
                  {roleLabel(m.role)}
                </span>

                {canShowActions ? (
                  <div className="relative">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
                      onClick={() => setOpenActionsFor(actionsOpen ? null : m.id)}
                      aria-label="Akcje członka"
                      aria-haspopup="menu"
                      aria-expanded={actionsOpen}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {actionsOpen ? (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenActionsFor(null)}
                          aria-hidden="true"
                        />
                        <div
                          role="menu"
                          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] shadow-lg"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleToggleRole(m)}
                            disabled={updateRoleMutation.isPending}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-60"
                          >
                            {isMemberOwner ? (
                              <>
                                <Shield className="h-4 w-4" />
                                Zmień na Członka
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4" />
                                Uczyń Właścicielem
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setOpenActionsFor(null);
                              setConfirmKick(m);
                            }}
                            className="flex w-full items-center gap-2 border-t border-[var(--app-border)] px-3 py-2 text-left text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                          >
                            <UserMinus className="h-4 w-4" />
                            Wyrzuć z zespołu
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end border-t border-[var(--app-border)] pt-4">
        <Button
          type="button"
          variant="outline"
          className="border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
          onClick={() => setConfirmLeave(true)}
          disabled={removeMemberMutation.isPending}
        >
          {removeMemberMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          Opuść zespół
        </Button>
      </div>

      <ConfirmDialog
        isOpen={!!confirmKick}
        title="Wyrzucić członka?"
        description={
          confirmKick
            ? `Czy na pewno chcesz usunąć użytkownika ${
                confirmKick.user.name || confirmKick.user.email
              } z zespołu? Jego przypisania w zadaniach i wydarzeniach zespołu zostaną zresetowane.`
            : ''
        }
        confirmLabel="Wyrzuć"
        tone="danger"
        isLoading={removeMemberMutation.isPending}
        onCancel={() => setConfirmKick(null)}
        onConfirm={handleKick}
      />

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Opuścić zespół?"
        description="Stracisz dostęp do zadań, wydarzeń i kategorii tego zespołu. Jeśli jesteś jedynym właścicielem, przekaż własność innej osobie lub usuń zespół."
        confirmLabel="Opuść zespół"
        tone="danger"
        isLoading={removeMemberMutation.isPending}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={handleLeave}
      />
    </div>
  );
}
