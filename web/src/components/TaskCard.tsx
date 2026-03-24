import { useMemo } from 'react';
import { Check, Clock, Calendar, Image, GripVertical } from 'lucide-react';
import { Task } from '../types';
import { cn, formatRelativeDate, getDeadlineColor, getPriorityLabel } from '../lib/utils';

interface TaskCardProps {
  task: Task;
  onToggleComplete?: (id: string, currentStatus: boolean) => void;
  onEdit?: (task: Task) => void;
}

export default function TaskCard({ task, onToggleComplete, onEdit }: TaskCardProps) {
  const priorityStyle = useMemo(() => {
    switch (task.priority) {
      case 4:
        return 'border-l-red-500';
      case 3:
        return 'border-l-orange-500';
      case 2:
        return 'border-l-yellow-500';
      default:
        return 'border-l-gray-300';
    }
  }, [task.priority]);

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
          <div className="text-gray-400 cursor-grab mt-0.5">
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Checkbox */}
        <button
          className={cn(
            'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            task.isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 hover:border-gray-400'
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
          <h3 className="task-title text-sm">{task.title}</h3>

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
            <span className={cn('task-info-chip', `task-info-chip-priority-${task.priority}`)}>
              {getPriorityLabel(task.priority)}
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
              <span className="text-gray-400">
                <Image className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
