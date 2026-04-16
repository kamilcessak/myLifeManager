import { useEffect, useState } from 'react';
import { AlertTriangle, Download, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { clearClientSession } from '../../../lib/clearClientSession';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { useAuthStore } from '../../../store/authStore';
import { useDeleteAccount } from '../../../hooks/useDeleteAccount';
import { useExportData } from '../../../hooks/useExportData';

const CONFIRM_PHRASE = 'USUŃ';

export default function AccountTab() {
  const exportData = useExportData();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleExport = (): void => {
    exportData.mutate(undefined, {
      onSuccess: () => {
        toast.success('Pobieranie danych rozpoczęte');
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error));
      },
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-[var(--app-text)]">
          Twoje dane (RODO)
        </h3>
        <p className="mb-3 text-xs text-[var(--app-text-muted)]">
          Pobierz kopię swoich osobistych danych: zadania, wydarzenia i kategorie,
          które nie należą do żadnego zespołu. Plik zostanie zapisany w formacie JSON.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={exportData.isPending}
          className="gap-2"
        >
          {exportData.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Przygotowywanie…
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Pobierz moje dane
            </>
          )}
        </Button>
      </section>

      <div className="h-px bg-[var(--app-border)]" />

      <section className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          Strefa niebezpieczna
        </h3>
        <p className="mb-3 text-xs text-red-700/80 dark:text-red-200/80">
          Usunięcie konta jest nieodwracalne. Stracisz dostęp do wszystkich swoich
          osobistych zadań, wydarzeń oraz kategorii. Jeżeli jesteś jedynym
          właścicielem zespołu z innymi członkami, musisz najpierw przekazać
          własność lub usunąć ten zespół.
        </p>
        <Button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          className="gap-2 border-0 bg-red-600 text-white shadow-sm hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Usuń konto
        </Button>
      </section>

      <DeleteAccountConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation sub-modal
// ---------------------------------------------------------------------------

interface DeleteAccountConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function DeleteAccountConfirmModal({
  isOpen,
  onClose,
}: DeleteAccountConfirmModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const logout = useAuthStore((s) => s.logout);
  const deleteAccount = useDeleteAccount();

  useEscapeToClose(onClose, isOpen && !deleteAccount.isPending);

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setServerError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const phraseMatches = confirmInput.trim().toUpperCase() === CONFIRM_PHRASE;
  const canConfirm = phraseMatches && !deleteAccount.isPending;

  const handleClose = (): void => {
    if (deleteAccount.isPending) return;
    onClose();
  };

  const handleConfirm = (): void => {
    if (!canConfirm) return;
    setServerError(null);

    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        logout();
        clearClientSession();
        // Hard redirect ensures any in-memory caches, listeners, service
        // workers, etc. are dropped along with the deleted session.
        window.location.href = '/login';
      },
      onError: (error) => {
        const message = getApiErrorMessage(error);
        setServerError(message);
        toast.error(message);
      },
    });
  };

  return (
    <div
      className="modal-overlay z-[70]"
      onClick={handleClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="modal-content max-w-md animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[var(--app-border)] px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3
              id="delete-account-title"
              className="text-base font-semibold text-[var(--app-text)]"
            >
              Usuń konto na stałe
            </h3>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Tej operacji nie da się cofnąć.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-[var(--app-text)]">
            Wpisz <span className="font-semibold">{CONFIRM_PHRASE}</span>, aby potwierdzić
            trwałe usunięcie konta oraz wszystkich powiązanych danych osobistych.
          </p>

          <input
            type="text"
            value={confirmInput}
            onChange={(e) => {
              setConfirmInput(e.target.value);
              if (serverError) setServerError(null);
            }}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            autoFocus
            disabled={deleteAccount.isPending}
            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-mono uppercase text-[var(--app-text)] outline-none ring-red-500/30 focus:border-red-500 focus:ring-2 disabled:opacity-60"
            aria-describedby={serverError ? 'delete-account-error' : undefined}
          />

          {serverError ? (
            <div
              id="delete-account-error"
              role="alert"
              className="rounded-md border-2 border-red-400 bg-red-50 p-3 text-sm font-medium text-red-800 shadow-sm dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-200"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{serverError}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--app-border)] px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={deleteAccount.isPending}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="gap-2 border-0 bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleteAccount.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Usuwanie…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Usuń konto na stałe
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
