import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useCreateTeamMutation } from '../../hooks/useTeams';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import axios from 'axios';

function apiErrorMessage(error: unknown): string {
  if (
    axios.isAxiosError(error) &&
    error.response?.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data
  ) {
    const msg = (error.response.data as { message?: string }).message;
    if (msg) return msg;
  }
  return 'Wystąpił nieoczekiwany błąd';
}

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateTeamModal({ isOpen, onClose }: CreateTeamModalProps) {
  useEscapeToClose(onClose, isOpen);
  const queryClient = useQueryClient();
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const createMutation = useCreateTeamMutation();

  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setFormError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Nazwa zespołu jest wymagana.');
      return;
    }
    setFormError(null);

    createMutation.mutate(
      { name: trimmed },
      {
        async onSuccess(team) {
          onClose();
          await queryClient.refetchQueries({ queryKey: ['teams'] });
          setActiveWorkspace(team.id);
          toast.success('Zespół utworzony');
        },
        onError(err) {
          setFormError(apiErrorMessage(err));
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
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Nowy zespół</h2>
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
            <label htmlFor="create-team-name" className="mb-1 block text-sm font-medium text-[var(--app-text)]">
              Nazwa zespołu
            </label>
            <input
              id="create-team-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Mój zespół"
              className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2"
              autoFocus
            />
          </div>
          {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Tworzenie…
              </>
            ) : (
              'Utwórz zespół'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
