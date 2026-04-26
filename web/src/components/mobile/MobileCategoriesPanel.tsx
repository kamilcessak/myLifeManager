import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, FolderPlus, LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { categoriesApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useCategories } from '../../hooks/useCategories';
import { useCalendarUiStore } from '../../store/useCalendarUiStore';
import { useCategoryFilterStore } from '../../store/useCategoryFilterStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

const DEFAULT_CATEGORY_COLOR = '#3b82f6';

export default function MobileCategoriesPanel() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeCategoryFilter = useCategoryFilterStore((s) => s.activeCategoryFilter);
  const setActiveCategoryFilter = useCategoryFilterStore((s) => s.setActiveCategoryFilter);
  const requestToday = useCalendarUiStore((s) => s.requestToday);
  const { data: categoriesData, isLoading: isLoadingCategories } = useCategories();
  const queryClient = useQueryClient();

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_CATEGORY_COLOR);

  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      categoriesApi.create({
        ...data,
        ...(activeWorkspaceId ? { teamId: activeWorkspaceId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setNewCategoryName('');
      setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
      setIsAddingCategory(false);
      toast.success('Kategoria dodana');
    },
    onError: () => toast.error('Nie udało się dodać kategorii'),
  });

  const handleCreateCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Nazwa kategorii jest wymagana');
      return;
    }
    createCategoryMutation.mutate({ name, color: newCategoryColor });
  };

  return (
    <div className="mobile-categories-panel flex h-full min-h-0 flex-col overflow-hidden bg-[var(--app-bg)]">
      <div className="shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--app-text)]">Kategorie</h2>
        <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">Filtruj kalendarz i inbox</p>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 text-sm">
        <section className="space-y-1">
          <h3 className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
            Nawigacja
          </h3>
          <CategoryRow
            active={activeCategoryFilter === 'all'}
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Wszystkie"
            onClick={() => setActiveCategoryFilter('all')}
          />
          <button
            type="button"
            onClick={requestToday}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] active:bg-[var(--app-surface-muted)]"
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Przejdź do dzisiaj (kalendarz)</span>
          </button>
        </section>

        <section className="space-y-1">
          <h3 className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
            Twoje kategorie
          </h3>
          {isLoadingCategories ? (
            <div className="px-3 py-2 text-sm text-[var(--app-text-muted)]">Ładowanie kategorii…</div>
          ) : categories.length > 0 ? (
            categories.map((category) => (
              <CategoryRow
                key={category.id}
                active={activeCategoryFilter === category.id}
                dotColor={category.color}
                label={category.name}
                onClick={() => setActiveCategoryFilter(category.id)}
              />
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-[var(--app-text-muted)]">Brak kategorii</div>
          )}
          <CategoryRow
            active={activeCategoryFilter === 'none'}
            dotColor="#cbd5e1"
            label="Bez kategorii"
            onClick={() => setActiveCategoryFilter('none')}
          />

          {isAddingCategory ? (
            <form onSubmit={handleCreateCategory} className="space-y-2 rounded-lg bg-[var(--app-surface-muted)] p-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nazwa kategorii"
                className="h-10 w-full rounded-md border border-[var(--app-border)] bg-white px-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-700 dark:text-gray-100"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  className="h-10 w-11 shrink-0 cursor-pointer rounded-md border border-[var(--app-border)] bg-transparent p-1"
                  aria-label="Kolor kategorii"
                />
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending}
                  className="h-10 flex-1 rounded-md bg-blue-500 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Dodaj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryName('');
                  }}
                  className="h-10 rounded-md px-2 text-sm text-[var(--app-text-muted)] transition-colors hover:bg-white hover:text-[var(--app-text)] dark:hover:bg-gray-700"
                >
                  Anuluj
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingCategory(true)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
            >
              <FolderPlus className="h-4 w-4 shrink-0" />
              <span>Dodaj kategorię</span>
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function CategoryRow({
  active,
  icon,
  label,
  dotColor,
  onClick,
}: {
  active: boolean;
  icon?: ReactNode;
  label: string;
  dotColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
        active
          ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
          : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]',
      )}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor ?? '#cbd5e1' }}
          aria-hidden
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
