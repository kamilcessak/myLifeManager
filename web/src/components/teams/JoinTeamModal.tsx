import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useJoinTeamMutation } from '../../hooks/useTeams';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiErrors';

interface JoinTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinTeamModal({ isOpen, onClose }: JoinTeamModalProps) {
  useEscapeToClose(onClose, isOpen);
  const queryClient = useQueryClient();
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const joinMutation = useJoinTeamMutation();

  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setFormError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setFormError('Wpisz kod zaproszenia.');
      return;
    }
    setFormError(null);

    joinMutation.mutate(
      { code: trimmed },
      {
        async onSuccess(data) {
          onClose();
          await queryClient.refetchQueries({ queryKey: ['teams'] });
          setActiveWorkspace(data.teamId);
          toast.success('Dołączono do zespołu');
        },
        onError(err) {
          setFormError(getApiErrorMessage(err));
        },
      },
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay z-[60]" onClick={onClose}>
      <div
        className="modal-content max-w-md animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Dołącz do zespołu</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="join-team-code" className="mb-1 block text-sm font-medium text-[var(--app-text)]">
              Kod zaproszenia
            </label>
            <input
              id="join-team-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              placeholder="np. a1b2c3d4"
              className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 font-mono text-sm tracking-wide outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2"
            />
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Wpisz kod otrzymany od właściciela zespołu.
            </p>
          </div>
          {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
          <Button
            type="submit"
            className="w-full border-0 bg-blue-500 text-white shadow-sm hover:bg-blue-600"
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dołączanie…
              </>
            ) : (
              'Dołącz'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
