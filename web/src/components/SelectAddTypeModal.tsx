import { CheckSquare, Calendar } from 'lucide-react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

export type CalendarSlotSelection = {
  start: Date;
  end: Date;
  allDay: boolean;
};

type SelectAddTypeModalProps = {
  selection: CalendarSlotSelection;
  onClose: () => void;
  onChooseTask: (selection: CalendarSlotSelection) => void;
  onChooseEvent: (selection: CalendarSlotSelection) => void;
};

export default function SelectAddTypeModal({
  selection,
  onClose,
  onChooseTask,
  onChooseEvent,
}: SelectAddTypeModalProps) {
  useEscapeToClose(onClose);

  return (
    <div className="modal-overlay z-[120]" onClick={onClose}>
      <div
        className="modal-content animate-fade-in max-w-md w-[min(100%,22rem)] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="select-add-type-title"
      >
        <h2
          id="select-add-type-title"
          className="text-center text-lg font-semibold text-[var(--app-text)] mb-1"
        >
          Co chcesz dodać?
        </h2>
        <p className="text-center text-sm text-[var(--app-text-muted)] mb-6">
          {selection.allDay
            ? 'Wybrany zakres całodniowy'
            : `${selection.start.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })} – ${selection.end.toLocaleString('pl-PL', { timeStyle: 'short' })}`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChooseTask(selection)}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-8 transition-all hover:border-blue-400 hover:bg-blue-50/80 dark:border-gray-600 dark:bg-gray-800/80 dark:hover:border-blue-500 dark:hover:bg-blue-500/10"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-md">
              <CheckSquare className="h-7 w-7" strokeWidth={2} />
            </span>
            <span className="text-base font-semibold text-[var(--app-text)]">Zadanie</span>
          </button>
          <button
            type="button"
            onClick={() => onChooseEvent(selection)}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-8 transition-all hover:border-emerald-400 hover:bg-emerald-50/80 dark:border-gray-600 dark:bg-gray-800/80 dark:hover:border-emerald-500 dark:hover:bg-emerald-500/10"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
              <Calendar className="h-7 w-7" strokeWidth={2} />
            </span>
            <span className="text-base font-semibold text-[var(--app-text)]">Wydarzenie</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-[var(--app-border)] py-2.5 text-sm font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
