import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, ChevronDown, Edit2, CheckCircle2, Undo2 } from 'lucide-react';
import { Task, Category, Attachment, TaskAssignee } from '../types';
import { tasksApi, attachmentsApi } from '../lib/api';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useCalendarUiStore } from '../store/useCalendarUiStore';
import { useTeamMembers } from '../hooks/useTeams';
import { patchTaskInTaskCaches, snapshotTaskCaches, restoreTaskCaches } from '../lib/workspaceTaskCache';
import AttachmentPanel from './AttachmentPanel';
import ReminderPicker from './ReminderPicker';
import AssigneeAvatar from './AssigneeAvatar';
import TaskActivityLog from './tasks/TaskActivityLog';
import { cn, getPriorityChipClass, getPriorityLabel, normalizePriority } from '../lib/utils';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  format,
  addHours,
  startOfHour,
  startOfDay,
  endOfDay,
  set as setDateParts,
} from 'date-fns';
import { pl } from 'date-fns/locale';
import DatePicker from './DatePicker';
import TimePicker, { firstSlotAfter, optionMinutes } from './TimePicker';
import { Switch } from '@/components/ui/switch';
import type { CalendarSlotSelection } from './SelectAddTypeModal';

interface TaskDetailPanelProps {
  task: Task | null;
  categories: Category[];
  onClose: () => void;
  initialMode?: 'view' | 'edit';
  calendarSelectPrefill?: CalendarSlotSelection | null;
  onTaskUpdated?: (patch: Partial<Task> & { id: string }) => void;
  presentation?: 'modal' | 'panel' | 'bottom-sheet';
}

type TaskFormState = {
  title: string;
  description: string;
  categoryId: string;
  priority: number;
  scheduledAllDay: boolean;
  scheduledStart: string;
  scheduledEnd: string;
  reminderMinutes: number | null;
  assigneeId: string | null;
};

