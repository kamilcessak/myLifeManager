import { useState, useEffect, useCallback } from 'react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, MapPin, Calendar, Repeat, Trash2, Edit2, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Event, Attachment } from '../types';
import axios from 'axios';
import { eventsApi, attachmentsApi } from '../lib/api';
import { useCategories } from '../hooks/useCategories';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import AttachmentPanel from './AttachmentPanel';
import ReminderPicker from './ReminderPicker';
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
}

const recurrenceOptions = [
  { value: '', label: 'Nie powtarzaj' },
  { value: 'FREQ=DAILY;INTERVAL=1', label: 'Codziennie' },
  { value: 'FREQ=WEEKLY;INTERVAL=1', label: 'Co tydzień' },
  { value: 'FREQ=WEEKLY;INTERVAL=2', label: 'Co 2 tygodnie' },
  { value: 'FREQ=MONTHLY;INTERVAL=1', label: 'Co miesiąc' },
  { value: 'FREQ=YEARLY;INTERVAL=1', label: 'Co rok' },
];

export default function EventModal({ event, initialDateRange, onClose, initialMode = 'edit' }: EventModalProps) {
  useEscapeToClose(onClose);
  const queryClient = useQueryClient();
  const isEditing = !!event;
  const [mode, setMode] = useState<'view' | 'edit'>(isEditing ? initialMode : 'edit');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const { data: categoriesData } = useCategories();

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

  const [formData, setFormData] = useState({
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
  });

  const selectedCategory = categories.find((category) => category.id === formData.categoryId);

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
        ...(teamId ? { teamId } : {}),
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content event-modal-content animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="event-modal-scroll">
        {/* Header */}
        <div className="event-modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-transparent">
          <h2 className="event-modal-title text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? (mode === 'view' ? 'Podgląd wydarzenia' : 'Edytuj wydarzenie') : 'Nowe wydarzenie'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="event-modal-close p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Form / View */}
        <form
          onSubmit={handleSubmit}
          className="event-modal-form p-6 space-y-4 bg-white text-gray-900 dark:bg-transparent dark:text-gray-100"
        >
          {/* Title */}
          <div>
            <label className="event-modal-label block text-sm font-medium text-gray-800 mb-1 dark:text-gray-300">
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
            <label className="event-modal-label block text-sm font-medium text-gray-800 mb-1 dark:text-gray-300">
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

          <AttachmentPanel
            variant="event"
            parentId={eventParentId}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            pendingFiles={pendingFiles}
            onPendingFilesChange={!event ? setPendingFiles : undefined}
            readOnly={mode === 'view'}
          />

          {/* Location */}
          <div>
            <label className="event-modal-label block text-sm font-medium text-gray-800 mb-1 dark:text-gray-300">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" />
                Lokalizacja (opcjonalnie)
              </span>
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
            <label className="event-modal-label block text-sm font-medium text-gray-800 mb-1 dark:text-gray-300">
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

          {/* All Day */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="isAllDay"
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
              className="border border-gray-400 dark:border-gray-600"
            />
            <label
              htmlFor="isAllDay"
              className="event-modal-label cursor-pointer text-sm font-medium text-gray-800 dark:text-gray-300"
            >
              Wydarzenie całodniowe
            </label>
          </div>

          {/* Date & Time */}
          <div className="space-y-3">
            <div>
              <span className="event-modal-label mb-2 flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-300">
                <Calendar className="h-4 w-4 shrink-0" />
                {formData.isAllDay ? 'Daty (cały dzień)' : 'Data i godzina'}
              </span>
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
                <div className="flex flex-col gap-4 mt-3">
                  <div className="w-full">
                    <label
                      htmlFor="event-all-day-start"
                      className="mb-1.5 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
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
                      className="mb-1.5 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
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
                  className="flex flex-col gap-4 mt-3"
                  role="group"
                  aria-label="Data i godzina: początek i koniec"
                >
                  <div className="w-full">
                    <label
                      htmlFor="event-range-start-date"
                      className="mb-1.5 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                    >
                      Początek
                    </label>
                    <div className="flex w-full gap-2">
                      <DatePicker
                        id="event-range-start-date"
                        className="min-w-0 flex-1 text-left"
                        value={startOfDay(eventStartForRange)}
                        onChange={applyStartDate}
                      />
                      <TimePicker
                        className="w-[110px] shrink-0"
                        value={format(eventStartForRange, 'HH:mm')}
                        onChange={applyStartTime}
                      />
                    </div>
                  </div>
                  <div className="w-full">
                    <label
                      htmlFor="event-range-end-date"
                      className="mb-1.5 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                    >
                      Koniec
                    </label>
                    <div className="flex w-full gap-2">
                      <DatePicker
                        id="event-range-end-date"
                        className="min-w-0 flex-1 text-left"
                        value={startOfDay(eventEndForRange)}
                        onChange={applyEndDate}
                        disabledDays={{ before: startOfDay(eventStartForRange) }}
                      />
                      <TimePicker
                        className="w-[110px] shrink-0"
                        value={format(eventEndForRange, 'HH:mm')}
                        onChange={applyEndTime}
                        minMinutes={eventEndTimeMinMinutes}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="event-modal-label block text-sm font-medium text-gray-800 mb-1 dark:text-gray-300">
              <span className="flex items-center gap-2">
                <Repeat className="w-4 h-4 shrink-0" />
                Powtarzanie
              </span>
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
        </form>
        </div>

        {/* Footer */}
        <div className="event-modal-footer flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl dark:border-gray-700 dark:bg-gray-800/60 shrink-0">
          {isEditing ? (
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="event-modal-delete flex items-center gap-2 px-3 py-2 border border-red-200 bg-white text-red-700 hover:bg-red-50 rounded-lg transition-colors dark:border-red-500/30 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10"
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
              className="event-modal-cancel px-4 py-2 border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 rounded-lg transition-colors dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700"
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
