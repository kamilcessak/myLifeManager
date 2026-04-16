import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  MoreHorizontal,
  Inbox,
  AlertTriangle,
  Sun,
  Sunrise,
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  Edit2,
  Trash2,
  CalendarClock,
} from 'lucide-react';
import { tasksApi, categoriesApi } from '../lib/api';
import { Task, Category } from '../types';
import { useCategories } from '../hooks/useCategories';
import { useTasks } from '../hooks/useTasks';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { patchTaskInTaskCaches, snapshotTaskCaches, restoreTaskCaches } from '../lib/workspaceTaskCache';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import AssigneeFilterToggle from './AssigneeFilterToggle';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import {
  isToday,
  isTomorrow,
  addDays,
  startOfDay,
  startOfToday,
  endOfDay,
  isBefore,
  isAfter,
  set as setDateParts,
} from 'date-fns';

interface TaskSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  className?: string;
  emptyMessage?: string;
}

interface TaskInboxProps {
  activeCategory: string | 'all' | 'none';
  onCategoryChange: (category: string | 'all' | 'none') => void;
}

export default function TaskInbox({ activeCategory, onCategoryChange }: TaskInboxProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(['completed'])
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const [overflowMenuPos, setOverflowMenuPos] = useState<{ top: number; right: number } | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const queryClient = useQueryClient();

  const { data: categoriesData } = useCategories();
  const { data: tasksData, isLoading } = useTasks({ scope: 'inbox' });

  // Toggle task completion
  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      tasksApi.update(id, { isCompleted }),
    onError: () => {
      toast.error('Nie udało się zaktualizować zadania');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const moveDeadlineToTodayMutation = useMutation({
    mutationFn: async ({ id, deadlineIso, scheduledStart, scheduledEnd }: {
      id: string;
      deadlineIso: string;
      scheduledStart?: string;
      scheduledEnd?: string;
    }) => {
      await tasksApi.update(id, { deadline: deadlineIso });
      if (scheduledStart && scheduledEnd) {
        await tasksApi.schedule(id, { scheduledStart, scheduledEnd });
      }
    },
    onError: () => {
      toast.error('Nie udało się przesunąć terminu');
    },
    onSuccess: () => {
      toast.success('Termin ustawiony na dziś');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const categories = categoriesData || [];
  const rawTasks = tasksData || [];
  const tasks = useMemo(() => {
    if (activeCategory === 'all') {
      return rawTasks;
    }

    if (activeCategory === 'none') {
      return rawTasks.filter((task) => !task.categoryId);
    }

    return rawTasks.filter((task) => task.categoryId === activeCategory || task.category?.name === activeCategory);
  }, [rawTasks, activeCategory]);

  const moveDeadlineToToday = (task: Task) => {
    if (!task.deadline) return;
    const prev = new Date(task.deadline);
    const today = startOfToday();
    const next = setDateParts(prev, {
      year: today.getFullYear(),
      month: today.getMonth(),
      date: today.getDate(),
    });

    const now = new Date();
    const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
    const scheduledStart = new Date(now);
    scheduledStart.setMinutes(roundedMinutes, 0, 0);
    if (roundedMinutes >= 60) {
      scheduledStart.setHours(scheduledStart.getHours() + 1, 0, 0, 0);
    }
    const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);

    moveDeadlineToTodayMutation.mutate({
      id: task.id,
      deadlineIso: next.toISOString(),
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
    });
  };

  const handleToggleComplete = (taskId: string, currentStatus: boolean) => {
    const nextIsCompleted = !currentStatus;
    const teamId = useWorkspaceStore.getState().activeWorkspaceId;
    const previous = snapshotTaskCaches(queryClient, teamId);

    patchTaskInTaskCaches(queryClient, teamId, taskId, { isCompleted: nextIsCompleted });

    toggleCompleteMutation.mutate(
      { id: taskId, isCompleted: nextIsCompleted },
      {
        onError: () => {
          restoreTaskCaches(queryClient, previous);
        },
      }
    );
  };

  useLayoutEffect(() => {
    if (!isMenuOpen || !menuRef.current) {
      setOverflowMenuPos(null);
      return;
    }
    const updatePosition = () => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      setOverflowMenuPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (overflowMenuRef.current?.contains(t)) return;
      setIsMenuOpen(false);
    };

    const closeOnScroll = () => setIsMenuOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const activeTab = tabRefs.current[activeCategory];
    if (!activeTab) return;

    activeTab.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeCategory]);

  // Group tasks into sections (due date by calendar day; upcoming = 7 days after tomorrow)
  const sections = useMemo((): TaskSection[] => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const tomorrow: Task[] = [];
    const upcoming: Task[] = [];
    const later: Task[] = [];
    const noDeadline: Task[] = [];
    const completed: Task[] = [];

    const todayStart = startOfToday();
    const upcomingStart = startOfDay(addDays(todayStart, 2));
    const upcomingEnd = endOfDay(addDays(todayStart, 8));

    tasks.forEach((task) => {
      if (task.isCompleted) {
        completed.push(task);
        return;
      }

      if (!task.deadline) {
        noDeadline.push(task);
        return;
      }

      const d = startOfDay(new Date(task.deadline));

      if (isBefore(d, todayStart)) {
        overdue.push(task);
      } else if (isToday(d)) {
        today.push(task);
      } else if (isTomorrow(d)) {
        tomorrow.push(task);
      } else if (!isBefore(d, upcomingStart) && !isAfter(d, upcomingEnd)) {
        upcoming.push(task);
      } else {
        later.push(task);
      }
    });

    const result: TaskSection[] = [];

    if (overdue.length > 0) {
      result.push({
        id: 'overdue',
        title: 'Opóźnione',
        icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
        tasks: overdue,
        className: 'border-l-2 border-l-red-500 pl-3',
      });
    }

    if (today.length > 0) {
      result.push({
        id: 'today',
        title: 'Dzisiaj',
        icon: <Sun className="w-4 h-4 text-amber-500" />,
        tasks: today,
        className: 'border-l-2 border-l-amber-500 pl-3',
      });
    }

    if (tomorrow.length > 0) {
      result.push({
        id: 'tomorrow',
        title: 'Jutro',
        icon: <Sunrise className="w-4 h-4 text-orange-400" />,
        tasks: tomorrow,
        className: 'border-l-2 border-l-orange-400 pl-3',
      });
    }

    if (upcoming.length > 0) {
      result.push({
        id: 'upcoming',
        title: 'Nadchodzące',
        icon: <CalendarRange className="w-4 h-4 text-cyan-500" />,
        tasks: upcoming,
        className: 'border-l-2 border-l-cyan-500 pl-3',
      });
    }

    if (later.length > 0) {
      result.push({
        id: 'later',
        title: 'Później',
        icon: <CalendarDays className="w-4 h-4 text-gray-400" />,
        tasks: later,
        className: 'border-l-2 border-l-gray-300 pl-3 dark:border-l-gray-600',
      });
    }

    if (noDeadline.length > 0) {
      result.push({
        id: 'no-deadline',
        title: 'Bez terminu',
        icon: <Inbox className="w-4 h-4 text-gray-400" />,
        tasks: noDeadline,
        className: 'border-l-2 border-l-gray-200 pl-3 dark:border-l-gray-600',
      });
    }

    if (completed.length > 0) {
      result.push({
        id: 'completed',
        title: 'Ukończone',
        icon: <Check className="w-4 h-4 text-green-500" />,
        tasks: completed,
        className: 'border-l-2 border-l-green-500 pl-3 opacity-75',
      });
    }

    return result;
  }, [tasks]);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <div className="inbox-panel">
      {/* Header */}
      <div className="inbox-header">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 app-text-muted" />
          <h2 className="font-semibold app-text">Task Inbox</h2>
          <span className="text-xs text-gray-700 bg-gray-50 px-2 py-0.5 rounded-full dark:text-gray-300 dark:bg-gray-700">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddTask}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Dodaj
          </button>
          <button
            onClick={() => setIsEventModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-900 bg-gray-50 hover:bg-white border border-gray-200 rounded-lg shadow-sm transition-colors dark:text-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
            title="Nowe wydarzenie"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--app-surface-muted)]"
            >
              <MoreHorizontal className="h-5 w-5 text-[var(--app-text-muted)]" />
            </button>
          </div>
          {isMenuOpen &&
            overflowMenuPos &&
            createPortal(
              <div
                ref={overflowMenuRef}
                className="inbox-overflow-menu fixed z-[200] w-48 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] py-1 shadow-lg"
                style={{ top: overflowMenuPos.top, right: overflowMenuPos.right }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCategoryManagerOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-muted)]"
                >
                  Zarządzaj kategoriami
                </button>
              </div>,
              document.body
            )}
        </div>
      </div>

      {/* Assignee filter (only visible in team workspaces) */}
      <div className="px-4 pb-2 flex items-center justify-end">
        <AssigneeFilterToggle />
      </div>

      {/* Category tabs */}
      <div className="inbox-tabs">
        <button
          ref={(el) => {
            tabRefs.current.all = el;
          }}
          className={cn('inbox-tab', activeCategory === 'all' && 'active')}
          onClick={() => onCategoryChange('all')}
        >
          Wszystkie
        </button>
        <button
          ref={(el) => {
            tabRefs.current.none = el;
          }}
          className={cn('inbox-tab', activeCategory === 'none' && 'active')}
          onClick={() => onCategoryChange('none')}
        >
          Brak kategorii
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            ref={(el) => {
              tabRefs.current[category.id] = el;
            }}
            className={cn('inbox-tab', activeCategory === category.id && 'active')}
            onClick={() => onCategoryChange(category.id)}
            style={{
              ...(activeCategory === category.id && {
                borderBottom: `2px solid ${category.color}`,
              }),
            }}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Task list with sections */}
      <div className="inbox-list">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="font-medium dark:text-gray-300">Brak zadań w inbox</p>
            <p className="text-sm mt-1 dark:text-gray-500">Dodaj nowe zadanie, aby rozpocząć</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.id} className={section.className}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center gap-2 w-full mb-2 group"
                >
                  <span className="flex items-center gap-2">
                    {section.icon}
                    <span className="text-sm font-semibold app-text">
                      {section.title}
                    </span>
                    <span className="text-xs text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded dark:text-gray-300 dark:bg-gray-700">
                      {section.tasks.length}
                    </span>
                  </span>
                  <span className={cn(
                    "text-gray-400 transition-transform dark:text-gray-500",
                    collapsedSections.has(section.id) ? "rotate-0" : "rotate-90"
                  )}>
                    ›
                  </span>
                </button>

                {/* Section tasks */}
                {!collapsedSections.has(section.id) && (
                  <div className="space-y-2">
                    {section.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn('flex gap-1.5', section.id === 'overdue' ? 'items-center' : 'items-stretch')}
                      >
                        <div className="min-w-0 flex-1">
                          <TaskCard
                            task={task}
                            onToggleComplete={handleToggleComplete}
                            onEdit={handleEditTask}
                          />
                        </div>
                        {section.id === 'overdue' && task.deadline ? (
                          <button
                            type="button"
                            title="Przesuń na dziś"
                            aria-label="Przesuń na dziś"
                            disabled={moveDeadlineToTodayMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveDeadlineToToday(task);
                            }}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-500/15 dark:hover:text-blue-300"
                          >
                            <CalendarClock className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Modal */}
      {isModalOpen && (
        <TaskModal
          task={editingTask}
          categories={categories}
          initialMode={editingTask ? 'view' : 'edit'}
          onTaskUpdated={(patch) =>
            setEditingTask((t) => (t && t.id === patch.id ? { ...t, ...patch } : t))
          }
          onClose={handleCloseModal}
        />
      )}
      {isEventModalOpen && (
        <EventModal
          event={null}
          initialDateRange={null}
          initialMode="edit"
          onClose={() => setIsEventModalOpen(false)}
        />
      )}
      {isCategoryManagerOpen &&
        createPortal(
          <CategoryManagerModal
            categories={categories}
            onClose={() => setIsCategoryManagerOpen(false)}
          />,
          document.body,
        )}
    </div>
  );
}

