import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckSquare, Loader2, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { categoriesApi, eventsApi, searchApi, tasksApi } from '../lib/api';
import { Category, Event, SearchResult, Task } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import TaskModal from './TaskModal';
import EventModal from './EventModal';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isOpeningItem, setIsOpeningItem] = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shortcutLabel =
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
      ? 'Cmd K'
      : 'Ctrl K';

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return response.data.data.categories as Category[];
    },
  });

  const categories = categoriesData || [];

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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleOpenItem = async (item: SearchResult) => {
    console.log('Kliknięto element:', item.id);

    try {
      setIsOpeningItem(true);
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
  };

  const handleItemClick = (item: SearchResult) => {
    handleOpenItem(item);
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    setIsOpen(false);
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
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
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
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5 text-[10px] app-text-muted shadow-sm">
          {shortcutLabel}
        </kbd>
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
                    {groupedResults.tasks.map((item) => (
                      <button
                        key={`task-${item.id}`}
                        onClick={() => handleItemClick(item)}
                        className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          flatResults[activeIndex]?.id === item.id && flatResults[activeIndex]?.type === item.type
                            ? 'bg-gray-100 dark:bg-gray-700'
                            : ''
                        }`}
                      >
                        <CheckSquare className="mt-0.5 h-4 w-4 text-blue-500" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium app-text">{item.title}</div>
                          {item.description && (
                            <div className="truncate text-xs app-text-muted">{item.description}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {groupedResults.events.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide app-text-muted">
                    Wydarzenia
                  </div>
                  <div className="space-y-1">
                    {groupedResults.events.map((item) => (
                      <button
                        key={`event-${item.id}`}
                        onClick={() => handleItemClick(item)}
                        className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          flatResults[activeIndex]?.id === item.id && flatResults[activeIndex]?.type === item.type
                            ? 'bg-gray-100 dark:bg-gray-700'
                            : ''
                        }`}
                      >
                        <CalendarDays className="mt-0.5 h-4 w-4 text-purple-500" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium app-text">{item.title}</div>
                          {item.description && (
                            <div className="truncate text-xs app-text-muted">{item.description}</div>
                          )}
                        </div>
                      </button>
                    ))}
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
