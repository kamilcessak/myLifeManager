import { useMemo } from 'react';
import { Check, Clock, Calendar, Image, GripVertical } from 'lucide-react';
import { Task } from '../types';
import { cn, formatRelativeDate, getDeadlineColor, getPriorityBorderClass, getPriorityChipClass, getPriorityLabel, normalizePriority } from '../lib/utils';
import AssigneeAvatar from './AssigneeAvatar';

interface TaskCardProps {
  task: Task;
  onToggleComplete?: (id: string, currentStatus: boolean) => void;
  onEdit?: (task: Task) => void;
}

export default function TaskCard({ task, onToggleComplete, onEdit }: TaskCardProps) {
  const normalizedPriority = useMemo(() => normalizePriority(task.priority), [task.priority]);
  const priorityStyle = useMemo(() => getPriorityBorderClass(task.priority), [task.priority]);

  const categoryColor = task.category?.color || '#6b7280';

  return (
    <div
      className={cn(
        'task-card border-l-4',
        priorityStyle,
        task.isCompleted && 'completed'
      )}
      onClick={() => onEdit?.(task)}
      data-task-id={task.id}
      data-task-title={task.title}
      data-task-color={categoryColor}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        {!task.isCompleted && (
          <div className="text-gray-400 dark:text-gray-500 cursor-grab mt-0.5">
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Checkbox */}
        <button
          className={cn(
            'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            task.isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete?.(task.id, task.isCompleted);
          }}
        >
          {task.isCompleted && <Check className="w-3 h-3" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="task-title text-sm min-w-0 flex-1">{task.title}</h3>
            {task.assignee && (
              <AssigneeAvatar
                assignee={task.assignee}
                size="sm"
                className="shrink-0 mt-0.5"
              />
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Category */}
            {task.category && (
              <span
                className="category-badge"
                style={{
                  backgroundColor: `${categoryColor}15`,
                  color: categoryColor,
                }}
              >
                {task.category.name}
              </span>
            )}

            {/* Priority */}
            <span className={cn('task-info-chip', getPriorityChipClass(normalizedPriority))}>
              {getPriorityLabel(normalizedPriority)}
            </span>

            {/* Deadline */}
            {task.deadline && (
              <span className={cn('flex items-center gap-1 text-xs', getDeadlineColor(task.deadline))}>
                <Clock className="w-3 h-3" />
                {formatRelativeDate(task.deadline)}
              </span>
            )}

            {/* Scheduled */}
            {task.scheduledStart && (
              <span className="task-info-chip task-info-chip-scheduled">
                <Calendar className="w-3 h-3" />
                W kalendarzu
              </span>
            )}

            {/* Has image */}
            {task.imageUrl && (
              <span className="text-gray-400 dark:text-gray-500">
                <Image className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