interface CategoryManagerModalProps {
  categories: Category[];
  onClose: () => void;
}

function CategoryManagerModal({ categories, onClose }: CategoryManagerModalProps) {
  useEscapeToClose(onClose);
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('#3b82f6');

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      categoriesApi.create({
        ...data,
        ...(activeWorkspaceId ? { teamId: activeWorkspaceId } : {}),
      }),
    onSuccess: () => {
      invalidateData();
      setNewName('');
      setNewColor('#3b82f6');
      toast.success('Kategoria dodana');
    },
    onError: () => toast.error('Nie udało się dodać kategorii'),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; color: string } }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      invalidateData();
      setEditingId(null);
      toast.success('Kategoria zaktualizowana');
    },
    onError: () => toast.error('Nie udało się zaktualizować kategorii'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      invalidateData();
      toast.success('Kategoria usunięta');
    },
    onError: () => toast.error('Nie udało się usunąć kategorii'),
  });

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error('Nazwa kategorii jest wymagana');
      return;
    }
    createCategoryMutation.mutate({ name: newName.trim(), color: newColor });
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
    setEditingColor(category.color);
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (!editingName.trim()) {
      toast.error('Nazwa kategorii jest wymagana');
      return;
    }
    updateCategoryMutation.mutate({
      id: editingId,
      data: { name: editingName.trim(), color: editingColor },
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="category-manager-modal modal-content animate-fade-in max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Zarządzaj kategoriami</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--app-text)]">Dodaj kategorię</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nazwa kategorii"
                className="flex-1 rounded-lg border border-[var(--app-border)] px-3 py-2 placeholder:text-[var(--app-text-muted)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--app-border)] p-1"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={createCategoryMutation.isPending}
                className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                Dodaj
              </button>
            </div>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--app-text-muted)]">Brak kategorii</p>
            ) : (
              categories.map((category) => {
                const isEditing = editingId === category.id;
                return (
                  <div
                    key={category.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--app-border)] bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.09]"
                  >
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 rounded-lg border border-[var(--app-border)] px-3 py-2 placeholder:text-[var(--app-text-muted)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="color"
                          value={editingColor}
                          onChange={(e) => setEditingColor(e.target.value)}
                          className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--app-border)] p-1"
                        />
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={updateCategoryMutation.isPending}
                          className="rounded-lg bg-blue-500 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                        >
                          Zapisz
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg px-3 py-2 text-sm text-[var(--app-text)] transition-colors hover:bg-gray-200/80 dark:hover:bg-white/12"
                        >
                          Anuluj
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="h-4 w-4 rounded-full border border-[var(--app-border)]"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="flex-1 text-sm font-medium text-[var(--app-text)]">{category.name}</span>
                        <button
                          type="button"
                          onClick={() => startEdit(category)}
                          className="rounded-lg p-2 text-[var(--app-text-muted)] transition-colors hover:bg-gray-200/80 hover:text-[var(--app-text)] dark:hover:bg-white/12"
                          title="Edytuj kategorię"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCategoryMutation.mutate(category.id)}
                          disabled={category.isDefault || deleteCategoryMutation.isPending}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-500/10 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          title={category.isDefault ? 'Domyślnej kategorii nie można usunąć' : 'Usuń kategorię'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
