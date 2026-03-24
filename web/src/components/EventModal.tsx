import { useState, useEffect } from 'react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, MapPin, Calendar, Repeat, Trash2, Edit2, ChevronDown } from 'lucide-react';
import type { Event, Category, Attachment } from '../types';
import axios from 'axios';
import { eventsApi, categoriesApi, attachmentsApi } from '../lib/api';
import AttachmentPanel from './AttachmentPanel';
import ReminderPicker from './ReminderPicker';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface EventModalProps {
  event: Event | null;
  initialDateRange: { start: Date; end: Date } | null;
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

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return response.data.data.categories as Category[];
    },
  });

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
    isAllDay: event?.isAllDay || false,
    recurrenceRule: event?.recurrenceRule || '',
    reminderMinutes: event?.reminderMinutes ?? null,
  });

  const selectedCategory = categories.find((category) => category.id === formData.categoryId);

  const createMutation = useMutation({
    mutationFn: (vars: { data: typeof formData; queuedFiles: File[] }) => {
      const { data } = vars;
      return eventsApi.create({
        ...data,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        categoryId: data.categoryId || undefined,
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

      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });

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
        ...data,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        categoryId: data.categoryId || undefined,
        recurrenceRule: data.recurrenceRule || undefined,
        reminderMinutes: data.reminderMinutes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
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
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content event-modal-content animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
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
            <input
              type="checkbox"
              id="isAllDay"
              checked={formData.isAllDay}
              onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
              className="event-modal-checkbox w-4 h-4 rounded border-gray-400 text-blue-600 focus:ring-blue-500 dark:border-gray-500 dark:text-blue-400"
              disabled={mode === 'view'}
            />
            <label
              htmlFor="isAllDay"
              className="event-modal-label text-sm font-medium text-gray-800 dark:text-gray-300"
            >
              Wydarzenie całodniowe
            </label>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="event-modal-label block text-sm font-medium text-gray-800 mb-1 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 shrink-0" />
                  Rozpoczęcie
                </span>
              </label>
              <input
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={
                  formData.isAllDay
                    ? formData.startTime.split('T')[0]
                    : formData.startTime
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    startTime: formData.isAllDay
                      ? `${e.target.value}T00:00`
                      : e.target.value,
                  })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                disabled={mode === 'view'}
              />
            </div>
            <div>
              <label className="event-modal-label block text-sm font-medium text-gray-800 mb-1 dark:text-gray-300">
                Zakończenie
              </label>
              <input
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={
                  formData.isAllDay
                    ? formData.endTime.split('T')[0]
                    : formData.endTime
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endTime: formData.isAllDay
                      ? `${e.target.value}T23:59`
                      : e.target.value,
                  })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                disabled={mode === 'view'}
              />
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

        {/* Footer */}
        <div className="event-modal-footer flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl dark:border-gray-700 dark:bg-gray-800/60">
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
