import { useState, useEffect, useCallback } from 'react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Edit2, ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { Event, Attachment, TaskAssignee } from '../types';
import axios from 'axios';
import { eventsApi, attachmentsApi } from '../lib/api';
import { useCategories } from '../hooks/useCategories';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useAuthStore } from '../store/authStore';
import { useTeamMembers } from '../hooks/useTeams';
import AttachmentPanel from './AttachmentPanel';
import AssigneeAvatar from './AssigneeAvatar';
import ReminderPicker from './ReminderPicker';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { format, startOfDay, endOfDay, set as setDateParts } from 'date-fns';
import { pl } from 'date-fns/locale';
import DatePicker from './DatePicker';
import TimePicker, { firstSlotAfter, optionMinutes } from './TimePicker';

interface EventModalProps {
  event: Event | null;
  initialDateRange: { start: Date; end: Date; allDay: boolean } | null;
  onClose: () => void;
  initialMode?: 'view' | 'edit';
  presentation?: 'modal' | 'panel';
}

const recurrenceOptions = [
  { value: '', label: 'Nie powtarzaj' },
  { value: 'FREQ=DAILY;INTERVAL=1', label: 'Codziennie' },
  { value: 'FREQ=WEEKLY;INTERVAL=1', label: 'Co tydzień' },
  { value: 'FREQ=WEEKLY;INTERVAL=2', label: 'Co 2 tygodnie' },
  { value: 'FREQ=MONTHLY;INTERVAL=1', label: 'Co miesiąc' },
  { value: 'FREQ=YEARLY;INTERVAL=1', label: 'Co rok' },
];

