import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { EventClickArg, EventDropArg, DateSelectArg, EventContentArg } from '@fullcalendar/core';
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  subDays,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { tasksApi, eventsApi } from '../lib/api';
import { Task, Event, CalendarItem } from '../types';
import { useCategories } from '../hooks/useCategories';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { patchTaskInTaskCaches, snapshotTaskCaches, restoreTaskCaches } from '../lib/workspaceTaskCache';
import EventModal from './EventModal';
import TaskModal from './TaskModal';
import SelectAddTypeModal, { CalendarSlotSelection } from './SelectAddTypeModal';
import toast from 'react-hot-toast';
import { CalendarCheck, CheckSquare } from 'lucide-react';

interface CalendarViewProps {
  activeCategory: string | 'all' | 'none';
}

/** Zielony tylko dla ukończonych; oczekujące — brand (niezależnie od kategorii). */
const CAL_COMPLETED_TASK_BG = '#16a34a';
const CAL_PENDING_TASK_BG = '#3b82f6';

export default function CalendarView({ activeCategory }: CalendarViewProps) {
  const MONTH_DAY_EVENT_LIMIT = 4;
  const calendarRef = useRef<FullCalendar>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const pendingExternalDropsRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<CalendarSlotSelection | null>(null);
  const [pendingSlotSelection, setPendingSlotSelection] = useState<CalendarSlotSelection | null>(null);
  const [calendarTaskPrefill, setCalendarTaskPrefill] = useState<CalendarSlotSelection | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const startDate = startOfMonth(subMonths(currentDate, 1)).toISOString();
  const endDate = endOfMonth(addMonths(currentDate, 1)).toISOString();

  const { data: categoriesData } = useCategories();
  const categories = categoriesData || [];

  const { data: rangeTasks } = useTasks({ scope: 'scheduled', startDate, endDate });
  const { data: rangeEvents } = useEvents(startDate, endDate);

  const calendarData = useMemo((): CalendarItem[] => {
    const tasks = rangeTasks ?? [];
    const events = rangeEvents ?? [];

    return [
      ...tasks
        .filter((task) => task.scheduledStart != null && task.scheduledEnd != null)
        .map((task) => {
          const start = new Date(task.scheduledStart!);
          const end = new Date(task.scheduledEnd!);

          return {
            id: `task-${task.id}`,
            title: task.title,
            start,
            end,
            allDay: !!task.scheduledAllDay,
            type: 'task' as const,
            color: task.isCompleted ? CAL_COMPLETED_TASK_BG : CAL_PENDING_TASK_BG,
            data: task,
            classNames: ['fc-event-task', task.isCompleted ? 'fc-event-task-completed' : ''].filter(Boolean),
          };
        }),
      ...events.map((event) => ({
        id: event.isRecurringInstance ? event.id : `event-${event.id}`,
        title: event.title,
        start: new Date(event.startTime),
        end: new Date(event.endTime),
        allDay: event.isAllDay,
        type: 'event' as const,
        color: event.category?.color || '#3b82f6',
        data: event,
        classNames: ['fc-event-event'],
      })),
    ];
  }, [rangeTasks, rangeEvents]);

  // Schedule task mutation (for drag & drop from inbox)
  const scheduleTaskMutation = useMutation({
    mutationFn: ({ taskId, start, end }: { taskId: string; start: Date; end: Date }) =>
      tasksApi.schedule(taskId, {
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Zadanie zaplanowane');
    },
    onError: () => {
      toast.error('Nie udało się zaplanować zadania');
    },
  });

  // Update task time mutation (for drag within calendar)
  const updateTaskTimeMutation = useMutation({
    mutationFn: ({ taskId, start, end }: { taskId: string; start: Date; end: Date }) =>
      tasksApi.update(taskId, {
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => {
      toast.error('Nie udało się zaktualizować zadania');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Update event time mutation
  const updateEventTimeMutation = useMutation({
    mutationFn: ({ eventId, start, end }: { eventId: string; start: Date; end: Date }) =>
      eventsApi.update(eventId, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: () => {
      toast.error('Nie udało się zaktualizować wydarzenia');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  // Toggle task completion mutation
  const toggleTaskCompleteMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) =>
      tasksApi.update(taskId, { isCompleted }),
    onError: () => {
      toast.error('Nie udało się zaktualizować statusu zadania');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Setup external drag from inbox
  useEffect(() => {
    // Small delay to ensure inbox-list is rendered
    const timer = window.setTimeout(() => {
      const inboxList = document.querySelector('.inbox-list');
      if (!inboxList) {
        return;
      }

      // Guard against duplicate Draggable instances (e.g. StrictMode double effects)
      if (draggableRef.current) {
        draggableRef.current.destroy();
        draggableRef.current = null;
      }

      draggableRef.current = new Draggable(inboxList as HTMLElement, {
        itemSelector: '.task-card',
        eventData: (eventEl) => {
          const taskCard = eventEl.closest('.task-card') as HTMLElement | null;
          if (!taskCard) {
            console.warn('Missing task card element');
            return null;
          }

          const taskId = taskCard.getAttribute('data-task-id');
          const taskTitle = taskCard.getAttribute('data-task-title');
          const taskColor = taskCard.getAttribute('data-task-color');
          if (!taskId || !taskTitle) {
            console.warn('Missing task data attributes');
            return null;
          }

          return {
            id: `external-${taskId}`,
            title: taskTitle,
            duration: { hours: 1 },
            backgroundColor: taskColor || '#6b7280',
            borderColor: taskColor || '#6b7280',
            extendedProps: {
              taskId,
              isExternal: true,
            },
          };
        },
      });
    }, 100);

    return () => {
      window.clearTimeout(timer);
      if (draggableRef.current) {
        draggableRef.current.destroy();
        draggableRef.current = null;
      }
    };
  }, []);

  // Handle event drop (both internal and external)
  const handleEventDrop = useCallback((info: EventDropArg) => {
    const { event } = info;
    let start = event.start!;
    let end = event.end;

    // If dropped on month view (allDay) or no end time, set specific time
    if (event.allDay || !end) {
      start = new Date(start);
      start.setHours(9, 0, 0, 0);
      end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour
    }

    // Internal calendar item moved
    const itemId = event.id;
    if (itemId.startsWith('task-')) {
      const taskId = itemId.replace('task-', '');
      updateTaskTimeMutation.mutate({ taskId, start, end });
    } else if (itemId.startsWith('event-')) {
      const eventId = itemId.replace('event-', '');
      updateEventTimeMutation.mutate({ eventId, start, end });
    }
  }, [scheduleTaskMutation, updateTaskTimeMutation, updateEventTimeMutation]);

  const handleToggleComplete = useCallback((taskId: string, currentStatus: boolean) => {
    const nextIsCompleted = !currentStatus;
    const teamId = useWorkspaceStore.getState().activeWorkspaceId;
    const previous = snapshotTaskCaches(queryClient, teamId);

    patchTaskInTaskCaches(queryClient, teamId, taskId, { isCompleted: nextIsCompleted });

    toggleTaskCompleteMutation.mutate(
      { taskId, isCompleted: nextIsCompleted },
      {
        onError: () => {
          restoreTaskCaches(queryClient, previous);
        },
      },
    );
  }, [queryClient, toggleTaskCompleteMutation]);

  const handleEventResize = useCallback(
    ({ event, start, end }: { event: any; start: Date; end: Date }) => {
      if (event.id.startsWith('task-')) {
        const taskId = event.id.replace('task-', '');
        updateTaskTimeMutation.mutate({ taskId, start, end });
        return;
      }

      if (event.id.startsWith('event-')) {
        const eventId = event.id.replace('event-', '');
        updateEventTimeMutation.mutate({ eventId, start, end });
      }
    },
    [updateEventTimeMutation, updateTaskTimeMutation]
  );

  // Handle event receive (external drop)
  const handleEventReceive = useCallback((info: { event: any }) => {
    const { event } = info;
    const taskId = event.extendedProps.taskId;
    if (!taskId) {
      event.remove();
      return;
    }

    // Guard against duplicate receive callbacks for the same external drop
    if (pendingExternalDropsRef.current.has(taskId)) {
      event.remove();
      return;
    }
    pendingExternalDropsRef.current.add(taskId);

    let start = event.start!;
    let end = event.end;

    // If dropped on month view (allDay), set specific time (9:00 - 10:00)
    if (event.allDay || !end) {
      start = new Date(start);
      start.setHours(9, 0, 0, 0);
      end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour
    }

    scheduleTaskMutation.mutate(
      { taskId, start, end },
      {
        onSettled: () => {
          pendingExternalDropsRef.current.delete(taskId);
        },
      }
    );
    event.remove(); // Remove the external event, it will be re-added from the query
  }, [scheduleTaskMutation]);

  const normalizeCalendarSelect = useCallback((selectInfo: DateSelectArg): CalendarSlotSelection => {
    const { start, end, allDay } = selectInfo;
    if (allDay) {
      const lastInclusiveDay = subDays(selectInfo.end, 1);
      return {
        start: startOfDay(start),
        end: endOfDay(lastInclusiveDay),
        allDay: true,
      };
    }
    const endAt = end ?? new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end: endAt, allDay: false };
  }, []);

  // Handle date select — choose task vs event (drag & drop unchanged)
  const handleDateSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      setPendingSlotSelection(normalizeCalendarSelect(selectInfo));
      selectInfo.view.calendar.unselect();
    },
    [normalizeCalendarSelect]
  );

  // Handle event click
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const itemId = clickInfo.event.id;
    const itemType = clickInfo.event.extendedProps.type;
    
    if (itemType === 'event' || itemId.startsWith('event-')) {
      const eventData = clickInfo.event.extendedProps.data as Event;
      setSelectedEvent(eventData);
      setSelectedDateRange(null);
      setIsEventModalOpen(true);
    } else if (itemType === 'task' || itemId.startsWith('task-')) {
      const taskData = clickInfo.event.extendedProps.data as Task;
      setSelectedTask(taskData);
      setIsTaskModalOpen(true);
    }
  }, []);

  const scrollToCurrentTime = useCallback(() => {
    const indicator = document.querySelector('.fc-timegrid-now-indicator-line') as HTMLElement | null;
    if (indicator) {
      indicator.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleTodayClick = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;
    calendarApi.today();
    setTimeout(scrollToCurrentTime, 100);
  }, [scrollToCurrentTime]);

  // Handle date navigation
  const handleDatesSet = useCallback((dateInfo: { start: Date; end: Date; view: { currentStart: Date; type: string } }) => {
    setCurrentDate(dateInfo.view.currentStart);
  }, []);

  const focusFirstTaskInDayView = useCallback(() => {
    window.requestAnimationFrame(() => {
      const firstTaskEl = document.querySelector(
        '.fc-timeGridDay-view .fc-timegrid-event.fc-event-task, .fc-dayGridDay-view .fc-daygrid-event.fc-event-task'
      ) as HTMLElement | null;

      if (firstTaskEl) {
        firstTaskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, []);

  const handleMoreLinkClick = useCallback((arg: { date: Date }) => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) {
      return 'popover';
    }

    calendarApi.changeView('timeGridDay', arg.date);
    setTimeout(() => {
      focusFirstTaskInDayView();
    }, 150);

    return 'none';
  }, [focusFirstTaskInDayView]);

  const renderEventContent = useCallback((arg: EventContentArg) => {
    const isTask = arg.event.extendedProps.type === 'task';
    const taskData = isTask ? (arg.event.extendedProps.data as Task) : null;

    const fullTitle = arg.event.title;

    return (
      <div className="fc-item-content" title={fullTitle}>
        {isTask && taskData ? (
          <button
            type="button"
            className="flex-shrink-0 w-4 h-4 rounded border border-white/80 bg-white/20 text-white flex items-center justify-center"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleComplete(taskData.id, taskData.isCompleted);
            }}
            aria-label={taskData.isCompleted ? 'Odznacz jako ukończone' : 'Oznacz jako ukończone'}
          >
            {taskData.isCompleted ? <CheckSquare className="w-3 h-3" /> : null}
          </button>
        ) : null}
        <span className="fc-item-icon" aria-hidden="true">
          {isTask ? <CheckSquare className="w-3 h-3" /> : <CalendarCheck className="w-3 h-3" />}
        </span>
        <div className="fc-item-text">
          {arg.timeText ? (
            <span className="fc-item-time" title={fullTitle}>
              {arg.timeText}
            </span>
          ) : null}
          <span className="fc-item-title" title={fullTitle}>
            {arg.event.title}
          </span>
        </div>
      </div>
    );
  }, [handleToggleComplete]);

  const onCalendarEventResize = useCallback((info: { event: { id: string; start: Date | null; end: Date | null } }) => {
    if (!info.event.start || !info.event.end) {
      return;
    }

    handleEventResize({
      event: info.event,
      start: info.event.start,
      end: info.event.end,
    });
  }, [handleEventResize]);

  const filteredCalendarItems = useMemo(() => {
    return (calendarData || []).filter((item) => {
      const itemCategoryId = (item.data as Task | Event).categoryId;
      const itemCategoryName = (item.data as Task | Event).category?.name;

      if (activeCategory === 'all') {
        return true;
      }

      if (activeCategory === 'none') {
        return !itemCategoryId;
      }

      return itemCategoryId === activeCategory || itemCategoryName === activeCategory;
    });
  }, [calendarData, activeCategory]);

  const calendarEvents = useMemo(() => {
    return filteredCalendarItems.map((item) => ({
      id: item.id,
      title: item.title,
      start: item.start,
      end: item.end,
      allDay: item.allDay,
      backgroundColor: item.color,
      borderColor: item.color,
      classNames: [...(item.classNames || [])],
      extendedProps: {
        type: item.type,
        data: item.data,
      },
    }));
  }, [filteredCalendarItems]);

  return (
    <div className="h-full flex flex-col">
      {/* Calendar */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="min-h-0 flex-1">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          customButtons={{
            todayScroll: {
              text: 'Dziś',
              click: handleTodayClick,
            },
          }}
          headerToolbar={{
            left: 'prev,next todayScroll',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          locale="pl"
          firstDay={1}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          scrollTime="08:00:00"
          height="100%"
          events={calendarEvents}
          editable={true}
          selectable={true}
          selectMirror={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventResize={onCalendarEventResize}
          eventReceive={handleEventReceive}
          select={handleDateSelect}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          eventDurationEditable={true}
          eventResizableFromStart={false}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          nowIndicator={true}
          eventContent={renderEventContent}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          buttonText={{
            month: 'Miesiąc',
            week: 'Tydzień',
            day: 'Dzień',
          }}
          allDayText="Cały dzień"
          noEventsText="Brak wydarzeń"
          views={{
            dayGridMonth: { dayMaxEvents: MONTH_DAY_EVENT_LIMIT },
            timeGridWeek: { dayMaxEvents: 2 },
          }}
          moreLinkContent={(arg) => `Zobacz więcej (+${arg.num})`}
          moreLinkHint={(count) => `Zobacz ${count} dodatkowych pozycji`}
          moreLinkClick={handleMoreLinkClick}
        />
        </div>
      </div>

      {/* Event Modal */}
      {pendingSlotSelection && (
        <SelectAddTypeModal
          selection={pendingSlotSelection}
          onClose={() => setPendingSlotSelection(null)}
          onChooseTask={(slot) => {
            setPendingSlotSelection(null);
            setSelectedTask(null);
            setCalendarTaskPrefill(slot);
            setIsTaskModalOpen(true);
          }}
          onChooseEvent={(slot) => {
            setPendingSlotSelection(null);
            setSelectedEvent(null);
            setSelectedDateRange(slot);
            setIsEventModalOpen(true);
          }}
        />
      )}

      {isEventModalOpen && (
        <EventModal
          event={selectedEvent}
          initialDateRange={selectedDateRange}
          initialMode={selectedEvent ? 'view' : 'edit'}
          onClose={() => {
            setIsEventModalOpen(false);
            setSelectedEvent(null);
            setSelectedDateRange(null);
          }}
        />
      )}

      {/* Task Modal */}
      {isTaskModalOpen && (
        <TaskModal
          task={selectedTask}
          categories={categories}
          initialMode={selectedTask ? 'view' : 'edit'}
          calendarSelectPrefill={calendarTaskPrefill}
          onTaskUpdated={(patch) =>
            setSelectedTask((t) => (t && t.id === patch.id ? { ...t, ...patch } : t))
          }
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
            setCalendarTaskPrefill(null);
          }}
        />
      )}
    </div>
  );
}
