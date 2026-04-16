import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Copy, Check } from 'lucide-react';
import type { TeamInvitation } from 'shared';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import {
  useInviteMembersMutation,
  useTeamMembers,
  useTeams,
  type TeamListItem,
} from '../../hooks/useTeams';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiErrors';

function parseEmails(raw: string): string[] {
  const parts = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function roleLabel(role: string): string {
  if (role === 'OWNER') return 'Właściciel';
  if (role === 'MEMBER') return 'Członek';
  return role;
}

interface TeamManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TeamManagerModal({ isOpen, onClose }: TeamManagerModalProps) {
  useEscapeToClose(onClose, isOpen);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: teams } = useTeams();
  const { data: members, isLoading: membersLoading, isError: membersError } = useTeamMembers(
    isOpen ? activeWorkspaceId : null,
  );
  const inviteMutation = useInviteMembersMutation();

  const [emailsText, setEmailsText] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInvites, setGeneratedInvites] = useState<TeamInvitation[] | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const activeTeam: TeamListItem | undefined = useMemo(
    () => teams?.find((t) => t.id === activeWorkspaceId),
    [teams, activeWorkspaceId],
  );
  const isOwner = activeTeam?.myRole === 'OWNER';

  useEffect(() => {
    if (!isOpen) {
      setEmailsText('');
      setInviteError(null);
      setGeneratedInvites(null);
      setCopiedCode(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !activeWorkspaceId) {
      onClose();
    }
  }, [isOpen, activeWorkspaceId, onClose]);

  const handleInvite = () => {
    if (!activeWorkspaceId) return;
    const emails = parseEmails(emailsText);
    if (emails.length === 0) {
      setInviteError('Podaj co najmniej jeden adres e-mail.');
      return;
    }
    setInviteError(null);
    inviteMutation.mutate(
      { teamId: activeWorkspaceId, emails },
      {
        onSuccess: (invitations) => {
          setGeneratedInvites(invitations);
          toast.success('Zaproszenia wygenerowane');
        },
        onError: (err) => {
          setInviteError(getApiErrorMessage(err));
        },
      },
    );
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Skopiowano kod');
      window.setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000);
    } catch {
      toast.error('Nie udało się skopiować do schowka');
    }
  };

  if (!isOpen || !activeWorkspaceId) {
    return null;
  }

  return (
    <div className="modal-overlay z-[60]" onClick={onClose}>
      <div
        className="modal-content max-w-lg animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--app-text)]">Zarządzaj zespołem</h2>
            {activeTeam ? (
              <p className="mt-0.5 text-sm text-[var(--app-text-muted)]">{activeTeam.name}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto px-5 py-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--app-text)]">Członkowie</h3>
            {membersLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Ładowanie listy…
              </div>
            ) : membersError ? (
              <p className="text-sm text-red-600 dark:text-red-400">Nie udało się wczytać członków</p>
            ) : members && members.length > 0 ? (
              <ul className="divide-y divide-[var(--app-border)] rounded-lg border border-[var(--app-border)]">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--app-text)]">
                        {m.user.name?.trim() || m.user.email}
                      </p>
                      {m.user.name?.trim() ? (
                        <p className="truncate text-xs text-[var(--app-text-muted)]">{m.user.email}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-md bg-[var(--app-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--app-text)]">
                      {roleLabel(m.role)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--app-text-muted)]">Brak członków do wyświetlenia.</p>
            )}
          </section>

          {isOwner ? (
            <section className="mt-8 space-y-3 border-t border-[var(--app-border)] pt-6">
              <h3 className="text-sm font-semibold text-[var(--app-text)]">Zapraszanie</h3>
              <p className="text-xs text-[var(--app-text-muted)]">
                Wpisz adresy e-mail (oddzielone przecinkiem, średnikiem lub nową linią). Dla każdego
                adresu powstanie unikalny kod zaproszenia.
              </p>
              <textarea
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                rows={4}
                placeholder="anna@example.com, jan@example.com"
                className="w-full resize-y rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2"
              />
              {inviteError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
              ) : null}
              <Button
                type="button"
                onClick={handleInvite}
                disabled={inviteMutation.isPending}
                className="w-full sm:w-auto"
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generowanie…
                  </>
                ) : (
                  'Wygeneruj zaproszenia'
                )}
              </Button>

              {generatedInvites && generatedInvites.length > 0 ? (
                <div className="mt-4 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/50 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
                    Wygenerowane kody
                  </p>
                  <ul className="space-y-2">
                    {generatedInvites.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex flex-col gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="truncate text-[var(--app-text-muted)]">{inv.email}</p>
                          <p className="font-mono text-sm font-medium tracking-wide text-[var(--app-text)]">
                            {inv.code}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => void copyCode(inv.code)}
                        >
                          {copiedCode === inv.code ? (
                            <Check className="mr-1 h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="mr-1 h-3.5 w-3.5" />
                          )}
                          Skopiuj kod
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : (
            <p className="mt-6 border-t border-[var(--app-border)] pt-6 text-sm text-[var(--app-text-muted)]">
              Tylko właściciel zespołu może generować zaproszenia.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
