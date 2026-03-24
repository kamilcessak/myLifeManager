import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreHorizontal, Inbox, AlertTriangle, Sun, Sunrise, Calendar, CalendarDays, Check, Edit2, Trash2 } from 'lucide-react';
import { tasksApi, categoriesApi } from '../lib/api';
import { Task, Category } from '../types';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { isToday, isTomorrow, isPast, isThisWeek } from 'date-fns';

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
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return response.data.data.categories as Category[];
    },
  });

  // Fetch inbox tasks
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['inbox-tasks'],
    queryFn: async () => {
      const response = await tasksApi.getInbox();
      return response.data.data.tasks as Task[];
    },
  });

  // Toggle task completion
  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      tasksApi.update(id, { isCompleted }),
    onError: () => {
      toast.error('Nie udało się zaktualizować zadania');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
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

  const handleToggleComplete = (taskId: string, currentStatus: boolean) => {
    const nextIsCompleted = !currentStatus;
    const previousInboxTasks = queryClient.getQueryData<Task[]>(['inbox-tasks']);
    const previousCalendarItems = queryClient.getQueriesData({ queryKey: ['calendar-items'] });

    queryClient.setQueryData<Task[]>(['inbox-tasks'], (old = []) =>
      old.map((task) => (
        task.id === taskId
          ? {
              ...task,
              isCompleted: nextIsCompleted,
            }
          : task
      ))
    );

    queryClient.setQueriesData({ queryKey: ['calendar-items'] }, (oldData: any) => {
      if (!Array.isArray(oldData)) {
        return oldData;
      }

      return oldData.map((item: any) => {
        if (item?.type !== 'task' || item?.data?.id !== taskId) {
          return item;
        }

        return {
          ...item,
          data: {
            ...item.data,
            isCompleted: nextIsCompleted,
          },
          classNames: ['fc-event-task', nextIsCompleted ? 'fc-event-task-completed' : ''].filter(Boolean),
        };
      });
    });

    toggleCompleteMutation.mutate(
      { id: taskId, isCompleted: nextIsCompleted },
      {
        onError: () => {
          queryClient.setQueryData(['inbox-tasks'], previousInboxTasks || []);
          previousCalendarItems.forEach(([queryKey, queryData]) => {
            queryClient.setQueryData(queryKey, queryData);
          });
        },
      }
    );
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  // Group tasks into sections
  const sections = useMemo((): TaskSection[] => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const tomorrow: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];
    const noDeadline: Task[] = [];
    const completed: Task[] = [];

    tasks.forEach((task) => {
      if (task.isCompleted) {
        completed.push(task);
        return;
      }

      if (!task.deadline) {
        noDeadline.push(task);
        return;
      }

      const deadlineDate = new Date(task.deadline);

      if (isToday(deadlineDate)) {
        today.push(task);
      } else if (isPast(deadlineDate)) {
        overdue.push(task);
      } else if (isTomorrow(deadlineDate)) {
        tomorrow.push(task);
      } else if (isThisWeek(deadlineDate, { weekStartsOn: 1 })) {
        thisWeek.push(task);
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

    if (thisWeek.length > 0) {
      result.push({
        id: 'this-week',
        title: 'Ten tydzień',
        icon: <Calendar className="w-4 h-4 text-blue-500" />,
        tasks: thisWeek,
        className: 'border-l-2 border-l-blue-500 pl-3',
      });
    }

    if (later.length > 0) {
      result.push({
        id: 'later',
        title: 'Później',
        icon: <CalendarDays className="w-4 h-4 text-gray-400" />,
        tasks: later,
        className: 'border-l-2 border-l-gray-300 pl-3',
      });
    }

    if (noDeadline.length > 0) {
      result.push({
        id: 'no-deadline',
        title: 'Bez terminu',
        icon: <Inbox className="w-4 h-4 text-gray-400" />,
        tasks: noDeadline,
        className: 'border-l-2 border-l-gray-200 pl-3',
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
          <Inbox className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Task Inbox</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
            title="Nowe wydarzenie"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-5 h-5 text-gray-500" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 top-10 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsCategoryManagerOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zarządzaj kategoriami
                </button>
              </div>
            )}
          </div>
        </div>
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
          <div className="text-center py-8 text-gray-500">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Brak zadań w inbox</p>
            <p className="text-sm mt-1">Dodaj nowe zadanie, aby rozpocząć</p>
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
                    <span className="text-sm font-semibold text-gray-700">
                      {section.title}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {section.tasks.length}
                    </span>
                  </span>
                  <span className={cn(
                    "text-gray-400 transition-transform",
                    collapsedSections.has(section.id) ? "rotate-0" : "rotate-90"
                  )}>
                    ›
                  </span>
                </button>

                {/* Section tasks */}
                {!collapsedSections.has(section.id) && (
                  <div className="space-y-2">
                    {section.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggleComplete={handleToggleComplete}
                        onEdit={handleEditTask}
                      />
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
      {isCategoryManagerOpen && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      )}
    </div>
  );
}

interface CategoryManagerModalProps {
  categories: Category[];
  onClose: () => void;
}

function CategoryManagerModal({ categories, onClose }: CategoryManagerModalProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('#3b82f6');

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
  };

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) => categoriesApi.create(data),
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
      <div className="modal-content animate-fade-in max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Zarządzaj kategoriami</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <span className="text-gray-500 text-lg leading-none">×</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Dodaj kategorię</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nazwa kategorii"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-12 h-10 p-1 border border-gray-300 rounded-lg cursor-pointer bg-white"
              />
              <button
                onClick={handleCreate}
                disabled={createCategoryMutation.isPending}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Dodaj
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Brak kategorii</p>
            ) : (
              categories.map((category) => {
                const isEditing = editingId === category.id;
                return (
                  <div
                    key={category.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white"
                  >
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="color"
                          value={editingColor}
                          onChange={(e) => setEditingColor(e.target.value)}
                          className="w-12 h-10 p-1 border border-gray-300 rounded-lg cursor-pointer bg-white"
                        />
                        <button
                          onClick={saveEdit}
                          disabled={updateCategoryMutation.isPending}
                          className="px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          Zapisz
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Anuluj
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-4 h-4 rounded-full border border-gray-200"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="flex-1 text-sm font-medium text-gray-800">{category.name}</span>
                        <button
                          onClick={() => startEdit(category)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edytuj kategorię"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteCategoryMutation.mutate(category.id)}
                          disabled={category.isDefault || deleteCategoryMutation.isPending}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