export default function EventModal({
  event,
  initialDateRange,
  onClose,
  initialMode = 'edit',
  presentation = 'modal',
}: EventModalProps) {
  useEscapeToClose(onClose);
  const queryClient = useQueryClient();
  const isEditing = !!event;
  const [mode, setMode] = useState<'view' | 'edit'>(isEditing ? initialMode : 'edit');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const { data: categoriesData } = useCategories();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: teamMembersData } = useTeamMembers(activeWorkspaceId);
  const teamMembers = teamMembersData ?? [];
  const currentUser = useAuthStore((s) => s.user);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

  const categories = categoriesData || [];

  const [attachments, setAttachments] = useState<Attachment[]>(event?.attachments ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    setAttachments(event?.attachments ?? []);
  }, [event]);

  useEffect(() => {
    if (!event) setPendingFiles([]);
  }, [event]);

  const eventParentId = event ? event.originalEventId || event.id : null;

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    location: string;
    categoryId: string;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    recurrenceRule: string;
    reminderMinutes: number | null;
    assigneeId: string | null;
  }>({
    title: event?.title || '',
    description: event?.description || '',
    location: event?.location || '',
    categoryId: event?.categoryId || '',
    startTime: event?.startTime
      ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm")
      : initialDateRange
      ? format(initialDateRange.start, "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endTime: event?.endTime
      ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm")
      : initialDateRange
      ? format(initialDateRange.end, "yyyy-MM-dd'T'HH:mm")
      : format(new Date(Date.now() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
    isAllDay: event?.isAllDay ?? initialDateRange?.allDay ?? false,
    recurrenceRule: event?.recurrenceRule || '',
    reminderMinutes: event?.reminderMinutes ?? null,
    // Default new events to the current user as assignee.
    assigneeId: event
      ? event.assigneeId ?? event.assignee?.id ?? null
      : currentUser?.id ?? null,
  });

  const selectedCategory = categories.find((category) => category.id === formData.categoryId);

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
    : event?.assignee && event.assignee.id === formData.assigneeId
      ? event.assignee
      : currentUser && currentUser.id === formData.assigneeId
        ? {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            avatarUrl: currentUser.avatarUrl,
          }
        : null;

  const applyStartDate = useCallback(
    (d: Date | undefined) => {
      if (!d || mode === 'view') {
        return;
      }
      setFormData((prev) => {
        if (prev.isAllDay) {
          const s = startOfDay(d);
          const endD = startOfDay(new Date(prev.endTime));
          if (endD < s) {
            return {
              ...prev,
              startTime: format(s, "yyyy-MM-dd'T'HH:mm"),
              endTime: format(endOfDay(d), "yyyy-MM-dd'T'HH:mm"),
            };
          }
          return {
            ...prev,
            startTime: format(s, "yyyy-MM-dd'T'HH:mm"),
            endTime: format(endOfDay(new Date(prev.endTime)), "yyyy-MM-dd'T'HH:mm"),
          };
        }
        const prevS = new Date(prev.startTime);
        const merged = setDateParts(d, {
          hours: prevS.getHours(),
          minutes: prevS.getMinutes(),
          seconds: 0,
          milliseconds: 0,
        });
        let endMs = new Date(prev.endTime).getTime();
        if (endMs <= merged.getTime()) {
          endMs = merged.getTime() + 60 * 60 * 1000;
        }
        return {
          ...prev,
          startTime: format(merged, "yyyy-MM-dd'T'HH:mm"),
          endTime: format(new Date(endMs), "yyyy-MM-dd'T'HH:mm"),
        };
      });
    },
    [mode]
  );

  const applyEndDate = useCallback(
    (d: Date | undefined) => {
      if (!d || mode === 'view') {
        return;
      }
      setFormData((prev) => {
        if (prev.isAllDay) {
          const e = endOfDay(d);
          const startD = startOfDay(new Date(prev.startTime));
          if (startOfDay(d) < startD) {
            return {
              ...prev,
              startTime: format(startOfDay(d), "yyyy-MM-dd'T'HH:mm"),
              endTime: format(e, "yyyy-MM-dd'T'HH:mm"),
            };
          }
          return {
            ...prev,
            endTime: format(e, "yyyy-MM-dd'T'HH:mm"),
          };
        }
        const prevE = new Date(prev.endTime);
        const merged = setDateParts(d, {
          hours: prevE.getHours(),
          minutes: prevE.getMinutes(),
          seconds: 0,
          milliseconds: 0,
        });
        const startMs = new Date(prev.startTime).getTime();
        if (merged.getTime() <= startMs) {
          return {
            ...prev,
            endTime: format(new Date(startMs + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
          };
        }
        return {
          ...prev,
          endTime: format(merged, "yyyy-MM-dd'T'HH:mm"),
        };
      });
    },
    [mode]
  );

  const applyStartTime = useCallback((hm: string) => {
    const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
    setFormData((prev) => {
      if (prev.isAllDay) {
        return prev;
      }
      const prevStart = new Date(prev.startTime);
      const prevEnd = new Date(prev.endTime);
      let durationMs = prevEnd.getTime() - prevStart.getTime();
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        durationMs = 60 * 60 * 1000;
      }
      const nextStart = setDateParts(prevStart, {
        hours: Number.isFinite(h) ? h : 0,
        minutes: Number.isFinite(m) ? m : 0,
        seconds: 0,
        milliseconds: 0,
      });
      const nextEnd = new Date(nextStart.getTime() + durationMs);
      return {
        ...prev,
        startTime: format(nextStart, "yyyy-MM-dd'T'HH:mm"),
        endTime: format(nextEnd, "yyyy-MM-dd'T'HH:mm"),
      };
    });
  }, []);

  const applyEndTime = useCallback((hm: string) => {
    const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
    setFormData((prev) => {
      if (prev.isAllDay) {
        return prev;
      }
      const base = new Date(prev.endTime);
      const nextEnd = setDateParts(base, {
        hours: Number.isFinite(h) ? h : 0,
        minutes: Number.isFinite(m) ? m : 0,
        seconds: 0,
        milliseconds: 0,
      });
      const startMs = new Date(prev.startTime).getTime();
      if (nextEnd.getTime() <= startMs) {
        const adjusted = new Date(startMs + 15 * 60 * 1000);
        return {
          ...prev,
          endTime: format(adjusted, "yyyy-MM-dd'T'HH:mm"),
        };
      }
      return { ...prev, endTime: format(nextEnd, "yyyy-MM-dd'T'HH:mm") };
    });
  }, []);

  const createMutation = useMutation({
    mutationFn: (vars: { data: typeof formData; queuedFiles: File[] }) => {
      const { data } = vars;
      const teamId = useWorkspaceStore.getState().activeWorkspaceId;
      return eventsApi.create({
        title: data.title,
        description: data.description,
        location: data.location,
        categoryId: data.categoryId || undefined,
        ...(teamId ? { teamId, assigneeId: data.assigneeId ?? null } : {}),
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        isAllDay: data.isAllDay,
        recurrenceRule: data.recurrenceRule || undefined,
        reminderMinutes: data.reminderMinutes,
      });
    },
    onSuccess: async (response, vars) => {
      const newEvent = response.data.data.event;
      const { queuedFiles } = vars;
      setPendingFiles([]);

      let uploaded = 0;
      const targetEventId = newEvent.id;
      for (const file of queuedFiles) {
        try {
          const res = await attachmentsApi.upload(file, { eventId: targetEventId });
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

      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      if (queuedFiles.length === 0) {
        toast.success('Wydarzenie utworzone');
      } else if (uploaded === queuedFiles.length) {
        toast.success(
          uploaded === 1
            ? 'Wydarzenie utworzone — załącznik wysłany'
            : `Wydarzenie utworzone — wgrano ${uploaded} załączników`,
        );
      } else if (uploaded > 0) {
        toast.success(`Wydarzenie utworzone — wgrano ${uploaded} z ${queuedFiles.length} plików`);
      } else {
        toast.error('Wydarzenie utworzone, ale załączniki nie zostały wgrane');
      }

      onClose();
    },
    onError: () => {
      toast.error('Nie udało się utworzyć wydarzenia');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      eventsApi.update(event!.originalEventId || event!.id, {
        title: data.title,
        description: data.description,
        location: data.location,
        categoryId: data.categoryId || undefined,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        isAllDay: data.isAllDay,
        recurrenceRule: data.recurrenceRule || undefined,
        reminderMinutes: data.reminderMinutes,
        ...(activeWorkspaceId ? { assigneeId: data.assigneeId ?? null } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Wydarzenie zaktualizowane');
      onClose();
    },
    onError: () => {
      toast.error('Nie udało się zaktualizować wydarzenia');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => eventsApi.delete(event!.originalEventId || event!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Wydarzenie usunięte');
      onClose();
    },
    onError: () => {
      toast.error('Nie udało się usunąć wydarzenia');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Tytuł jest wymagany');
      return;
    }

    if (new Date(formData.startTime) >= new Date(formData.endTime)) {
      toast.error('Data końcowa musi być późniejsza niż początkowa');
      return;
    }

    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate({ data: formData, queuedFiles: pendingFiles });
    }
  };

  const eventStartForRange = new Date(formData.startTime);
  const eventEndForRange = new Date(formData.endTime);
  const eventSameCalendarDay =
    startOfDay(eventStartForRange).getTime() === startOfDay(eventEndForRange).getTime();
  const eventStartMins = eventStartForRange.getHours() * 60 + eventStartForRange.getMinutes();
  const eventSlotAfterStart = firstSlotAfter(eventStartMins);
  const eventEndTimeMinMinutes =
    !formData.isAllDay && eventSameCalendarDay && eventSlotAfterStart
      ? optionMinutes(eventSlotAfterStart)
      : undefined;
  const isPanel = presentation === 'panel';

  return (
    <div className={isPanel ? 'task-detail-panel-shell' : 'modal-overlay'} onClick={isPanel ? undefined : onClose}>
      <aside
        className={cn(
          isPanel
            ? 'task-detail-panel animate-slide-in-right'
            : 'modal-content task-modal-content animate-fade-in'
        )}
        onClick={(e) => e.stopPropagation()}
        aria-label={isEditing ? 'Szczegóły wydarzenia' : 'Nowe wydarzenie'}
      >
        <div className="event-modal-scroll">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="task-modal-header-title text-lg font-semibold min-w-0 flex-1">
            {isEditing ? (mode === 'view' ? 'Podgląd wydarzenia' : 'Edytuj wydarzenie') : 'Nowe wydarzenie'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="task-modal-close p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form / View */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 text-gray-900 dark:bg-transparent dark:text-gray-100"
        >
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
              placeholder="Nazwa wydarzenia"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
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
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
              readOnly={mode === 'view'}
            />
          </div>

          {/* Location */}
          <div>
            <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-1 dark:text-gray-300">
              Lokalizacja (opcjonalnie)
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Gdzie?"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
              readOnly={mode === 'view'}
            />
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
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                      {selectedCategory.name}
                    </>
                  ) : (
                    'Brak kategorii'
                  )}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
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
                      className="task-modal-category-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
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
          {/* Date & Time */}
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="task-modal-field-label text-sm font-medium text-gray-900 dark:text-gray-300">
                Data i czas
              </span>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 dark:bg-gray-800">
            <Switch
              id="eventIsAllDay"
              type="button"
              size="default"
              className="border border-slate-300 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-300 dark:border-gray-600 dark:data-[state=checked]:bg-blue-500 dark:data-[state=unchecked]:bg-gray-600"
              checked={formData.isAllDay}
              onCheckedChange={(checked) => {
                const isOn = checked === true;
                setFormData((prev) => {
                  if (isOn) {
                    const s = startOfDay(new Date(prev.startTime));
                    const en = endOfDay(new Date(prev.endTime));
                    return {
                      ...prev,
                      isAllDay: true,
                      startTime: format(s, "yyyy-MM-dd'T'HH:mm"),
                      endTime: format(en, "yyyy-MM-dd'T'HH:mm"),
                    };
                  }
                  const s = new Date(prev.startTime);
                  const en = new Date(prev.endTime);
                  return {
                    ...prev,
                    isAllDay: false,
                    startTime: format(
                      setDateParts(s, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 }),
                      "yyyy-MM-dd'T'HH:mm"
                    ),
                    endTime: format(
                      setDateParts(en, { hours: 10, minutes: 0, seconds: 0, milliseconds: 0 }),
                      "yyyy-MM-dd'T'HH:mm"
                    ),
                  };
                });
              }}
              disabled={mode === 'view'}
            />
            <label
              htmlFor="eventIsAllDay"
              className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Cały dzień
            </label>
              </div>
            </div>
          </div>
          <div className="space-y-3">
              {mode === 'view' ? (
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-8 sm:gap-y-2">
                    <p>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Od: </span>
                      {format(new Date(formData.startTime), 'PPP', { locale: pl })}
                      {!formData.isAllDay && `, ${format(new Date(formData.startTime), 'HH:mm')}`}
                    </p>
                    <p>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Do: </span>
                      {format(new Date(formData.endTime), 'PPP', { locale: pl })}
                      {!formData.isAllDay && `, ${format(new Date(formData.endTime), 'HH:mm')}`}
                    </p>
                  </div>
                </div>
              ) : formData.isAllDay ? (
                <div className="flex flex-col gap-3">
                  <div className="w-full">
                    <label
                      htmlFor="event-all-day-start"
                      className="mb-1 block text-xs font-normal text-slate-500 dark:text-gray-400"
                    >
                      Początek
                    </label>
                    <DatePicker
                      id="event-all-day-start"
                      className="w-full"
                      value={startOfDay(new Date(formData.startTime))}
                      onChange={applyStartDate}
                    />
                  </div>
                  <div className="w-full">
                    <label
                      htmlFor="event-all-day-end"
                      className="mb-1 block text-xs font-normal text-slate-500 dark:text-gray-400"
                    >
                      Koniec
                    </label>
                    <DatePicker
                      id="event-all-day-end"
                      className="w-full"
                      value={startOfDay(new Date(formData.endTime))}
                      onChange={applyEndDate}
                      disabledDays={{ before: startOfDay(new Date(formData.startTime)) }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col gap-3"
                  role="group"
                  aria-label="Data i godzina: początek i koniec"
                >
                  <div className="w-full">
                    <label
                      htmlFor="event-range-start-date"
                      className="mb-1 block text-xs font-normal text-slate-500 dark:text-gray-400"
                    >
                      Początek
                    </label>
                    <div className="flex w-full items-center gap-2">
                      <DatePicker
                        id="event-range-start-date"
                        className="h-10 min-w-0 flex-1 text-left"
                        value={startOfDay(eventStartForRange)}
                        onChange={applyStartDate}
                      />
                      <TimePicker
                        className="h-10 w-[110px] shrink-0"
                        value={format(eventStartForRange, 'HH:mm')}
                        onChange={applyStartTime}
                      />
                    </div>
                  </div>
                  <div className="w-full">
                    <label
                      htmlFor="event-range-end-date"
                      className="mb-1 block text-xs font-normal text-slate-500 dark:text-gray-400"
                    >
                      Koniec
                    </label>
                    <div className="flex w-full items-center gap-2">
                      <DatePicker
                        id="event-range-end-date"
                        className="h-10 min-w-0 flex-1 text-left"
                        value={startOfDay(eventEndForRange)}
                        onChange={applyEndDate}
                        disabledDays={{ before: startOfDay(eventStartForRange) }}
                      />
                      <TimePicker
                        className="h-10 w-[110px] shrink-0"
                        value={format(eventEndForRange, 'HH:mm')}
                        onChange={applyEndTime}
                        minMinutes={eventEndTimeMinMinutes}
                      />
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Recurrence */}
          <div>
            <label className="task-modal-field-label block text-sm font-medium text-gray-900 mb-1 dark:text-gray-300">
              Powtarzanie
            </label>
            <select
              value={formData.recurrenceRule}
              onChange={(e) => setFormData({ ...formData, recurrenceRule: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              disabled={mode === 'view'}
            >
              {recurrenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reminder */}
          <ReminderPicker
            value={formData.reminderMinutes}
            onChange={(val) => setFormData({ ...formData, reminderMinutes: val })}
            disabled={mode === 'view'}
          />
          </section>

          <section className="task-form-section task-form-section-last space-y-4">
            <AttachmentPanel
              variant="event"
              parentId={eventParentId}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              pendingFiles={pendingFiles}
              onPendingFilesChange={!event ? setPendingFiles : undefined}
              readOnly={mode === 'view'}
            />
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
      </aside>
    </div>
  );
}
