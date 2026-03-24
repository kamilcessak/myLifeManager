import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Clock, Flag, Trash2, CalendarCheck, ChevronDown, Edit2 } from 'lucide-react';
import { Task, Category, Attachment } from '../types';
import { tasksApi, attachmentsApi } from '../lib/api';
import AttachmentPanel from './AttachmentPanel';
import { cn, getPriorityChipClass, getPriorityLabel, normalizePriority } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import toast from 'react-hot-toast';
import axios from 'axios';
import { format, addHours, startOfHour, startOfDay, endOfDay } from 'date-fns';

interface TaskModalProps {
  task: Task | null;
  categories: Category[];
  onClose: () => void;
  initialMode?: 'view' | 'edit';
}

export default function TaskModal({ task, categories, onClose, initialMode = 'edit' }: TaskModalProps) {
  useEscapeToClose(onClose);
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const isEditing = !!task;
  const calendarRowShowRef = useRef<HTMLLabelElement>(null);
  const calendarRowAllDayRef = useRef<HTMLLabelElement>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(isEditing ? initialMode : 'edit');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(task?.attachments ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    setAttachments(task?.attachments ?? []);
  }, [task]);

  useEffect(() => {
    if (!task) setPendingFiles([]);
  }, [task]);

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
  const selectedCategory = categories.find((category) => category.id === formData.categoryId);
  const normalizedPriority = normalizePriority(formData.priority);

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

  useLayoutEffect(() => {
    const applyCalendarRow = (el: HTMLLabelElement | null) => {
      if (!el) return;
      if (resolvedTheme === 'light') {
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('color', '#111827', 'important');
        el.style.setProperty('-webkit-text-fill-color', '#111827', 'important');
        el.style.setProperty('border-color', 'transparent', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
      } else {
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('color', '#f3f4f6', 'important');
        el.style.setProperty('-webkit-text-fill-color', '#f3f4f6', 'important');
        el.style.setProperty('border-color', 'transparent', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
      }
    };
    applyCalendarRow(calendarRowShowRef.current);
    applyCalendarRow(calendarRowAllDayRef.current);
  }, [resolvedTheme, formData.showOnCalendar]);

  const createMutation = useMutation({
    mutationFn: (vars: { data: typeof formData; queuedFiles: File[] }) => {
      const { data } = vars;
      const payload: any = {
        title: data.title,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        priority: data.priority,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined,
      };

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
    onSuccess: async (response, vars) => {
      const newTask = response.data.data.task;
      const { queuedFiles } = vars;
      setPendingFiles([]);

      let uploaded = 0;
      for (const file of queuedFiles) {
        try {
          const res = await attachmentsApi.upload(file, { taskId: newTask.id });
          setAttachments((prev) => [res.data.data.attachment, ...prev]);
          uploaded += 1;
        } catch (err) {
          let msg = 'Nie udało się wgrać pliku';
          if (
            axios.isAxiosError(err) &&
            err.response?.data &&
            typeof err.response.data === 'object' &&
            'message' in err.response.data
          ) {
            msg = String((err.response.data as { message: string }).message);
          }
          toast.error(msg);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });

      if (queuedFiles.length === 0) {
        toast.success('Zadanie utworzone');
      } else if (uploaded === queuedFiles.length) {
        toast.success(
          uploaded === 1
            ? 'Zadanie utworzone — załącznik wysłany'
            : `Zadanie utworzone — wgrano ${uploaded} załączników`,
        );
      } else if (uploaded > 0) {
        toast.success(`Zadanie utworzone — wgrano ${uploaded} z ${queuedFiles.length} plików`);
      } else {
        toast.error('Zadanie utworzone, ale załączniki nie zostały wgrane');
      }

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
      createMutation.mutate({ data: formData, queuedFiles: pendingFiles });
    }
  };

  const priorities = [
    { value: 1, label: 'Niski' },
    { value: 2, label: 'Średni' },
    { value: 3, label: 'Wysoki' },
    { value: 4, label: 'Pilne' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content task-modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-scroll">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="task-modal-header-title text-lg font-semibold">
            {isEditing ? (mode === 'view' ? 'Podgląd zadania' : 'Edytuj zadanie') : 'Nowe zadanie'}
          </h2>
          <button
            onClick={onClose}
            className="task-modal-close p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
              <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form / View */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white text-gray-900 dark:bg-transparent dark:text-gray-100">
          {/* Title */}
          <div>
            <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-1 dark:text-gray-300">
              Tytuł
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Co musisz zrobić?"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              autoFocus={mode !== 'view'}
              readOnly={mode === 'view'}
            />
          </div>

          {/* Description */}
          <div>
            <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-1 dark:text-gray-300">
              Opis (opcjonalnie)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Dodatkowe szczegóły..."
              rows={4}
              className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              readOnly={mode === 'view'}
            />
          </div>

          <AttachmentPanel
            variant="task"
            parentId={task?.id ?? null}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            pendingFiles={pendingFiles}
            onPendingFilesChange={!task ? setPendingFiles : undefined}
            readOnly={mode === 'view'}
          />

          {/* Category */}
          <div>
            <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-1 dark:text-gray-300">
              Kategoria
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => mode !== 'view' && setIsCategoryDropdownOpen((prev) => !prev)}
                className="task-modal-category-trigger flex w-full items-center justify-between rounded-lg border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:border-gray-500"
                disabled={mode === 'view'}
              >
                <span className="flex items-center gap-2 text-sm dark:text-gray-100">
                  {selectedCategory ? (
                    <>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                      {selectedCategory.name}
                    </>
                  ) : (
                    'Brak kategorii'
                  )}
                </span>
                <ChevronDown className="w-4 h-4 shrink-0" />
              </button>
              {isCategoryDropdownOpen && mode !== 'view' && (
                <div className="task-modal-category-dropdown absolute z-20 mt-1 w-full border rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, categoryId: '' });
                      setIsCategoryDropdownOpen(false);
                    }}
                    className="task-modal-category-option w-full px-3 py-2 text-left text-sm"
                  >
                    Brak kategorii
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, categoryId: category.id });
                        setIsCategoryDropdownOpen(false);
                      }}
                      className="task-modal-category-option w-full px-3 py-2 text-left text-sm flex items-center gap-2"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-2 dark:text-gray-300">
              <span className="flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Priorytet
              </span>
            </label>
            {mode === 'view' ? (
              <span
                className={cn(
                  'inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold',
                  getPriorityChipClass(normalizedPriority)
                )}
              >
                {getPriorityLabel(normalizedPriority)}
              </span>
            ) : (
              <div className="flex gap-2">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p.value })}
                    className={cn(
                      // Nie używamy tu `task-info-chip` — w CSS ma sztywne px-2 py-0.5 i nadpisuje padding z Tailwinda.
                      // Bez opacity na całym przycisku — wtedy tekst w light wyglądał „wyprany” mimo text-*-900 na chipie.
                      'task-modal-priority-btn inline-flex flex-1 items-center justify-center px-5 py-2.5 rounded-lg border text-sm font-semibold transition-all',
                      getPriorityChipClass(p.value),
                      normalizedPriority === p.value
                        ? 'ring-2 ring-offset-1 ring-gray-400 ring-offset-white dark:ring-gray-500 dark:ring-offset-gray-800'
                        : '',
                      'border-transparent'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-1 dark:text-gray-300">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Termin wykonania (opcjonalnie)
              </span>
            </label>
            <input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              disabled={mode === 'view'}
            />
          </div>

          {/* Show on Calendar — outer box: w light jak reszta formularza (białe tło), bez ciemnej szarej ramki */}
          <div
            className={cn(
              'task-modal-calendar-section rounded-lg p-4 transition-all',
              formData.showOnCalendar
                ? 'border-2 border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10'
                : 'border border-gray-200 bg-white dark:border-gray-600 dark:bg-transparent'
            )}
          >
            <label
              ref={calendarRowShowRef}
              className={cn(
                'task-modal-calendar-row flex cursor-pointer items-center gap-3 rounded-md px-2 py-1',
                'bg-transparent text-gray-900 dark:text-gray-100'
              )}
            >
              <input
                type="checkbox"
                checked={formData.showOnCalendar}
                onChange={(e) => setFormData({ ...formData, showOnCalendar: e.target.checked })}
                className="task-modal-calendar-checkbox w-5 h-5 rounded border-gray-300 bg-transparent text-blue-600 focus:ring-blue-500 dark:border-gray-500 dark:text-blue-400"
                disabled={mode === 'view'}
              />
              <span className="flex items-center gap-2 font-medium text-inherit">
                <CalendarCheck className="h-5 w-5 shrink-0 text-gray-900 dark:text-blue-400" />
                Pokaż na kalendarzu
              </span>
            </label>
            
            {formData.showOnCalendar && (
              <div className="mt-4 space-y-3">
                <label
                  ref={calendarRowAllDayRef}
                  className={cn(
                    'task-modal-calendar-row flex cursor-pointer items-center gap-3 rounded-md px-2 py-1',
                    'bg-transparent text-gray-900 dark:text-gray-100'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={formData.scheduledAllDay}
                    onChange={(e) => setFormData({ ...formData, scheduledAllDay: e.target.checked })}
                    className="task-modal-calendar-checkbox h-4 w-4 rounded border-gray-300 bg-transparent text-blue-600 focus:ring-blue-500 dark:border-gray-500 dark:text-blue-400"
                    disabled={mode === 'view'}
                  />
                  <span className="text-sm font-medium text-inherit">
                    W tym dniu (bez konkretnej godziny)
                  </span>
                </label>

                {formData.scheduledAllDay ? (
                  <div>
                    <label className="task-modal-field-label block text-xs font-medium text-gray-900 mb-1 dark:text-gray-300">
                      Dzień
                    </label>
                    <input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      disabled={mode === 'view'}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="task-modal-field-label block text-xs font-medium text-gray-900 mb-1 dark:text-gray-300">
                        Od
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduledStart}
                        onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        disabled={mode === 'view'}
                      />
                    </div>
                    <div>
                      <label className="task-modal-field-label block text-xs font-medium text-gray-900 mb-1 dark:text-gray-300">
                        Do
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduledEnd}
                        onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        disabled={mode === 'view'}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl dark:border-gray-700 dark:bg-transparent">
          {isEditing ? (
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 border border-red-200 bg-white text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:border-red-500/30 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10"
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
              className="task-modal-cancel px-4 py-2 border border-gray-300 rounded-lg transition-colors dark:border-gray-600 dark:bg-transparent dark:hover:bg-gray-700"
            >
              Anuluj
            </button>
            {mode === 'view' && isEditing ? (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edytuj
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isEditing ? 'Zapisz' : 'Utwórz'}
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
