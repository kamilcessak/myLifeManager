import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Clock, Flag, Trash2, CalendarCheck, ChevronDown, Edit2, CheckCircle2, Undo2, UserRound } from 'lucide-react';
import { Task, Category, Attachment, TaskAssignee } from '../types';
import { tasksApi, attachmentsApi } from '../lib/api';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useTeamMembers } from '../hooks/useTeams';
import { patchTaskInTaskCaches, snapshotTaskCaches, restoreTaskCaches } from '../lib/workspaceTaskCache';
import AttachmentPanel from './AttachmentPanel';
import ReminderPicker from './ReminderPicker';
import AssigneeAvatar from './AssigneeAvatar';
import TaskActivityLog from './tasks/TaskActivityLog';
import { cn, getPriorityChipClass, getPriorityLabel, normalizePriority } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  format,
  addHours,
  addDays,
  addWeeks,
  startOfHour,
  startOfDay,
  endOfDay,
  set as setDateParts,
  parse as parseDate,
  startOfWeek,
  startOfToday,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import DatePicker from './DatePicker';
import TimePicker, { firstSlotAfter, optionMinutes } from './TimePicker';
import { Checkbox } from '@/components/ui/checkbox';
import type { CalendarSlotSelection } from './SelectAddTypeModal';

interface TaskModalProps {
  task: Task | null;
  categories: Category[];
  onClose: () => void;
  initialMode?: 'view' | 'edit';
  calendarSelectPrefill?: CalendarSlotSelection | null;
  onTaskUpdated?: (patch: Partial<Task> & { id: string }) => void;
}

type TaskFormState = {
  title: string;
  description: string;
  categoryId: string;
  priority: number;
  deadline: string;
  showOnCalendar: boolean;
  scheduledAllDay: boolean;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  reminderMinutes: number | null;
  assigneeId: string | null;
};

function getTaskFormInitial(task: Task | null, prefill: CalendarSlotSelection | null | undefined): TaskFormState {
  const isOnCalendar = !!task?.scheduledStart;
  const isAllDay = !!task?.scheduledAllDay;
  if (task) {
    return {
      title: task.title || '',
      description: task.description || '',
      categoryId: task.categoryId || '',
      priority: task.priority || 2,
      deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
      showOnCalendar: isOnCalendar,
      scheduledAllDay: isAllDay,
      scheduledDate: task.scheduledStart
        ? format(new Date(task.scheduledStart), 'yyyy-MM-dd')
        : format(addHours(new Date(), 24), 'yyyy-MM-dd'),
      scheduledStart: task.scheduledStart
        ? format(new Date(task.scheduledStart), "yyyy-MM-dd'T'HH:mm")
        : format(startOfHour(addHours(new Date(), 1)), "yyyy-MM-dd'T'HH:mm"),
      scheduledEnd: task.scheduledEnd
        ? format(new Date(task.scheduledEnd), "yyyy-MM-dd'T'HH:mm")
        : format(startOfHour(addHours(new Date(), 2)), "yyyy-MM-dd'T'HH:mm"),
      reminderMinutes: task.reminderMinutes ?? null,
      assigneeId: task.assigneeId ?? task.assignee?.id ?? null,
    };
  }
  if (prefill) {
    if (prefill.allDay) {
      const d0 = startOfDay(prefill.start);
      return {
        title: '',
        description: '',
        categoryId: '',
        priority: 2,
        deadline: format(d0, "yyyy-MM-dd'T'HH:mm"),
        showOnCalendar: true,
        scheduledAllDay: true,
        scheduledDate: format(prefill.start, 'yyyy-MM-dd'),
        scheduledStart: format(d0, "yyyy-MM-dd'T'HH:mm"),
        scheduledEnd: format(endOfDay(prefill.start), "yyyy-MM-dd'T'HH:mm"),
        reminderMinutes: null,
        assigneeId: null,
      };
    }
    return {
      title: '',
      description: '',
      categoryId: '',
      priority: 2,
      deadline: format(prefill.start, "yyyy-MM-dd'T'HH:mm"),
      showOnCalendar: true,
      scheduledAllDay: false,
      scheduledDate: format(prefill.start, 'yyyy-MM-dd'),
      scheduledStart: format(prefill.start, "yyyy-MM-dd'T'HH:mm"),
      scheduledEnd: format(prefill.end, "yyyy-MM-dd'T'HH:mm"),
      reminderMinutes: null,
      assigneeId: null,
    };
  }
  return {
    title: '',
    description: '',
    categoryId: '',
    priority: 2,
    deadline: '',
    showOnCalendar: false,
    scheduledAllDay: false,
    scheduledDate: format(addHours(new Date(), 24), 'yyyy-MM-dd'),
    scheduledStart: format(startOfHour(addHours(new Date(), 1)), "yyyy-MM-dd'T'HH:mm"),
    scheduledEnd: format(startOfHour(addHours(new Date(), 2)), "yyyy-MM-dd'T'HH:mm"),
    reminderMinutes: null,
    assigneeId: null,
  };
}

