import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import {
  EventClickArg,
  EventDropArg,
  DateSelectArg,
  EventContentArg,
  DayCellContentArg,
} from '@fullcalendar/core';
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  subDays,
  addDays,
  startOfDay,
  endOfDay,
  format,
} from 'date-fns';
import { tasksApi, eventsApi } from '../lib/api';
import { Task, Event, CalendarItem } from '../types';
import { useCategories } from '../hooks/useCategories';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useCalendarUiStore } from '../store/useCalendarUiStore';
import { useMobileNavStore } from '../store/useMobileNavStore';
import { useIsMobile } from '../hooks/useIsMobile';
import type { CategoryFilter } from '../store/useCategoryFilterStore';
import { patchTaskInTaskCaches, snapshotTaskCaches, restoreTaskCaches } from '../lib/workspaceTaskCache';
import EventModal from './EventModal';
import TaskDetailPanel from './TaskDetailPanel';
import SelectAddTypeModal, { CalendarSlotSelection } from './SelectAddTypeModal';
import AssigneeAvatar from './AssigneeAvatar';
import toast from 'react-hot-toast';
import { CalendarCheck, CheckSquare } from 'lucide-react';
import { getPriorityCalendarColor } from '../lib/utils';

interface CalendarViewProps {
  activeCategory: CategoryFilter;
}

const NEW_TASK_PANEL_ID = '__new_task__';

/**
 * Czy przedział [start, end) obejmuje więcej niż jeden dzień kalendarzowy.
 * Wydarzenie kończące się dokładnie o północy następnego dnia (np. 09:00 – 00:00)
 * traktujemy nadal jako jednodniowe, dlatego odejmujemy 1 ms od końca.
 */
const spansMultipleCalendarDays = (start: Date, end: Date): boolean => {
  if (end.getTime() <= start.getTime()) return false;
  const lastInstant = new Date(end.getTime() - 1);
  return startOfDay(start).getTime() !== startOfDay(lastInstant).getTime();
};

