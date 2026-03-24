import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, MapPin, Calendar, Repeat, Trash2, Edit2 } from 'lucide-react';
import { Event, Category } from '../types';
import { eventsApi, categoriesApi } from '../lib/api';
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
  const queryClient = useQueryClient();
  const isEditing = !!event;
  const [mode, setMode] = useState<'view' | 'edit'>(isEditing ? initialMode : 'edit');

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return response.data.data.categories as Category[];
    },
  });

  const categories = categoriesData || [];

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
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      eventsApi.create({
        ...data,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        categoryId: data.categoryId || undefined,
        recurrenceRule: data.recurrenceRule || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
      toast.success('Wydarzenie utworzone');
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
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? (mode === 'view' ? 'Podgląd wydarzenia' : 'Edytuj wydarzenie') : 'Nowe wydarzenie'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form / View */}
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
              placeholder="Nazwa wydarzenia"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus={mode !== 'view'}
              readOnly={mode === 'view'}
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
              readOnly={mode === 'view'}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Lokalizacja (opcjonalnie)
              </span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Gdzie?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              readOnly={mode === 'view'}
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
              disabled={mode === 'view'}
            >
              <option value="">Brak kategorii</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* All Day */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAllDay"
              checked={formData.isAllDay}
              onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
              className="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
              disabled={mode === 'view'}
            />
            <label htmlFor="isAllDay" className="text-sm font-medium text-gray-700">
              Wydarzenie całodniowe
            </label>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={mode === 'view'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={mode === 'view'}
              />
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Powtarzanie
              </span>
            </label>
            <select
              value={formData.recurrenceRule}
              onChange={(e) => setFormData({ ...formData, recurrenceRule: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={mode === 'view'}
            >
              {recurrenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
