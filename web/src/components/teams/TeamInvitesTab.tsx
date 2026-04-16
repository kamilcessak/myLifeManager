import { useState } from 'react';
import { Check, Copy, Loader2, Mail, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TeamInvitation } from 'shared';
import { Button } from '@/components/ui/button';
import { useInviteMembersMutation } from '../../hooks/useTeams';
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

interface TeamInvitesTabProps {
  teamId: string;
  isOwner: boolean;
}

export default function TeamInvitesTab({ teamId, isOwner }: TeamInvitesTabProps) {
  const inviteMutation = useInviteMembersMutation();
  const [emailsText, setEmailsText] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInvites, setGeneratedInvites] = useState<TeamInvitation[] | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOwner) {
    return (
      <p className="text-sm text-[var(--app-text-muted)]">
        Tylko właściciel zespołu może generować zaproszenia.
      </p>
    );
  }

  const handleInvite = () => {
    const emails = parseEmails(emailsText);
    if (emails.length === 0) {
      setInviteError('Podaj co najmniej jeden adres e-mail.');
      return;
    }
    setInviteError(null);
    inviteMutation.mutate(
      { teamId, emails },
      {
        onSuccess: (invitations) => {
          setGeneratedInvites(invitations);
          toast.success('Zaproszenia wygenerowane');
        },
        onError: (err) => setInviteError(getApiErrorMessage(err)),
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

  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-[var(--app-text-muted)]">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        Wpisz adresy e-mail (oddzielone przecinkiem, średnikiem lub nową linią). Dla każdego
        adresu powstanie unikalny kod zaproszenia ważny 7 dni.
      </div>

      <textarea
        value={emailsText}
        onChange={(e) => setEmailsText(e.target.value)}
        rows={4}
        placeholder="anna@example.com, jan@example.com"
        className="w-full resize-y rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2"
      />
      {inviteError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
      ) : null}

      <Button
        type="button"
        onClick={handleInvite}
        disabled={inviteMutation.isPending}
        className="w-full border-0 bg-blue-500 text-white shadow-sm hover:bg-blue-600 sm:w-auto"
      >
        {inviteMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generowanie…
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Wygeneruj zaproszenia
          </>
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
  );
}
