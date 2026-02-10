import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreHorizontal, Inbox, AlertTriangle, Sun, Sunrise, Calendar, CalendarDays, Check } from 'lucide-react';
import { tasksApi, categoriesApi } from '../lib/api';
import { Task, Category } from '../types';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { isToday, isTomorrow, isPast, isThisWeek, startOfDay, endOfWeek, isAfter } from 'date-fns';

interface TaskSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  className?: string;
  emptyMessage?: string;
}

export default function TaskInbox() {
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

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
    queryKey: ['inbox-tasks', activeCategory],
    queryFn: async () => {
      const response = await tasksApi.getInbox(
        activeCategory === 'all' ? undefined : activeCategory
      );
      return response.data.data.tasks as Task[];
    },
  });

  // Toggle task completion
  const toggleCompleteMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      tasksApi.update(id, { isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
    },
    onError: () => {
      toast.error('Nie udało się zaktualizować zadania');
    },
  });

  const categories = categoriesData || [];
  const tasks = tasksData || [];

  // Group tasks into sections
  const sections = useMemo((): TaskSection[] => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

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
        <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <MoreHorizontal className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="inbox-tabs">
        <button
          className={cn('inbox-tab', activeCategory === 'all' && 'active')}
          onClick={() => setActiveCategory('all')}
        >
          Wszystkie
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            className={cn('inbox-tab', activeCategory === category.id && 'active')}
            onClick={() => setActiveCategory(category.id)}
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
                        onToggleComplete={(id, isCompleted) =>
                          toggleCompleteMutation.mutate({ id, isCompleted })
                        }
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

      {/* Add task button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleAddTask}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nowe zadanie
        </button>
      </div>

      {/* Task Modal */}
      {isModalOpen && (
        <TaskModal
          task={editingTask}
          categories={categories}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