export default function CalendarView({ activeCategory }: CalendarViewProps) {
  const isMobile = useIsMobile();
  const activeMobileTab = useMobileNavStore((s) => s.activeTab);
  const MONTH_DAY_EVENT_LIMIT = 4;
  const calendarRef = useRef<FullCalendar>(null);
  const draggableRef = useRef<Draggable | null>(null);
  const pendingExternalDropsRef = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const createTaskRequestId = useCalendarUiStore((s) => s.createTaskRequestId);
  const todayRequestId = useCalendarUiStore((s) => s.todayRequestId);
  const lastHandledCreateRequestRef = useRef(createTaskRequestId);
  const lastHandledTodayRequestRef = useRef(todayRequestId);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<CalendarSlotSelection | null>(null);
  const [pendingSlotSelection, setPendingSlotSelection] = useState<CalendarSlotSelection | null>(null);
  const [calendarTaskPrefill, setCalendarTaskPrefill] = useState<CalendarSlotSelection | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const startDate = startOfMonth(subMonths(currentDate, 1)).toISOString();
  const endDate = endOfMonth(addMonths(currentDate, 1)).toISOString();

  const { data: categoriesData } = useCategories();
  const categories = categoriesData || [];

  const { data: rangeTasks } = useTasks({ scope: 'scheduled', startDate, endDate });
  const { data: rangeEvents } = useEvents(startDate, endDate);
  const isCreatingTask = activeTaskId?.startsWith(NEW_TASK_PANEL_ID) ?? false;
  const activeTask = useMemo(() => {
    if (!activeTaskId || activeTaskId.startsWith(NEW_TASK_PANEL_ID)) {
      return null;
    }

    return (rangeTasks ?? []).find((task) => task.id === activeTaskId) ?? null;
  }, [activeTaskId, rangeTasks]);

  const calendarData = useMemo((): CalendarItem[] => {
    const tasks = rangeTasks ?? [];
    const events = rangeEvents ?? [];

    return [
      ...tasks
        .filter((task) => task.scheduledStart != null && task.scheduledEnd != null)
        .map((task) => {
          const start = new Date(task.scheduledStart!);
          const end = new Date(task.scheduledEnd!);
          const allDay = !!task.scheduledAllDay || spansMultipleCalendarDays(start, end);

          return {
            id: `task-${task.id}`,
            title: task.title,
            start,
            end,
            allDay,
            type: 'task' as const,
            color: task.category?.color || '#3b82f6',
            data: task,
            classNames: ['fc-event-task', task.isCompleted ? 'fc-event-task-completed' : ''].filter(Boolean),
          };
        }),
      ...events.map((event) => {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);
        const allDay = event.isAllDay || spansMultipleCalendarDays(start, end);

        return {
          id: event.isRecurringInstance ? event.id : `event-${event.id}`,
          title: event.title,
          start,
          end,
          allDay,
          type: 'event' as const,
          color: event.category?.color || '#3b82f6',
          data: event,
          classNames: ['fc-event-event'],
        };
      }),
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
      setActiveTaskId(null);
      setCalendarTaskPrefill(null);
      setSelectedEvent(eventData);
      setSelectedDateRange(null);
      setIsEventModalOpen(true);
    } else if (itemType === 'task' || itemId.startsWith('task-')) {
      const taskData = clickInfo.event.extendedProps.data as Task;
      setIsEventModalOpen(false);
      setSelectedEvent(null);
      setSelectedDateRange(null);
      setActiveTaskId(taskData.id);
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

  useEffect(() => {
    if (createTaskRequestId === lastHandledCreateRequestRef.current) {
      return;
    }

    lastHandledCreateRequestRef.current = createTaskRequestId;
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setSelectedDateRange(null);
    setCalendarTaskPrefill(null);
    setActiveTaskId(`${NEW_TASK_PANEL_ID}-${createTaskRequestId}`);
  }, [createTaskRequestId]);

  useEffect(() => {
    if (todayRequestId === lastHandledTodayRequestRef.current) {
      return;
    }

    lastHandledTodayRequestRef.current = todayRequestId;
    handleTodayClick();
  }, [handleTodayClick, todayRequestId]);

  // Handle date navigation + sync header month label (mobile)
  const handleDatesSet = useCallback((dateInfo: { start: Date; end: Date; view: { currentStart: Date; type: string } }) => {
    setCurrentDate(dateInfo.view.currentStart);
  }, []);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api || !isMobile) return;
    if (api.view.type === 'timeGridWeek') {
      api.changeView('timeGridDay');
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || activeMobileTab !== 'calendar') return;
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const frame = window.requestAnimationFrame(() => api.updateSize());
    const timeout = window.setTimeout(() => api.updateSize(), 280);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [isMobile, activeMobileTab]);

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

  const renderEventContent = useCallback(
    (arg: EventContentArg) => {
      if (isMobile && arg.view.type === 'dayGridMonth') {
        return <span className="fc-mobile-month-event-placeholder" aria-hidden />;
      }

      const isTask = arg.event.extendedProps.type === 'task';
      const taskData = isTask ? (arg.event.extendedProps.data as Task) : null;
      const eventData = !isTask ? (arg.event.extendedProps.data as Event) : null;
      const assignee = isTask ? taskData?.assignee ?? null : eventData?.assignee ?? null;

      const fullTitle = arg.event.title;
      const start = arg.event.start;
      const end = arg.event.end;
      const timeRangeLabel =
        start && !arg.event.allDay
          ? end
            ? `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`
            : (arg.timeText ?? format(start, 'HH:mm'))
          : null;
      const timeStartOnly =
        start && !arg.event.allDay ? format(start, 'HH:mm') : null;

      if (isMobile) {
        return (
          <div className="fc-item-content fc-item-content--mobile" title={fullTitle}>
            <div className="fc-item-mobile-row">
              {timeStartOnly ? (
                <span className="fc-item-time fc-item-time--mobile-start">{timeStartOnly}</span>
              ) : null}
              <span className="fc-item-title fc-item-title--mobile">{arg.event.title}</span>
            </div>
          </div>
        );
      }

      return (
        <div className="fc-item-content" title={fullTitle}>
          <div className="fc-item-meta-row">
            <div className="fc-item-meta-left">
              {isTask && taskData ? (
                <button
                  type="button"
                  className="fc-item-checkbox flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border border-white/80 bg-white/20 p-0 text-white"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleComplete(taskData.id, taskData.isCompleted);
                  }}
                  aria-label={taskData.isCompleted ? 'Odznacz jako ukończone' : 'Oznacz jako ukończone'}
                >
                  {taskData.isCompleted ? <CheckSquare className="h-3 w-3" strokeWidth={2.5} /> : null}
                </button>
              ) : null}
              {!isTask ? (
                <span className="fc-item-type-icon" aria-hidden="true">
                  <CalendarCheck className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
              ) : null}
              {timeRangeLabel ? <span className="fc-item-time">{timeRangeLabel}</span> : null}
            </div>
            {assignee ? (
              <div className="fc-item-assignee">
                <AssigneeAvatar
                  assignee={assignee}
                  size="xs"
                  className="h-3.5 w-3.5 text-[9px]"
                  showTitle
                />
              </div>
            ) : null}
          </div>
          <span className="fc-item-title">{arg.event.title}</span>
        </div>
      );
    },
    [handleToggleComplete, isMobile],
  );

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

  /** Na mobile w widoku miesiąca: max 3 unikalne kolory kategorii na dzień (kropki pod numerem dnia). */
  const mobileMonthDayDotColors = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of filteredCalendarItems) {
      const color = item.color || '#3b82f6';
      const startDay = startOfDay(item.start);
      const endInclusive = new Date(item.end.getTime() - 1);
      const endDay = startOfDay(endInclusive);
      let cursor = startDay;
      while (cursor.getTime() <= endDay.getTime()) {
        const key = format(cursor, 'yyyy-MM-dd');
        const list = map.get(key) ?? [];
        if (list.length < 3 && !list.includes(color)) {
          list.push(color);
        }
        map.set(key, list);
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [filteredCalendarItems]);

  const renderDayCellContent = useCallback(
    (arg: DayCellContentArg) => {
      if (!isMobile || arg.view.type !== 'dayGridMonth') {
        return false;
      }
      const dayKey = format(startOfDay(arg.date), 'yyyy-MM-dd');
      const colors = mobileMonthDayDotColors.get(dayKey) ?? [];
      return (
        <div className="fc-mobile-day-cell-inner">
          <a className="fc-daygrid-day-number">{arg.dayNumberText}</a>
          {colors.length > 0 ? (
            <div className="fc-mobile-day-dots" aria-hidden>
              {colors.map((c, i) => (
                <span key={`${dayKey}-dot-${i}`} className="fc-mobile-day-dot" style={{ backgroundColor: c }} />
              ))}
            </div>
          ) : null}
        </div>
      );
    },
    [isMobile, mobileMonthDayDotColors],
  );

  const calendarEvents = useMemo(() => {
    return filteredCalendarItems.map((item) => {
      const isTask = item.type === 'task';
      const priorityBorderColor = isTask
        ? getPriorityCalendarColor((item.data as Task).priority)
        : item.color;

      return {
        id: item.id,
        title: item.title,
        start: item.start,
        end: item.end,
        allDay: item.allDay,
        display: 'block',
        backgroundColor: item.color,
        borderColor: priorityBorderColor,
        classNames: [
          ...(item.classNames || []),
          'fc-event-filter-animated',
          isTask && (item.data as Task).id === activeTaskId ? 'fc-event-task-active' : '',
        ].filter(Boolean),
        extendedProps: {
          type: item.type,
          data: item.data,
        },
      };
    });
  }, [activeTaskId, filteredCalendarItems]);

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      calendarApi.updateSize();
    });
    const timeoutId = window.setTimeout(() => {
      calendarApi.updateSize();
    }, 280);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [activeCategory, activeTaskId]);

  return (
    <div className="calendar-with-detail-panel">
      {/* Calendar */}
      <div className="calendar-main-pane">
        <div className="min-h-0 flex-1">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
          customButtons={{
            todayScroll: {
              text: 'Dziś',
              click: handleTodayClick,
            },
          }}
          headerToolbar={
            isMobile
              ? {
                  left: 'prev title next',
                  center: 'todayScroll dayGridMonth timeGridDay',
                  right: '',
                }
              : {
                  left: 'prev,next todayScroll',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }
          }
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
          dayCellContent={renderDayCellContent}
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
            dayGridMonth: {
              dayMaxEvents: MONTH_DAY_EVENT_LIMIT,
              fixedWeekCount: false,
            },
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
            setIsEventModalOpen(false);
            setSelectedEvent(null);
            setSelectedDateRange(null);
            setCalendarTaskPrefill(slot);
            setActiveTaskId(NEW_TASK_PANEL_ID);
          }}
          onChooseEvent={(slot) => {
            setPendingSlotSelection(null);
            setActiveTaskId(null);
            setCalendarTaskPrefill(null);
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
          presentation={isMobile ? 'modal' : 'panel'}
          onClose={() => {
            setIsEventModalOpen(false);
            setSelectedEvent(null);
            setSelectedDateRange(null);
          }}
        />
      )}

      {activeTaskId && (isCreatingTask || activeTask) && (
        <TaskDetailPanel
          key={activeTaskId}
          task={activeTask}
          categories={categories}
          initialMode={activeTask ? 'view' : 'edit'}
          calendarSelectPrefill={calendarTaskPrefill}
          presentation={isMobile ? 'bottom-sheet' : 'panel'}
          onClose={() => {
            setActiveTaskId(null);
            setCalendarTaskPrefill(null);
          }}
        />
      )}
    </div>
  );
}
