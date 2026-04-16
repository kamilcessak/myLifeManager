import { useState } from 'react';
import type { TaskAssignee } from '../types';
import { cn } from '../lib/utils';

interface AssigneeAvatarProps {
  assignee: TaskAssignee;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showTitle?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AssigneeAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
};

function pickInitial(assignee: TaskAssignee): string {
  const base = (assignee.name && assignee.name.trim()) || assignee.email || '?';
  return base.charAt(0).toUpperCase();
}

export default function AssigneeAvatar({
  assignee,
  size = 'sm',
  className,
  showTitle = true,
}: AssigneeAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const displayName = assignee.name || assignee.email;
  const title = showTitle ? `Assigned to: ${displayName}` : undefined;
  const sizeClass = SIZE_CLASSES[size];

  if (assignee.avatarUrl && !imgFailed) {
    return (
      <img
        src={assignee.avatarUrl}
        alt={displayName}
        title={title}
        onError={() => setImgFailed(true)}
        className={cn(
          sizeClass,
          'rounded-full object-cover ring-1 ring-white/70 dark:ring-gray-700',
          className,
        )}
      />
    );
  }

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        sizeClass,
        'rounded-full bg-blue-500 flex items-center justify-center font-semibold text-white select-none ring-1 ring-white/70 dark:ring-gray-700',
        className,
      )}
    >
      {pickInitial(assignee)}
    </span>
  );
}
