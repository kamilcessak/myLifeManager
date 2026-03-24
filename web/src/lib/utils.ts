import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isPast,
  addDays,
} from "date-fns";
import { pl } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  const d = new Date(date);
  return format(d, "dd MMM yyyy", { locale: pl });
}

export function formatDateTime(date: Date | string) {
  const d = new Date(date);
  return format(d, "dd MMM yyyy, HH:mm", { locale: pl });
}

export function formatTime(date: Date | string) {
  const d = new Date(date);
  return format(d, "HH:mm");
}

export function formatRelativeDate(date: Date | string) {
  const d = new Date(date);

  if (isToday(d)) {
    return "Dzisiaj";
  }
  if (isTomorrow(d)) {
    return "Jutro";
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
  switch (normalizePriority(priority)) {
    case 4:
      return "Pilne";
    case 3:
      return "Wysoki";
    case 2:
      return "Średni";
    case 1:
      return "Niski";
    default:
      return "Średni";
  }
}

export function getPriorityColor(priority: number) {
  switch (normalizePriority(priority)) {
    case 4:
      return "text-red-600 bg-red-50";
    case 3:
      return "text-orange-600 bg-orange-50";
    case 2:
      return "text-yellow-600 bg-yellow-50";
    case 1:
      return "text-gray-600 bg-gray-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

export function normalizePriority(priority: number | null | undefined): 1 | 2 | 3 | 4 {
  if (priority === 1 || priority === 2 || priority === 3 || priority === 4) {
    return priority;
  }
  return 2;
}

export function getPriorityChipClass(priority: number | null | undefined) {
  return `task-info-chip-priority-${normalizePriority(priority)}`;
}

export function getPriorityBorderClass(priority: number | null | undefined) {
  switch (normalizePriority(priority)) {
    case 4:
      return "border-l-red-500";
    case 3:
      return "border-l-orange-500";
    case 2:
      return "border-l-yellow-500";
    default:
      return "border-l-gray-300";
  }
}

export function getDeadlineColor(deadline: Date | string) {
  if (isDeadlinePast(deadline)) {
    return "text-red-600 dark:text-red-400";
  }
  if (isDeadlineNear(deadline, 1)) {
    return "text-orange-600 dark:text-orange-400";
  }
  if (isDeadlineNear(deadline, 3)) {
    return "text-yellow-600 dark:text-yellow-400";
  }
  return "text-gray-500 dark:text-gray-400";
}
