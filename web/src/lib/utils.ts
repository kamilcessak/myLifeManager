import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, addDays } from 'date-fns';
import { pl } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  const d = new Date(date);
  return format(d, 'dd MMM yyyy', { locale: pl });
}

export function formatDateTime(date: Date | string) {
  const d = new Date(date);
  return format(d, 'dd MMM yyyy, HH:mm', { locale: pl });
}

export function formatTime(date: Date | string) {
  const d = new Date(date);
  return format(d, 'HH:mm');
}

export function formatRelativeDate(date: Date | string) {
  const d = new Date(date);
  
  if (isToday(d)) {
    return 'Dzisiaj';
  }
  if (isTomorrow(d)) {
    return 'Jutro';
  }
  
  return formatDistanceToNow(d, { addSuffix: true, locale: pl });
}

export function isDeadlineNear(deadline: Date | string, days: number = 2) {
  const d = new Date(deadline);
  const threshold = addDays(new Date(), days);
  return d <= threshold;
}

export function isDeadlinePast(deadline: Date | string) {
  return isPast(new Date(deadline));
}

export function getPriorityLabel(priority: number) {
  switch (priority) {
    case 4:
      return 'Pilne';
    case 3:
      return 'Wysoki';
    case 2:
      return 'Średni';
    case 1:
      return 'Niski';
    default:
      return 'Średni';
  }
}

export function getPriorityColor(priority: number) {
  switch (priority) {
    case 4:
      return 'text-red-600 bg-red-50';
    case 3:
      return 'text-orange-600 bg-orange-50';
    case 2:
      return 'text-yellow-600 bg-yellow-50';
    case 1:
      return 'text-gray-600 bg-gray-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function getDeadlineColor(deadline: Date | string) {
  if (isDeadlinePast(deadline)) {
    return 'text-red-600';
  }
  if (isDeadlineNear(deadline, 1)) {
    return 'text-orange-600';
  }
  if (isDeadlineNear(deadline, 3)) {
    return 'text-yellow-600';
  }
  return 'text-gray-500';
}
