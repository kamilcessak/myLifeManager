import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  FolderPlus,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { categoriesApi } from '../lib/api';
import { cn } from '../lib/utils';
import { useCategories } from '../hooks/useCategories';
import { useCalendarUiStore } from '../store/useCalendarUiStore';
import { useCategoryFilterStore } from '../store/useCategoryFilterStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

const DEFAULT_CATEGORY_COLOR = '#3b82f6';

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function AppSidebar({ isCollapsed, onToggleCollapse }: AppSidebarProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeCategoryFilter = useCategoryFilterStore((s) => s.activeCategoryFilter);
  const setActiveCategoryFilter = useCategoryFilterStore((s) => s.setActiveCategoryFilter);
  const requestCreateTask = useCalendarUiStore((s) => s.requestCreateTask);
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
    <aside className={cn('app-sidebar', isCollapsed && 'app-sidebar-collapsed')}>
      <div
        className={cn(
          'border-b border-[var(--app-border)] p-3',
          isCollapsed ? 'flex flex-col gap-2 px-2' : 'flex flex-row items-center gap-2',
        )}
      >
        {isCollapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              aria-label="Pokaż lewy pasek"
              title="Pokaż lewy pasek"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
            aria-label="Schowaj lewy pasek"
            title="Schowaj lewy pasek"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={requestCreateTask}
          className={cn(
            'flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg bg-blue-500 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30',
            isCollapsed ? 'w-full px-0' : 'flex-1 px-3',
          )}
          aria-label="Dodaj zadanie"
          title="Dodaj zadanie"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!isCollapsed ? <span className="truncate">Dodaj zadanie</span> : null}
        </button>
      </div>

      <nav className={cn('min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-4 text-sm', isCollapsed && 'px-2')}>
        <SidebarSection title="Nawigacja" collapsed={isCollapsed}>
          <SidebarButton
            active={activeCategoryFilter === 'all'}
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Wszystkie"
            onClick={() => setActiveCategoryFilter('all')}
            collapsed={isCollapsed}
          />
          <button
            type="button"
            onClick={requestToday}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]',
              isCollapsed && 'justify-center px-0',
            )}
            aria-label="Dzisiaj"
            title="Dzisiaj"
          >
            <CalendarDays className="h-4 w-4" />
            {!isCollapsed ? <span className="min-w-0 flex-1 truncate">Dzisiaj</span> : null}
          </button>
        </SidebarSection>

        <SidebarSection title="Kategorie" collapsed={isCollapsed}>
          {isLoadingCategories ? (
            <div className="px-3 py-2 text-sm text-[var(--app-text-muted)]">
              {isCollapsed ? '...' : 'Ładowanie kategorii...'}
            </div>
          ) : categories.length > 0 ? (
            categories.map((category) => (
              <SidebarButton
                key={category.id}
                active={activeCategoryFilter === category.id}
                label={category.name}
                onClick={() => setActiveCategoryFilter(category.id)}
                color={category.color}
                collapsed={isCollapsed}
              />
            ))
          ) : (
            !isCollapsed ? (
              <div className="px-3 py-2 text-sm text-[var(--app-text-muted)]">Brak kategorii</div>
            ) : null
          )}

          <SidebarButton
            active={activeCategoryFilter === 'none'}
            label="Bez kategorii"
            onClick={() => setActiveCategoryFilter('none')}
            color="#cbd5e1"
            collapsed={isCollapsed}
          />

          {isAddingCategory && !isCollapsed ? (
            <form onSubmit={handleCreateCategory} className="space-y-2 rounded-lg bg-[var(--app-surface-muted)] p-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Nazwa kategorii"
                className="h-9 w-full rounded-md border border-[var(--app-border)] bg-white px-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-gray-700 dark:text-gray-100"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(event) => setNewCategoryColor(event.target.value)}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-[var(--app-border)] bg-transparent p-1"
                  aria-label="Kolor kategorii"
                />
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending}
                  className="h-9 flex-1 rounded-md bg-blue-500 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Dodaj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryName('');
                  }}
                  className="h-9 rounded-md px-2 text-sm text-[var(--app-text-muted)] transition-colors hover:bg-white hover:text-[var(--app-text)] dark:hover:bg-gray-700"
                >
                  Anuluj
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isCollapsed) {
                  onToggleCollapse();
                }
                setIsAddingCategory(true);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]',
                isCollapsed && 'justify-center px-0',
              )}
              aria-label="Dodaj kategorię"
              title="Dodaj kategorię"
            >
              <FolderPlus className="h-4 w-4" />
              {!isCollapsed ? <span>+ Dodaj kategorię</span> : null}
            </button>
          )}
        </SidebarSection>
      </nav>
    </aside>
  );
}

function SidebarSection({
  title,
  children,
  collapsed = false,
}: {
  title: string;
  children: ReactNode;
  collapsed?: boolean;
}) {
  return (
    <section className="space-y-1">
      {!collapsed ? (
        <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
          {title}
        </h2>
      ) : null}
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function SidebarButton({
  active,
  icon,
  label,
  color,
  onClick,
  collapsed = false,
}: {
  active: boolean;
  icon?: ReactNode;
  label: string;
  color?: string;
  onClick: () => void;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick()}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        collapsed && 'justify-center px-0',
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
          style={{ backgroundColor: color ?? '#cbd5e1' }}
          aria-hidden="true"
        />
      )}
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
    </button>
  );
}
