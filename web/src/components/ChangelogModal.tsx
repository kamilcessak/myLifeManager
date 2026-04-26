import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { acknowledgeV13Changelog, shouldShowV13Changelog } from '@/lib/changelogV13Persistence';
import { Button } from '@/components/ui/button';

const CHANGELOG_ITEMS = [
  {
    icon: '🚀',
    text: 'Zupełnie nowy układ: Przenieśliśmy edycję zadań do wygodnego panelu bocznego, zyskując więcej miejsca na kalendarz.',
  },
  {
    icon: '📅',
    text: 'Ulepszony Kalendarz: Kafelki zadań są teraz czytelniejsze, pokazują pełny zakres godzin i pozwalają wyświetlić więcej tekstu.',
  },
  {
    icon: '📱',
    text: 'Pełna responsywność: Aplikacja działa teraz świetnie na smartfonach dzięki nowemu menu dolnemu i wysuwanym kartom zadań.',
  },
  {
    icon: '🎨',
    text: 'Odświeżony UI: Nowoczesne wybieraki dat i czasu, minimalistyczny pasek boczny oraz przejrzysty system kategorii.',
  },
  {
    icon: '🛠️',
    text: 'Szybkie planowanie: Połączyliśmy sekcje dat w jeden intuicyjny moduł z opcją "Cały dzień".',
  },
];

export default function ChangelogModal() {
  const [isOpen, setIsOpen] = useState(() => shouldShowV13Changelog());

  const dismiss = useCallback(() => {
    acknowledgeV13Changelog();
    setIsOpen(false);
  }, []);

  useEscapeToClose(dismiss, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      onClick={dismiss}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-v13-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5">
          <h2 id="changelog-v13-title" className="pr-2 text-lg font-semibold leading-snug tracking-tight">
            Wersja 1.3 – Sprawdź co się zmieniło! ✨
          </h2>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 list-none space-y-3 overflow-y-auto overscroll-contain px-5 py-4 text-sm leading-relaxed text-slate-700">
          {CHANGELOG_ITEMS.map((item) => (
            <li key={item.text} className="flex gap-3">
              <span className="shrink-0 text-lg leading-6" aria-hidden>
                {item.icon}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <Button
            type="button"
            onClick={dismiss}
            className="h-11 w-full border-0 bg-blue-500 text-base font-medium text-white shadow-sm hover:bg-blue-600"
          >
            Zrozumiałem, zaczynamy!
          </Button>
        </div>
      </div>
    </div>
  );
}