export default function TaskModal({
  task,
  categories,
  onClose,
  initialMode = 'edit',
  calendarSelectPrefill = null,
  onTaskUpdated,
}: TaskModalProps) {
  useEscapeToClose(onClose);
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: teamMembersData } = useTeamMembers(activeWorkspaceId);
  const teamMembers = teamMembersData ?? [];
  const isEditing = !!task;
  const calendarRowShowRef = useRef<HTMLLabelElement>(null);
  const calendarRowAllDayRef = useRef<HTMLLabelElement>(null);
  const [mode, setMode] = useState<'view' | 'edit'>(isEditing ? initialMode : 'edit');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
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

  const [formData, setFormData] = useState<TaskFormState>(() =>
    getTaskFormInitial(task, calendarSelectPrefill)
  );
  const selectedCategory = categories.find((category) => category.id === formData.categoryId);
  const normalizedPriority = normalizePriority(formData.priority);

  const selectedTeamMember = formData.assigneeId
    ? teamMembers.find((m) => m.user.id === formData.assigneeId)
    : undefined;
  const selectedAssignee: TaskAssignee | null = selectedTeamMember
    ? {
        id: selectedTeamMember.user.id,
        name: selectedTeamMember.user.name,
        email: selectedTeamMember.user.email,
        avatarUrl: selectedTeamMember.user.avatarUrl,
      }
    : task?.assignee && task.assignee.id === formData.assigneeId
      ? task.assignee
      : null;

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
      const teamId = useWorkspaceStore.getState().activeWorkspaceId;
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        priority: data.priority,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : undefined,
        reminderMinutes: data.reminderMinutes,
      };

      if (teamId) {
        payload.teamId = teamId;
        payload.assigneeId = data.assigneeId ?? null;
      }

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

      return tasksApi.create(payload as Parameters<typeof tasksApi.create>[0]);
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

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });

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
        reminderMinutes: data.reminderMinutes,
      };

      if (activeWorkspaceId) {
        payload.assigneeId = data.assigneeId ?? null;
      }

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
    onMutate: (data) => {
      if (!task) return undefined;
      const teamId = useWorkspaceStore.getState().activeWorkspaceId;
      if (!teamId) return undefined;

      const previous = snapshotTaskCaches(queryClient, teamId);
      const nextAssigneeId = data.assigneeId ?? null;

      // Build a mock assignee object so the avatar appears immediately.
      let nextAssignee: TaskAssignee | null = null;
      if (nextAssigneeId) {
        const member = teamMembers.find((m) => m.user.id === nextAssigneeId);
        if (member) {
          nextAssignee = {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            avatarUrl: member.user.avatarUrl,
          };
        } else if (task.assignee && task.assignee.id === nextAssigneeId) {
          nextAssignee = task.assignee;
        }
      }

      patchTaskInTaskCaches(queryClient, teamId, task.id, {
        assigneeId: nextAssigneeId,
        assignee: nextAssignee,
      });
      onTaskUpdated?.({ id: task.id, assigneeId: nextAssigneeId, assignee: nextAssignee });
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (task) {
        queryClient.invalidateQueries({
          queryKey: ['tasks', task.originalTaskId ?? task.id, 'activity'],
        });
      }
      toast.success('Zadanie zaktualizowane');
      onClose();
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        restoreTaskCaches(queryClient, ctx.previous);
      }
      toast.error('Nie udało się zaktualizować zadania');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Zadanie usunięte');
      onClose();
    },
    onError: () => {
      toast.error('Nie udało się usunąć zadania');
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: (isCompleted: boolean) => tasksApi.update(task!.id, { isCompleted }),
    onMutate: (isCompleted) => {
      const teamId = useWorkspaceStore.getState().activeWorkspaceId;
      const previous = snapshotTaskCaches(queryClient, teamId);
      patchTaskInTaskCaches(queryClient, teamId, task!.id, { isCompleted });
      onTaskUpdated?.({ id: task!.id, isCompleted });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        restoreTaskCaches(queryClient, ctx.previous);
      }
      toast.error('Nie udało się zaktualizować statusu zadania');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (task) {
        queryClient.invalidateQueries({
          queryKey: ['tasks', task.originalTaskId ?? task.id, 'activity'],
        });
      }
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

  const taskRangeStart = new Date(formData.scheduledStart);
  const taskRangeEnd = new Date(formData.scheduledEnd);
  const taskSameCalendarDay =
    startOfDay(taskRangeStart).getTime() === startOfDay(taskRangeEnd).getTime();
  const taskStartMins = taskRangeStart.getHours() * 60 + taskRangeStart.getMinutes();
  const taskSlotAfterStart = firstSlotAfter(taskStartMins);
  const taskEndTimeMinMinutes =
    formData.showOnCalendar &&
    !formData.scheduledAllDay &&
    taskSameCalendarDay &&
    taskSlotAfterStart
      ? optionMinutes(taskSlotAfterStart)
      : undefined;

  const priorities = [
    { value: 1, label: 'Niski' },
    { value: 2, label: 'Średni' },
    { value: 3, label: 'Wysoki' },
    { value: 4, label: 'Pilne' },
  ];

  const applyQuickDeadline = (kind: 'today' | 'tomorrow' | 'nextWeek') => {
    const today = startOfToday();
    let dayStart: Date;
    if (kind === 'today') {
      dayStart = today;
    } else if (kind === 'tomorrow') {
      dayStart = addDays(today, 1);
    } else {
      const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
      dayStart = addWeeks(thisWeekMonday, 1);
    }
    const prevT = formData.deadline ? format(new Date(formData.deadline), 'HH:mm') : '09:00';
    const [h, m] = prevT.split(':').map((x) => parseInt(x, 10));
    const combined = setDateParts(dayStart, {
      hours: Number.isFinite(h) ? h : 9,
      minutes: Number.isFinite(m) ? m : 0,
      seconds: 0,
      milliseconds: 0,
    });
    setFormData((prev) => ({
      ...prev,
      deadline: format(combined, "yyyy-MM-dd'T'HH:mm"),
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content task-modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-scroll">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="task-modal-header-title text-lg font-semibold min-w-0 flex-1">
            {isEditing ? (mode === 'view' ? 'Podgląd zadania' : 'Edytuj zadanie') : 'Nowe zadanie'}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            {isEditing && task ? (
              <button
                type="button"
                onClick={() =>
                  toggleCompleteMutation.mutate(!task.isCompleted)
                }
                disabled={toggleCompleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                {task.isCompleted ? (
                  <>
                    <Undo2 className="h-4 w-4" />
                    Przywróć do zrobienia
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Oznacz jako wykonane
                  </>
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="task-modal-close p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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

          {/* Assignee (only inside a workspace) */}
          {activeWorkspaceId !== null && (
            <div>
              <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-1 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <UserRound className="w-4 h-4" />
                  Przypisany do
                </span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => mode !== 'view' && setIsAssigneeDropdownOpen((prev) => !prev)}
                  className="task-modal-category-trigger flex w-full items-center justify-between rounded-lg border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:border-gray-500"
                  disabled={mode === 'view'}
                >
                  <span className="flex items-center gap-2 text-sm min-w-0 dark:text-gray-100">
                    {selectedAssignee ? (
                      <>
                        <AssigneeAvatar assignee={selectedAssignee} size="sm" showTitle={false} />
                        <span className="truncate">
                          {selectedAssignee.name || selectedAssignee.email}
                        </span>
                        {selectedAssignee.name && (
                          <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {selectedAssignee.email}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">Nieprzypisane</span>
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0" />
                </button>
                {isAssigneeDropdownOpen && mode !== 'view' && (
                  <div className="task-modal-category-dropdown absolute z-20 mt-1 w-full border rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, assigneeId: null });
                        setIsAssigneeDropdownOpen(false);
                      }}
                      className="task-modal-category-option w-full px-3 py-2 text-left text-sm flex items-center gap-2"
                    >
                      <span className="w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-[10px] text-gray-400">
                        ∅
                      </span>
                      <span className="text-gray-700 dark:text-gray-200">Nieprzypisane</span>
                    </button>
                    {teamMembers.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                        Brak członków zespołu
                      </div>
                    ) : (
                      teamMembers.map((member) => {
                        const memberAssignee: TaskAssignee = {
                          id: member.user.id,
                          name: member.user.name,
                          email: member.user.email,
                          avatarUrl: member.user.avatarUrl,
                        };
                        const isSelected = formData.assigneeId === member.user.id;
                        return (
                          <button
                            key={member.user.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, assigneeId: member.user.id });
                              setIsAssigneeDropdownOpen(false);
                            }}
                            className={cn(
                              'task-modal-category-option w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                              isSelected && 'bg-blue-50 dark:bg-blue-500/10',
                            )}
                          >
                            <AssigneeAvatar assignee={memberAssignee} size="sm" showTitle={false} />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-gray-900 dark:text-gray-100">
                                {member.user.name || member.user.email}
                              </span>
                              {member.user.name && (
                                <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                                  {member.user.email}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

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
            {mode === 'view' ? (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {formData.deadline
                  ? `${format(new Date(formData.deadline), 'PPP', { locale: pl })}, ${format(new Date(formData.deadline), 'HH:mm')}`
                  : '—'}
              </p>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <DatePicker
                  className="min-w-[10rem] flex-1 basis-[11rem]"
                  value={formData.deadline ? startOfDay(new Date(formData.deadline)) : undefined}
                  onChange={(d) => {
                    if (!d) {
                      setFormData((prev) => ({ ...prev, deadline: '' }));
                      return;
                    }
                    const prevT = formData.deadline
                      ? format(new Date(formData.deadline), 'HH:mm')
                      : '09:00';
                    const [h, m] = prevT.split(':').map((x) => parseInt(x, 10));
                    const combined = setDateParts(d, {
                      hours: Number.isFinite(h) ? h : 9,
                      minutes: Number.isFinite(m) ? m : 0,
                      seconds: 0,
                      milliseconds: 0,
                    });
                    setFormData((prev) => ({
                      ...prev,
                      deadline: format(combined, "yyyy-MM-dd'T'HH:mm"),
                    }));
                  }}
                  placeholder="Bez terminu — wybierz datę"
                />
                <TimePicker
                  className="w-full shrink-0 sm:w-[6.75rem]"
                  value={formData.deadline ? format(new Date(formData.deadline), 'HH:mm') : '09:00'}
                  onChange={(hm) => {
                    const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
                    setFormData((prev) => {
                      if (!prev.deadline) {
                        const base = new Date();
                        const combined = setDateParts(base, {
                          hours: Number.isFinite(h) ? h : 9,
                          minutes: Number.isFinite(m) ? m : 0,
                          seconds: 0,
                          milliseconds: 0,
                        });
                        return { ...prev, deadline: format(combined, "yyyy-MM-dd'T'HH:mm") };
                      }
                      const base = new Date(prev.deadline);
                      const combined = setDateParts(base, {
                        hours: Number.isFinite(h) ? h : 0,
                        minutes: Number.isFinite(m) ? m : 0,
                        seconds: 0,
                        milliseconds: 0,
                      });
                      return { ...prev, deadline: format(combined, "yyyy-MM-dd'T'HH:mm") };
                    });
                  }}
                  disabled={!formData.deadline}
                />
              </div>
            )}
            {mode !== 'view' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyQuickDeadline('today')}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/15 dark:hover:text-blue-100"
                >
                  Dzisiaj
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDeadline('tomorrow')}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/15 dark:hover:text-blue-100"
                >
                  Jutro
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickDeadline('nextWeek')}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-800 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/15 dark:hover:text-blue-100"
                >
                  W przyszłym tygodniu
                </button>
              </div>
            ) : null}
          </div>

          {/* Reminder */}
          {(formData.showOnCalendar || formData.deadline) && (
            <ReminderPicker
              value={formData.reminderMinutes}
              onChange={(val) => setFormData({ ...formData, reminderMinutes: val })}
              disabled={mode === 'view'}
            />
          )}

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
                <div className="flex items-center gap-2 px-2 py-1">
                  <Checkbox
                    id="taskScheduledAllDay"
                    checked={formData.scheduledAllDay}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, scheduledAllDay: checked === true })
                    }
                    disabled={mode === 'view'}
                    className="border border-gray-400 dark:border-gray-600"
                  />
                  <label
                    ref={calendarRowAllDayRef}
                    htmlFor="taskScheduledAllDay"
                    className={cn(
                      'task-modal-calendar-row cursor-pointer text-sm font-medium',
                      'bg-transparent text-gray-900 dark:text-gray-100'
                    )}
                  >
                    W tym dniu (bez konkretnej godziny)
                  </label>
                </div>

                {formData.scheduledAllDay ? (
                  <div className="mt-3 min-w-0">
                    <label
                      htmlFor="task-scheduled-day"
                      className="mb-1.5 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                    >
                      Dzień
                    </label>
                    {mode === 'view' ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {formData.scheduledDate
                          ? format(parseDate(formData.scheduledDate, 'yyyy-MM-dd', new Date()), 'PPP', {
                              locale: pl,
                            })
                          : '—'}
                      </p>
                    ) : (
                      <DatePicker
                        id="task-scheduled-day"
                        className="w-full"
                        value={parseDate(formData.scheduledDate, 'yyyy-MM-dd', new Date())}
                        onChange={(d) => {
                          if (!d) {
                            return;
                          }
                          const ymd = format(d, 'yyyy-MM-dd');
                          setFormData((prev) => ({ ...prev, scheduledDate: ymd }));
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mode === 'view' ? (
                      <div className="grid grid-cols-1 gap-4 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
                        <p>
                          <span className="font-medium text-gray-500 dark:text-gray-400">Od: </span>
                          {format(new Date(formData.scheduledStart), 'PPP', { locale: pl })},{' '}
                          {format(new Date(formData.scheduledStart), 'HH:mm')}
                        </p>
                        <p>
                          <span className="font-medium text-gray-500 dark:text-gray-400">Do: </span>
                          {format(new Date(formData.scheduledEnd), 'PPP', { locale: pl })},{' '}
                          {format(new Date(formData.scheduledEnd), 'HH:mm')}
                        </p>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col gap-4 mt-3"
                        role="group"
                        aria-label="Zakres na kalendarzu: początek i koniec"
                      >
                        <div className="w-full">
                          <label
                            htmlFor="task-range-start-date"
                            className="mb-1.5 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                          >
                            Początek
                          </label>
                          <div className="flex w-full gap-2">
                            <DatePicker
                              id="task-range-start-date"
                              className="min-w-0 flex-1 text-left"
                              value={startOfDay(taskRangeStart)}
                              onChange={(d) => {
                                if (!d) {
                                  return;
                                }
                                setFormData((prev) => {
                                  const t = format(new Date(prev.scheduledStart), 'HH:mm');
                                  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
                                  const combined = setDateParts(d, {
                                    hours: Number.isFinite(h) ? h : 9,
                                    minutes: Number.isFinite(m) ? m : 0,
                                    seconds: 0,
                                    milliseconds: 0,
                                  });
                                  const prevStart = new Date(prev.scheduledStart);
                                  const prevEnd = new Date(prev.scheduledEnd);
                                  let durationMs = prevEnd.getTime() - prevStart.getTime();
                                  if (!Number.isFinite(durationMs) || durationMs <= 0) {
                                    durationMs = 60 * 60 * 1000;
                                  }
                                  const nextEnd = new Date(combined.getTime() + durationMs);
                                  return {
                                    ...prev,
                                    scheduledStart: format(combined, "yyyy-MM-dd'T'HH:mm"),
                                    scheduledEnd: format(nextEnd, "yyyy-MM-dd'T'HH:mm"),
                                  };
                                });
                              }}
                            />
                            <TimePicker
                              className="w-[110px] shrink-0"
                              value={format(taskRangeStart, 'HH:mm')}
                              onChange={(hm) => {
                                const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
                                setFormData((prev) => {
                                  const prevStart = new Date(prev.scheduledStart);
                                  const prevEnd = new Date(prev.scheduledEnd);
                                  let durationMs = prevEnd.getTime() - prevStart.getTime();
                                  if (!Number.isFinite(durationMs) || durationMs <= 0) {
                                    durationMs = 60 * 60 * 1000;
                                  }
                                  const combined = setDateParts(prevStart, {
                                    hours: Number.isFinite(h) ? h : 0,
                                    minutes: Number.isFinite(m) ? m : 0,
                                    seconds: 0,
                                    milliseconds: 0,
                                  });
                                  const nextEnd = new Date(combined.getTime() + durationMs);
                                  return {
                                    ...prev,
                                    scheduledStart: format(combined, "yyyy-MM-dd'T'HH:mm"),
                                    scheduledEnd: format(nextEnd, "yyyy-MM-dd'T'HH:mm"),
                                  };
                                });
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-full">
                          <label
                            htmlFor="task-range-end-date"
                            className="mb-1.5 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                          >
                            Koniec
                          </label>
                          <div className="flex w-full gap-2">
                            <DatePicker
                              id="task-range-end-date"
                              className="min-w-0 flex-1 text-left"
                              value={startOfDay(taskRangeEnd)}
                              onChange={(d) => {
                                if (!d) {
                                  return;
                                }
                                setFormData((prev) => {
                                  const t = format(new Date(prev.scheduledEnd), 'HH:mm');
                                  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
                                  const combined = setDateParts(d, {
                                    hours: Number.isFinite(h) ? h : 10,
                                    minutes: Number.isFinite(m) ? m : 0,
                                    seconds: 0,
                                    milliseconds: 0,
                                  });
                                  const startMs = new Date(prev.scheduledStart).getTime();
                                  if (combined.getTime() <= startMs) {
                                    return {
                                      ...prev,
                                      scheduledEnd: format(
                                        new Date(startMs + 60 * 60 * 1000),
                                        "yyyy-MM-dd'T'HH:mm"
                                      ),
                                    };
                                  }
                                  return {
                                    ...prev,
                                    scheduledEnd: format(combined, "yyyy-MM-dd'T'HH:mm"),
                                  };
                                });
                              }}
                              disabledDays={{ before: startOfDay(taskRangeStart) }}
                            />
                            <TimePicker
                              className="w-[110px] shrink-0"
                              value={format(taskRangeEnd, 'HH:mm')}
                              minMinutes={taskEndTimeMinMinutes}
                              onChange={(hm) => {
                                const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
                                setFormData((prev) => {
                                  const base = new Date(prev.scheduledEnd);
                                  const combined = setDateParts(base, {
                                    hours: Number.isFinite(h) ? h : 0,
                                    minutes: Number.isFinite(m) ? m : 0,
                                    seconds: 0,
                                    milliseconds: 0,
                                  });
                                  const startMs = new Date(prev.scheduledStart).getTime();
                                  if (combined.getTime() <= startMs) {
                                    return {
                                      ...prev,
                                      scheduledEnd: format(
                                        new Date(startMs + 15 * 60 * 1000),
                                        "yyyy-MM-dd'T'HH:mm"
                                      ),
                                    };
                                  }
                                  return {
                                    ...prev,
                                    scheduledEnd: format(combined, "yyyy-MM-dd'T'HH:mm"),
                                  };
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {task ? (
            <TaskActivityLog
              taskId={task.originalTaskId ?? task.id}
              teamId={activeWorkspaceId}
            />
          ) : null}
        </form>
        </div>

        {/* Footer */}
        <div className="task-modal-footer flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl dark:border-gray-700 dark:bg-transparent shrink-0">
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
  );
}
