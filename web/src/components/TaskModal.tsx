import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calendar, Clock, Flag, Trash2, CalendarCheck } from 'lucide-react';
import { Task, Category } from '../types';
import { tasksApi } from '../lib/api';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { format, addHours, startOfHour, startOfDay, endOfDay } from 'date-fns';

interface TaskModalProps {
  task: Task | null;
  categories: Category[];
  onClose: () => void;
}

export default function TaskModal({ task, categories, onClose }: TaskModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!task;

  // Determine if task is already on calendar
  const isOnCalendar = !!task?.scheduledStart;
  const isAllDay = !!task?.scheduledAllDay;

  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    categoryId: task?.categoryId || '',
    priority: task?.priority || 2,
    deadline: task?.deadline ? format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
    showOnCalendar: isOnCalendar,
    scheduledAllDay: isAllDay,
    scheduledDate: task?.scheduledStart
      ? format(new Date(task.scheduledStart), 'yyyy-MM-dd')
      : format(addHours(new Date(), 24), 'yyyy-MM-dd'),
    scheduledStart: task?.scheduledStart
      ? format(new Date(task.scheduledStart), "yyyy-MM-dd'T'HH:mm")
      : format(startOfHour(addHours(new Date(), 1)), "yyyy-MM-dd'T'HH:mm"),
    scheduledEnd: task?.scheduledEnd
      ? format(new Date(task.scheduledEnd), "yyyy-MM-dd'T'HH:mm")
      : format(startOfHour(addHours(new Date(), 2)), "yyyy-MM-dd'T'HH:mm"),
  });

  // Auto-enable calendar when deadline is set
  useEffect(() => {
    if (formData.deadline && !formData.showOnCalendar && !isEditing) {
      // When deadline is set, suggest showing on calendar at that time
      const deadlineDate = new Date(formData.deadline);
      setFormData(prev => ({
        ...prev,
        showOnCalendar: true,
        scheduledStart: format(deadlineDate, "yyyy-MM-dd'T'HH:mm"),
        scheduledEnd: format(addHours(deadlineDate, 1), "yyyy-MM-dd'T'HH:mm"),
      }));
    }
  }, [formData.deadline, isEditing]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const payload: any = {
        title: data.title,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        priority: data.priority,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined,
      };

      // Add calendar scheduling if enabled
      if (data.showOnCalendar) {
        if (data.scheduledAllDay && data.scheduledDate) {
          const d = new Date(data.scheduledDate);
          payload.scheduledStart = startOfDay(d).toISOString();
          payload.scheduledEnd = endOfDay(d).toISOString();
          payload.scheduledAllDay = true;
        } else if (data.scheduledStart && data.scheduledEnd) {
          payload.scheduledStart = new Date(data.scheduledStart).toISOString();
          payload.scheduledEnd = new Date(data.scheduledEnd).toISOString();
          payload.scheduledAllDay = false;
        }
      }

      return tasksApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
      toast.success('Zadanie utworzone');
      onClose();
    },
    onError: () => {
      toast.error('Nie udało się utworzyć zadania');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const payload: any = {
        title: data.title,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        priority: data.priority,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined,
      };

      // Handle calendar scheduling
      if (data.showOnCalendar) {
        if (data.scheduledAllDay && data.scheduledDate) {
          const d = new Date(data.scheduledDate);
          payload.scheduledStart = startOfDay(d).toISOString();
          payload.scheduledEnd = endOfDay(d).toISOString();
          payload.scheduledAllDay = true;
        } else if (data.scheduledStart && data.scheduledEnd) {
          payload.scheduledStart = new Date(data.scheduledStart).toISOString();
          payload.scheduledEnd = new Date(data.scheduledEnd).toISOString();
          payload.scheduledAllDay = false;
        }
      } else if (!data.showOnCalendar && isOnCalendar) {
        // Remove from calendar - set to null
        payload.scheduledStart = null;
        payload.scheduledEnd = null;
        payload.scheduledAllDay = false;
      }

      return tasksApi.update(task!.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
      toast.success('Zadanie zaktualizowane');
      onClose();
    },
    onError: () => {
      toast.error('Nie udało się zaktualizować zadania');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
      toast.success('Zadanie usunięte');
      onClose();
    },
    onError: () => {
      toast.error('Nie udało się usunąć zadania');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Tytuł jest wymagany');
      return;
    }

    if (formData.showOnCalendar) {
      if (formData.scheduledAllDay) {
        if (!formData.scheduledDate) {
          toast.error('Wybierz dzień');
          return;
        }
      } else {
        if (!formData.scheduledStart || !formData.scheduledEnd) {
          toast.error('Podaj czas rozpoczęcia i zakończenia');
          return;
        }
        if (new Date(formData.scheduledStart) >= new Date(formData.scheduledEnd)) {
          toast.error('Czas zakończenia musi być późniejszy niż rozpoczęcia');
          return;
        }
      }
    }

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const priorities = [
    { value: 1, label: 'Niski', color: 'bg-gray-100 text-gray-700' },
    { value: 2, label: 'Średni', color: 'bg-yellow-100 text-yellow-700' },
    { value: 3, label: 'Wysoki', color: 'bg-orange-100 text-orange-700' },
    { value: 4, label: 'Pilne', color: 'bg-red-100 text-red-700' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edytuj zadanie' : 'Nowe zadanie'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tytuł
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Co musisz zrobić?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opis (opcjonalnie)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Dodatkowe szczegóły..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategoria
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Brak kategorii</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Priorytet
              </span>
            </label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p.value })}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                    formData.priority === p.value
                      ? `${p.color} ring-2 ring-offset-1 ring-gray-400`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Termin wykonania (opcjonalnie)
              </span>
            </label>
            <input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Show on Calendar - highlighted section */}
          <div className={cn(
            "rounded-lg border-2 p-4 transition-all",
            formData.showOnCalendar 
              ? "border-blue-500 bg-blue-50" 
              : "border-gray-200 bg-gray-50"
          )}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.showOnCalendar}
                onChange={(e) => setFormData({ ...formData, showOnCalendar: e.target.checked })}
                className="w-5 h-5 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="flex items-center gap-2 font-medium text-gray-900">
                <CalendarCheck className="w-5 h-5 text-blue-500" />
                Pokaż na kalendarzu
              </span>
            </label>
            
            {formData.showOnCalendar && (
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.scheduledAllDay}
                    onChange={(e) => setFormData({ ...formData, scheduledAllDay: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    W tym dniu (bez konkretnej godziny)
                  </span>
                </label>

                {formData.scheduledAllDay ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Dzień
                    </label>
                    <input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Od
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduledStart}
                        onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Do
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduledEnd}
                        onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          {isEditing ? (
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Usuń
            </button>
          ) : (
            <div />
          )}
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Anuluj
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isEditing ? 'Zapisz' : 'Utwórz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
