import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckSquare,
  Loader2,
  Search,
  User as UserIcon,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PERSONAL_WORKSPACE_LABEL,
  TEAM_WORKSPACE_FALLBACK_LABEL,
  type SearchResultItem,
} from '@mlm/shared';
import { eventsApi, searchApi, tasksApi } from '../lib/api';
import { useCategories } from '../hooks/useCategories';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { Event, Task } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import AssigneeAvatar from './AssigneeAvatar';

interface WorkspaceBadgeProps {
  item: SearchResultItem;
  isForeign: boolean;
}

function getWorkspaceLabel(item: SearchResultItem): string {
  if (item.teamId === null) return PERSONAL_WORKSPACE_LABEL;
  return item.teamName ?? TEAM_WORKSPACE_FALLBACK_LABEL;
}

function WorkspaceBadge({ item, isForeign }: WorkspaceBadgeProps) {
  const isPersonal = item.teamId === null;
  const label = getWorkspaceLabel(item);
  const Icon = isPersonal ? UserIcon : Building2;

  const baseClasses =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide';
  const toneClasses = isForeign
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
    : isPersonal
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300'
    : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300';

  return (
    <span
      className={`${baseClasses} ${toneClasses}`}
      title={isForeign ? `Przełącz na: ${label}` : label}
    >
      <Icon className="h-3 w-3" />
      <span className="max-w-[8rem] truncate normal-case tracking-normal">{label}</span>
    </span>
  );
}

interface SearchBarProps {
  /** `fullWidth` — zakładka mobilna; `headerIcon` — tylko lupa w nagłówku, rozwinięcie na całą szerokość */
  variant?: 'default' | 'fullWidth' | 'headerIcon';
}

