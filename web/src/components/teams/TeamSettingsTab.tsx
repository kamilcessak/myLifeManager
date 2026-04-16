import { useEffect, useState } from 'react';
import { Loader2, Save, Trash2, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  useDeleteTeamMutation,
  useUpdateTeamMutation,
  type TeamListItem,
} from '../../hooks/useTeams';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { getApiErrorMessage } from '@/lib/apiErrors';
import ConfirmDialog from './ConfirmDialog';

interface TeamSettingsTabProps {
  team: TeamListItem;
  isOwner: boolean;
  onDeleted: () => void;
}

export default function TeamSettingsTab({ team, isOwner, onDeleted }: TeamSettingsTabProps) {
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const updateMutation = useUpdateTeamMutation();
  const deleteMutation = useDeleteTeamMutation();

  const [name, setName] = useState(team.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    setName(team.name);
  }, [team.id, team.name]);

  if (!isOwner) {
    return (
      <p className="text-sm text-[var(--app-text-muted)]">
        Tylko właściciel zespołu ma dostęp do ustawień.
      </p>
    );
  }

  const dirty = name.trim() !== team.name && name.trim().length >= 2;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError('Nazwa zespołu musi mieć co najmniej 2 znaki.');
      return;
    }
    setNameError(null);
    updateMutation.mutate(
      { teamId: team.id, name: trimmed },
      {
        onSuccess: () => toast.success('Zapisano nazwę zespołu'),
        onError: (err) => setNameError(getApiErrorMessage(err)),
      },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { teamId: team.id },
      {
        onSuccess: () => {
          toast.success('Zespół został usunięty');
          setShowDeleteDialog(false);
          setActiveWorkspace(null);
          onDeleted();
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label
            htmlFor="team-name-input"
            className="mb-1 block text-sm font-medium text-[var(--app-text)]"
          >
            Nazwa zespołu
          </label>
          <input
            id="team-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2"
          />
          {nameError ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!dirty || updateMutation.isPending}
            className="border-0 bg-blue-500 text-white shadow-sm hover:bg-blue-600"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Zapisywanie…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Zapisz
              </>
            )}
          </Button>
        </div>
      </form>

      <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <TriangleAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Strefa niebezpieczna</h3>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Usunięcie zespołu jest nieodwracalne. Wszystkie zadania, wydarzenia, kategorie oraz
              zaproszenia tego zespołu zostaną trwale usunięte dla wszystkich członków.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                onClick={() => {
                  setConfirmText('');
                  setShowDeleteDialog(true);
                }}
                className="border-0 bg-red-600 text-white shadow-sm hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Usuń zespół
              </Button>
            </div>
          </div>
        </div>
      </section>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Usuń zespół"
        description={`Ta operacja jest nieodwracalna. Aby potwierdzić, wpisz dokładną nazwę zespołu: „${team.name}”.`}
        confirmLabel="Usuń zespół"
        tone="danger"
        isLoading={deleteMutation.isPending}
        disableConfirm={confirmText.trim() !== team.name}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
      >
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={team.name}
          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none ring-red-500/30 focus:border-red-500 focus:ring-2"
          autoFocus
        />
      </ConfirmDialog>
    </div>
  );
}
