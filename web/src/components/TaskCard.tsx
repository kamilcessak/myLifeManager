import { useMemo } from 'react';
import { Check, Clock, Calendar, Image, GripVertical } from 'lucide-react';
import { Task } from '../types';
import { cn, formatRelativeDate, getDeadlineColor, getPriorityColor, getPriorityLabel } from '../lib/utils';

interface TaskCardProps {
  task: Task;
  onToggleComplete?: (id: string, completed: boolean) => void;
  onEdit?: (task: Task) => void;
  draggable?: boolean;
}

export default function TaskCard({ task, onToggleComplete, onEdit, draggable = true }: TaskCardProps) {
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
      draggable={draggable && !task.isCompleted}
      data-task-id={task.id}
      data-task-data={JSON.stringify(task)}
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.setData('taskData', JSON.stringify(task));
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        {draggable && !task.isCompleted && (
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
            onToggleComplete?.(task.id, !task.isCompleted);
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
            <span className={cn('category-badge', getPriorityColor(task.priority))}>
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
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <Calendar className="w-3 h-3" />
                Zaplanowane
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