export default function SearchBar({ variant = 'default' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isOpeningItem, setIsOpeningItem] = useState(false);
  const [isHeaderSearchExpanded, setIsHeaderSearchExpanded] = useState(false);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shortcutLabel =
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
      ? 'Cmd K'
      : 'Ctrl K';

  const { data: categoriesData } = useCategories();

  const categories = categoriesData || [];

  useEffect(() => {
    if (variant !== 'headerIcon' || !isHeaderSearchExpanded) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [variant, isHeaderSearchExpanded]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const isCommandPaletteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';

      if (isCommandPaletteShortcut) {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (variant === 'headerIcon') {
          setIsHeaderSearchExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [variant]);

  useEffect(() => {
    const runSearch = async () => {
      const trimmedQuery = debouncedQuery.trim();

      if (!trimmedQuery) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await searchApi.search(trimmedQuery);
        setResults(response.data.data.results);
        setActiveIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
        setIsOpen(true);
      }
    };

    runSearch();
  }, [debouncedQuery]);

  const groupedResults = useMemo(() => {
    const tasks = results.filter((item) => item.type === 'task');
    const events = results.filter((item) => item.type === 'event');
    return { tasks, events };
  }, [results]);

  const flatResults = useMemo(
    () => [...groupedResults.tasks, ...groupedResults.events],
    [groupedResults.events, groupedResults.tasks]
  );

  const handleOpenItem = async (item: SearchResultItem) => {
    try {
      setIsOpeningItem(true);

      // If the result belongs to a different workspace, switch context first
      // so any React Query hooks inside the modal pick up the correct teamId
      // through their query keys.
      if (item.teamId !== activeWorkspaceId) {
        const targetLabel = getWorkspaceLabel(item);
        setActiveWorkspace(item.teamId);
        toast.success(`Przełączono na: ${targetLabel}`, {
          id: `workspace-switch-${item.teamId ?? 'personal'}`,
        });
      }

      if (item.type === 'task') {
        const response = await tasksApi.getById(item.id);
        const task = response.data.data.task as Task;
        setSelectedTask(task);
        setIsTaskModalOpen(true);
      } else {
        const response = await eventsApi.getById(item.id);
        const event = response.data.data.event as Event;
        setSelectedEvent(event);
        setIsEventModalOpen(true);
      }
    } catch (error) {
      console.error('Open search item error:', error);
    } finally {
      setIsOpeningItem(false);
    }

    setIsOpen(false);
    setIsHeaderSearchExpanded(false);
  };

  const handleItemClick = (item: SearchResultItem) => {
    handleOpenItem(item);
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    setIsOpen(false);
    setIsHeaderSearchExpanded(false);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && event.key === 'ArrowDown' && flatResults.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(0);
      return;
    }

    if (!isOpen) {
      return;
    }

    if (event.key === 'ArrowDown') {
      if (flatResults.length === 0) return;
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatResults.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (flatResults.length === 0) return;
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? flatResults.length - 1 : prev - 1));
      return;
    }

    if (event.key === 'Enter') {
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        event.preventDefault();
        handleOpenItem(flatResults[activeIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setIsHeaderSearchExpanded(false);
      inputRef.current?.blur();
    }
  };

  function renderResultButton(item: SearchResultItem) {
    const isActive =
      flatResults[activeIndex]?.id === item.id && flatResults[activeIndex]?.type === item.type;
    const isForeign = item.teamId !== activeWorkspaceId;

    const TypeIcon = item.type === 'task' ? CheckSquare : CalendarDays;
    const typeIconColor = item.type === 'task' ? 'text-blue-500' : 'text-purple-500';

    const baseBtnClasses =
      'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition';
    const hoverClasses = 'hover:bg-gray-100 dark:hover:bg-gray-700';
    const activeClasses = isActive ? 'bg-gray-100 dark:bg-gray-700' : '';
    const foreignClasses = isForeign
      ? 'bg-amber-50/40 ring-1 ring-amber-200/60 dark:bg-amber-500/5 dark:ring-amber-500/20'
      : '';

    return (
      <button
        key={`${item.type}-${item.id}`}
        onClick={() => handleItemClick(item)}
        className={`${baseBtnClasses} ${hoverClasses} ${activeClasses} ${foreignClasses}`}
      >
        <TypeIcon className={`mt-0.5 h-4 w-4 shrink-0 ${typeIconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-medium app-text">{item.title}</div>
            {item.assignee ? (
              <AssigneeAvatar
                assignee={{
                  id: item.assignee.id,
                  name: item.assignee.name,
                  email: item.assignee.email,
                  avatarUrl: item.assignee.avatarUrl,
                }}
                size="xs"
              />
            ) : null}
            <WorkspaceBadge item={item} isForeign={isForeign} />
          </div>
          {item.description && (
            <div className="truncate text-xs app-text-muted">{item.description}</div>
          )}
        </div>
      </button>
    );
  }

  if (variant === 'headerIcon') {
    return (
      <div ref={containerRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsHeaderSearchExpanded((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
          aria-expanded={isHeaderSearchExpanded}
          aria-label="Szukaj"
        >
          <Search className="h-5 w-5" />
        </button>

        {isHeaderSearchExpanded ? (
          <div className="search-bar-header-expand fixed inset-x-0 top-[var(--app-header-height)] z-[60] max-h-[calc(100dvh-var(--app-header-height))] overflow-y-auto border-b border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-lg">
            <div className="relative mx-auto w-full max-w-3xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 app-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setIsOpen(true)}
                placeholder="Szukaj zadań i wydarzeń..."
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] py-2.5 pl-10 pr-12 text-sm text-[var(--app-text)] outline-none transition focus:border-blue-400 focus:bg-[var(--app-surface)] focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
              />
              {query.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 app-text-muted transition hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
                  aria-label="Wyczyść wyszukiwarkę"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {isOpen ? (
              <div className="mx-auto mt-2 max-h-[min(70vh,28rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-lg">
                {isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-sm app-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Szukam...</span>
                  </div>
                ) : !debouncedQuery.trim() ? (
                  <div className="px-3 py-4 text-sm app-text-muted">
                    <p className="font-medium app-text">Zacznij wpisywać, aby wyszukać</p>
                  </div>
                ) : results.length === 0 && debouncedQuery.trim() ? (
                  <div className="px-3 py-4 text-sm app-text-muted">Nie znaleziono</div>
                ) : (
                  <div className="space-y-2">
                    {groupedResults.tasks.length > 0 && (
                      <div>
                        <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide app-text-muted">
                          Zadania
                        </div>
                        <div className="space-y-1">{groupedResults.tasks.map((item) => renderResultButton(item))}</div>
                      </div>
                    )}
                    {groupedResults.events.length > 0 && (
                      <div>
                        <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide app-text-muted">
                          Wydarzenia
                        </div>
                        <div className="space-y-1">{groupedResults.events.map((item) => renderResultButton(item))}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {isOpeningItem && (
          <div className="pointer-events-none absolute inset-x-0 -bottom-10 flex justify-center">
            <div className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-xs app-text-muted shadow">
              Otwieram element...
            </div>
          </div>
        )}

        {isTaskModalOpen && selectedTask && (
          <TaskModal
            task={selectedTask}
            categories={categories}
            initialMode="view"
            onTaskUpdated={(patch) =>
              setSelectedTask((t) => (t && t.id === patch.id ? { ...t, ...patch } : t))
            }
            onClose={() => {
              setIsTaskModalOpen(false);
              setSelectedTask(null);
            }}
          />
        )}

        {isEventModalOpen && selectedEvent && (
          <EventModal
            event={selectedEvent}
            initialDateRange={null}
            initialMode="view"
            onClose={() => {
              setIsEventModalOpen(false);
              setSelectedEvent(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={variant === 'fullWidth' ? 'relative w-full max-w-none' : 'relative w-full max-w-xl'}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 app-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            setIsOpen(true);
          }}
          placeholder="Szukaj zadań i wydarzeń..."
          className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] py-2 pl-10 pr-24 text-sm text-[var(--app-text)] outline-none transition focus:border-blue-400 focus:bg-[var(--app-surface)] focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
        />
        {query.trim().length > 0 && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-14 top-1/2 -translate-y-1/2 rounded-md p-1 app-text-muted transition hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
            aria-label="Wyczyść wyszukiwarkę"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {variant === 'default' ? (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5 text-[10px] app-text-muted shadow-sm">
            {shortcutLabel}
          </kbd>
        ) : null}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-lg">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm app-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Szukam...</span>
            </div>
          ) : !debouncedQuery.trim() ? (
            <div className="px-3 py-4 text-sm app-text-muted">
              <p className="font-medium app-text">Zacznij wpisywać, aby wyszukać</p>
              <p className="mt-1 text-xs app-text-muted">
                Możesz użyć strzałek, Enter oraz Esc do nawigacji.
              </p>
            </div>
          ) : results.length === 0 && debouncedQuery.trim() ? (
            <div className="px-3 py-4 text-sm app-text-muted">Nie znaleziono</div>
          ) : (
            <div className="space-y-2">
              {groupedResults.tasks.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide app-text-muted">
                    Zadania
                  </div>
                  <div className="space-y-1">
                    {groupedResults.tasks.map((item) => renderResultButton(item))}
                  </div>
                </div>
              )}

              {groupedResults.events.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide app-text-muted">
                    Wydarzenia
                  </div>
                  <div className="space-y-1">
                    {groupedResults.events.map((item) => renderResultButton(item))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isOpeningItem && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-10 flex justify-center">
          <div className="rounded-full bg-[var(--app-surface)] px-3 py-1 text-xs app-text-muted shadow border border-[var(--app-border)]">
            Otwieram element...
          </div>
        </div>
      )}

      {isTaskModalOpen && selectedTask && (
        <TaskModal
          task={selectedTask}
          categories={categories}
          initialMode="view"
          onTaskUpdated={(patch) =>
            setSelectedTask((t) => (t && t.id === patch.id ? { ...t, ...patch } : t))
          }
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
        />
      )}

      {isEventModalOpen && selectedEvent && (
        <EventModal
          event={selectedEvent}
          initialDateRange={null}
          initialMode="view"
          onClose={() => {
            setIsEventModalOpen(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}
