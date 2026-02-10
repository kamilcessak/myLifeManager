import { useRef, useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import { startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { tasksApi, eventsApi, categoriesApi } from '../lib/api';
import { Task, Event, CalendarItem, Category } from '../types';
import EventModal from './EventModal';
import TaskModal from './TaskModal';
import toast from 'react-hot-toast';

export default function CalendarView() {
  const calendarRef = useRef<FullCalendar>(null);
  const queryClient = useQueryClient();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const startDate = startOfMonth(subMonths(currentDate, 1)).toISOString();
  const endDate = endOfMonth(addMonths(currentDate, 1)).toISOString();

  // Fetch categories for TaskModal
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      return response.data.data.categories as Category[];
    },
  });

  const categories = categoriesData || [];

  // Fetch calendar items (tasks + events)
  const { data: calendarData } = useQuery({
    queryKey: ['calendar-items', startDate, endDate],
    queryFn: async () => {
      const [tasksRes, eventsRes] = await Promise.all([
        tasksApi.getAll({
          // scheduled: true, // Fetch all tasks in range (scheduled OR deadline)
          startDate,
          endDate,
        }),
        eventsApi.getAll({
          startDate,
          endDate,
        }),
      ]);

      const tasks = tasksRes.data.data.tasks as Task[];
      const events = eventsRes.data.data.events as Event[];

      // Convert to FullCalendar format - only show tasks that are explicitly scheduled (have scheduledStart).
      // Tasks with only deadline but "Pokaż na kalendarzu" unchecked must NOT appear here.
      const calendarItems: CalendarItem[] = [
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
            color: task.category?.color || '#6b7280',
            data: task,
            classNames: [
              'fc-event-task',
              task.isCompleted ? 'fc-event-task-completed' : ''
            ],
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

      return calendarItems;
    },
  });

  // Schedule task mutation (for drag & drop from inbox)
  const scheduleTaskMutation = useMutation({
    mutationFn: ({ taskId, start, end }: { taskId: string; start: Date; end: Date }) =>
      tasksApi.schedule(taskId, {
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
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
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
    },
    onError: () => {
      toast.error('Nie udało się zaktualizować zadania');
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
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
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
    },
    onError: () => {
      toast.error('Nie udało się zaktualizować wydarzenia');
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
    },
  });

  // Setup external drag from inbox
  useEffect(() => {
    // Small delay to ensure inbox-list is rendered
    const timer = setTimeout(() => {
      const inboxList = document.querySelector('.inbox-list');
      if (inboxList) {
        const draggable = new Draggable(inboxList as HTMLElement, {
          itemSelector: '.task-card',
          eventData: (eventEl) => {
            const taskId = eventEl.getAttribute('data-task-id');
            const taskDataStr = eventEl.getAttribute('data-task-data');
            if (!taskDataStr || !taskId) {
              console.warn('Missing task data attributes');
              return null;
            }
            
            const task = JSON.parse(taskDataStr);
            return {
              id: `external-${taskId}`,
              title: task.title,
              duration: { hours: 1 },
              backgroundColor: task.category?.color || '#6b7280',
              borderColor: task.category?.color || '#6b7280',
              extendedProps: {
                taskId: task.id,
                isExternal: true,
              },
            };
          },
        });
        
        return () => {
          draggable.destroy();
        };
      }
    }, 100);
    
    return () => clearTimeout(timer);
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

    // Check if it's an external task drop
    if (event.extendedProps.isExternal) {
      const taskId = event.extendedProps.taskId;
      scheduleTaskMutation.mutate({ taskId, start, end });
      return;
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

  // Handle event receive (external drop)
  const handleEventReceive = useCallback((info: { event: any }) => {
    const { event } = info;
    const taskId = event.extendedProps.taskId;
    let start = event.start!;
    let end = event.end;

    // If dropped on month view (allDay), set specific time (9:00 - 10:00)
    if (event.allDay || !end) {
      start = new Date(start);
      start.setHours(9, 0, 0, 0);
      end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour
    }

    scheduleTaskMutation.mutate({ taskId, start, end });
    event.remove(); // Remove the external event, it will be re-added from the query
  }, [scheduleTaskMutation]);

  // Handle date select (create new event)
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    setSelectedDateRange({
      start: selectInfo.start,
      end: selectInfo.end,
    });
    setSelectedEvent(null);
    setIsEventModalOpen(true);
    selectInfo.view.calendar.unselect();
  }, []);

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

  // Handle date navigation
  const handleDatesSet = useCallback((dateInfo: { start: Date; end: Date; view: { currentStart: Date } }) => {
    setCurrentDate(dateInfo.view.currentStart);
  }, []);

  const calendarEvents = calendarData?.map((item) => ({
    id: item.id,
    title: item.title,
    start: item.start,
    end: item.end,
    allDay: item.allDay,
    backgroundColor: item.color,
    borderColor: item.color,
    // Combine base class with any specific classes from the item (e.g. completed)
    classNames: [...(item.classNames || [])],
    extendedProps: {
      type: item.type,
      data: item.data,
    },
  })) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex items-center justify-end gap-4 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-blue-500 rounded opacity-90" style={{
              background: 'repeating-linear-gradient(-45deg, #3b82f6, #3b82f6 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)'
            }} />
            <span>Zadanie</span>
          </div>
          <div className="flex items-center gap-1.5 ml-3">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span>Wydarzenie</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
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
          eventReceive={handleEventReceive}
          select={handleDateSelect}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          eventResizableFromStart={true}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }}
          buttonText={{
            today: 'Dziś',
            month: 'Miesiąc',
            week: 'Tydzień',
            day: 'Dzień',
          }}
          allDayText="Cały dzień"
          noEventsText="Brak wydarzeń"
        />
      </div>

      {/* Event Modal */}
      {isEventModalOpen && (
        <EventModal
          event={selectedEvent}
          initialDateRange={selectedDateRange}
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
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}