function getTaskFormInitial(task: Task | null, prefill: CalendarSlotSelection | null | undefined): TaskFormState {
  const isAllDay = !!task?.scheduledAllDay;
  const defaultStart = startOfHour(addHours(new Date(), 1));
  const defaultEnd = startOfHour(addHours(new Date(), 2));
  if (task) {
    const start = task.scheduledStart
      ? new Date(task.scheduledStart)
      : task.deadline
        ? addHours(new Date(task.deadline), -1)
        : defaultStart;
    const end = task.scheduledEnd
      ? new Date(task.scheduledEnd)
      : task.deadline
        ? new Date(task.deadline)
        : defaultEnd;
    return {
      title: task.title || '',
      description: task.description || '',
      categoryId: task.categoryId || '',
      priority: task.priority || 2,
      scheduledAllDay: isAllDay,
      scheduledStart: format(start, "yyyy-MM-dd'T'HH:mm"),
      scheduledEnd: format(end, "yyyy-MM-dd'T'HH:mm"),
      reminderMinutes: task.reminderMinutes ?? null,
      assigneeId: task.assigneeId ?? task.assignee?.id ?? null,
    };
  }
  if (prefill) {
    if (prefill.allDay) {
      const d0 = startOfDay(prefill.start);
      const d1 = endOfDay(prefill.start);
      return {
        title: '',
        description: '',
        categoryId: '',
        priority: 2,
        scheduledAllDay: true,
        scheduledStart: format(d0, "yyyy-MM-dd'T'HH:mm"),
        scheduledEnd: format(d1, "yyyy-MM-dd'T'HH:mm"),
        reminderMinutes: null,
        assigneeId: null,
      };
    }
    return {
      title: '',
      description: '',
      categoryId: '',
      priority: 2,
      scheduledAllDay: false,
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
    scheduledAllDay: false,
    scheduledStart: format(defaultStart, "yyyy-MM-dd'T'HH:mm"),
    scheduledEnd: format(defaultEnd, "yyyy-MM-dd'T'HH:mm"),
    reminderMinutes: null,
    assigneeId: null,
  };
}

export default function TaskDetailPanel({
  task,
  categories,
  onClose,
  initialMode = 'edit',
  calendarSelectPrefill = null,
  onTaskUpdated,
  presentation = 'modal',
}: TaskDetailPanelProps) {
  useEscapeToClose(onClose);
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: teamMembersData } = useTeamMembers(activeWorkspaceId);
  const teamMembers = teamMembersData ?? [];
  const isEditing = !!task;
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

  const getPlanningPayload = (data: TaskFormState) => {
    const start = new Date(data.scheduledStart);
    const end = new Date(data.scheduledEnd);
    const scheduledStart = data.scheduledAllDay ? startOfDay(start) : start;
    const scheduledEnd = data.scheduledAllDay ? endOfDay(end) : end;

    return {
      deadline: scheduledEnd.toISOString(),
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      scheduledAllDay: data.scheduledAllDay,
    };
  };

  const createMutation = useMutation({
    mutationFn: (vars: { data: typeof formData; queuedFiles: File[] }) => {
      const { data } = vars;
      const teamId = useWorkspaceStore.getState().activeWorkspaceId;
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        priority: data.priority,
        reminderMinutes: data.reminderMinutes,
        ...getPlanningPayload(data),
      };

      if (teamId) {
        payload.teamId = teamId;
        payload.assigneeId = data.assigneeId ?? null;
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
        reminderMinutes: data.reminderMinutes,
        ...getPlanningPayload(data),
      };

      if (activeWorkspaceId) {
        payload.assigneeId = data.assigneeId ?? null;
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

    if (!formData.scheduledStart || !formData.scheduledEnd) {
      toast.error('Podaj datę początkową i końcową');
      return;
    }

    if (formData.scheduledAllDay) {
      if (startOfDay(new Date(formData.scheduledStart)) > startOfDay(new Date(formData.scheduledEnd))) {
        toast.error('Data końcowa nie może być wcześniejsza niż początkowa');
        return;
      }
    } else if (new Date(formData.scheduledStart) >= new Date(formData.scheduledEnd)) {
      toast.error('Czas zakończenia musi być późniejszy niż rozpoczęcia');
      return;
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

  const isPanel = presentation === 'panel';
  const isBottomSheet = presentation === 'bottom-sheet';

  useEffect(() => {
    if (!isBottomSheet) return;
    const setOpen = useCalendarUiStore.getState().setMobileTaskBottomSheetOpen;
    setOpen(true);
    return () => setOpen(false);
  }, [isBottomSheet]);

  const inner = (
    <>
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
        <form onSubmit={handleSubmit} className="bg-white p-6 text-gray-900 dark:bg-transparent dark:text-gray-100">
          <section className="task-form-section space-y-3">
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

          {/* Priority */}
          <div>
            <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-2 dark:text-gray-300">
              Priorytet
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
                Przypisany do
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
          </section>

          <section className="task-form-section space-y-3">
          {/* Date and time */}
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="task-modal-field-label text-sm font-medium text-gray-900 dark:text-gray-300">
                Data i czas
              </span>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-gray-800">
                <Switch
                  id="taskScheduledAllDay"
                  type="button"
                  size="default"
                  className="border border-slate-300 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-300 dark:border-gray-600 dark:data-[state=checked]:bg-blue-500 dark:data-[state=unchecked]:bg-gray-600"
                  checked={formData.scheduledAllDay}
                  onCheckedChange={(checked) => {
                    const isAllDay = checked === true;
                    setFormData((prev) => {
                      if (isAllDay) {
                        return {
                          ...prev,
                          scheduledAllDay: true,
                          scheduledStart: format(startOfDay(new Date(prev.scheduledStart)), "yyyy-MM-dd'T'HH:mm"),
                          scheduledEnd: format(endOfDay(new Date(prev.scheduledEnd)), "yyyy-MM-dd'T'HH:mm"),
                        };
                      }

                      return {
                        ...prev,
                        scheduledAllDay: false,
                        scheduledStart: format(
                          setDateParts(new Date(prev.scheduledStart), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }),
                          "yyyy-MM-dd'T'HH:mm"
                        ),
                        scheduledEnd: format(
                          setDateParts(new Date(prev.scheduledEnd), { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
                          "yyyy-MM-dd'T'HH:mm"
                        ),
                      };
                    });
                  }}
                  disabled={mode === 'view'}
                  aria-label="Cały dzień"
                />
                <label
                  htmlFor="taskScheduledAllDay"
                  className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Cały dzień
                </label>
              </div>
            </div>
            
            <div className="space-y-3">

                {formData.scheduledAllDay ? (
                  <div className="space-y-2">
                    {mode === 'view' ? (
                      <div className="grid grid-cols-1 gap-4 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
                        <p>
                          <span className="font-medium text-gray-500 dark:text-gray-400">Od: </span>
                          {format(new Date(formData.scheduledStart), 'PPP', { locale: pl })}
                        </p>
                        <p>
                          <span className="font-medium text-gray-500 dark:text-gray-400">Do: </span>
                          {format(new Date(formData.scheduledEnd), 'PPP', { locale: pl })}
                        </p>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col gap-3"
                        role="group"
                        aria-label="Data i czas: początek i koniec"
                      >
                        <div className="w-full">
                          <label
                            htmlFor="task-all-day-start-date"
                            className="mb-1 block text-xs font-normal text-slate-500 dark:text-gray-400"
                          >
                            Początek
                          </label>
                          <DatePicker
                            id="task-all-day-start-date"
                            className="w-full text-left"
                            value={startOfDay(taskRangeStart)}
                            onChange={(d) => {
                              if (!d) {
                                return;
                              }
                              setFormData((prev) => ({
                                ...prev,
                                scheduledStart: format(startOfDay(d), "yyyy-MM-dd'T'HH:mm"),
                                scheduledEnd:
                                  startOfDay(new Date(prev.scheduledEnd)) < startOfDay(d)
                                    ? format(endOfDay(d), "yyyy-MM-dd'T'HH:mm")
                                    : prev.scheduledEnd,
                              }));
                            }}
                          />
                        </div>
                        <div className="w-full">
                          <label
                            htmlFor="task-all-day-end-date"
                            className="mb-1 block text-xs font-normal text-slate-500 dark:text-gray-400"
                          >
                            Koniec
                          </label>
                          <DatePicker
                            id="task-all-day-end-date"
                            className="w-full text-left"
                            value={startOfDay(taskRangeEnd)}
                            onChange={(d) => {
                              if (!d) {
                                return;
                              }
                              setFormData((prev) => ({
                                ...prev,
                                scheduledEnd: format(endOfDay(d), "yyyy-MM-dd'T'HH:mm"),
                              }));
                            }}
                            disabledDays={{ before: startOfDay(taskRangeStart) }}
                          />
                        </div>
                      </div>
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
                        className="flex flex-col gap-3"
                        role="group"
                        aria-label="Zakres na kalendarzu: początek i koniec"
                      >
                        <div className="w-full">
                          <label
                            htmlFor="task-range-start-date"
                            className="mb-1 block text-xs font-normal text-slate-500 dark:text-gray-400"
                          >
                            Początek
                          </label>
                          <div className="flex w-full items-center gap-2">
                            <DatePicker
                              id="task-range-start-date"
                              className="h-10 min-w-0 flex-1 text-left"
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
                              className="h-10 w-[110px] shrink-0"
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
                            className="mb-1 block text-xs font-normal text-slate-500 dark:text-gray-400"
                          >
                            Koniec
                          </label>
                          <div className="flex w-full items-center gap-2">
                            <DatePicker
                              id="task-range-end-date"
                              className="h-10 min-w-0 flex-1 text-left"
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
                              className="h-10 w-[110px] shrink-0"
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
          </div>

          <ReminderPicker
            value={formData.reminderMinutes}
            onChange={(val) => setFormData({ ...formData, reminderMinutes: val })}
            disabled={mode === 'view'}
          />
          </section>

          <section className="task-form-section task-form-section-last space-y-4">
            <AttachmentPanel
              variant="task"
              parentId={task?.id ?? null}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              pendingFiles={pendingFiles}
              onPendingFilesChange={!task ? setPendingFiles : undefined}
              readOnly={mode === 'view'}
            />
            {task ? (
              <TaskActivityLog
                taskId={task.originalTaskId ?? task.id}
                teamId={activeWorkspaceId}
              />
            ) : null}
          </section>
        </form>
        </div>

        {/* Footer */}
        <div className="task-modal-footer sticky bottom-0 z-10 flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl dark:border-gray-700 dark:bg-gray-800 shrink-0">
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
    </>
  );

  if (isBottomSheet) {
    return (
      <div className="task-bottom-sheet-root md:hidden">
        <button
          type="button"
          className="task-bottom-sheet-backdrop"
          aria-label="Zamknij"
          onClick={onClose}
        />
        <div className="task-detail-panel-shell task-detail-panel-shell--bottom-sheet">
          <aside
            className="task-detail-panel task-detail-panel--bottom-sheet"
            onClick={(e) => e.stopPropagation()}
            aria-label={isEditing ? 'Szczegóły zadania' : 'Nowe zadanie'}
          >
            <button
              type="button"
              className="bottom-sheet-handle"
              onClick={onClose}
              aria-label="Zamknij panel"
            />
            {inner}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className={isPanel ? 'task-detail-panel-shell' : 'modal-overlay'} onClick={isPanel ? undefined : onClose}>
      <aside
        className={cn(
          isPanel
            ? 'task-detail-panel animate-slide-in-right'
            : 'modal-content task-modal-content animate-fade-in'
        )}
        onClick={(e) => e.stopPropagation()}
        aria-label={isEditing ? 'Szczegóły zadania' : 'Nowe zadanie'}
      >
        {inner}
      </aside>
    </div>
  );
}
