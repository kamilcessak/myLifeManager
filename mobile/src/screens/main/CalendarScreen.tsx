import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Task } from '@mlm/shared';
import { addHours, endOfDay, endOfWeek, format, startOfDay, startOfWeek } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Calendar,
  type CalendarTouchableOpacityProps,
} from 'react-native-big-calendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import 'dayjs/locale/pl';
import { ScheduleSlotModal } from '../../components/calendar/ScheduleSlotModal';
import { AssigneeFilterToggle } from '../../components/AssigneeFilterToggle';
import {
  buildCalendarEventsFromTasksAndEvents,
  type MlmCalendarEvent,
} from '../../lib/buildCalendarEvents';
import { getEventStableId, getTaskStableId } from '../../lib/calendarEntityIds';
import { useCalendarRangeQueries } from '../../hooks/useCalendarDataQueries';
import { useInboxTasks } from '../../hooks/useInboxTasks';
import { useScheduleTaskMutation } from '../../hooks/useScheduleTaskMutation';
import type { AppStackParamList } from '../../navigation/types';
import { useAssigneeFilterStore } from '../../store/assigneeFilterStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

dayjs.locale('pl');

const WEEK_STARTS_ON = 1 as const;

function initialFetchRange(): { startIso: string; endIso: string } {
  const now = new Date();
  const start = startOfDay(startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }));
  const end = endOfDay(endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function CalendarScreen() {
  const tabNavigation = useNavigation();
  const stackNavigation =
    tabNavigation.getParent<NativeStackNavigationProp<AppStackParamList>>();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const onlyMine = useAssigneeFilterStore((s) => s.onlyMine);
  const [fetchRange, setFetchRange] = useState(initialFetchRange);
  const [calHeight, setCalHeight] = useState(0);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [pendingSlotStart, setPendingSlotStart] = useState<Date | null>(null);

  const { tasks, events, isPending: rangePending, isFetching: rangeFetching, error: rangeError } =
    useCalendarRangeQueries(activeWorkspaceId, fetchRange.startIso, fetchRange.endIso);
  const inboxQuery = useInboxTasks();
  const scheduleMutation = useScheduleTaskMutation();

  useLayoutEffect(() => {
    tabNavigation.setOptions({
      headerLeft:
        activeWorkspaceId !== null
          ? () => (
              <View style={styles.headerLeft}>
                <AssigneeFilterToggle />
              </View>
            )
          : undefined,
    });
  }, [tabNavigation, activeWorkspaceId, onlyMine]);

  const calendarEvents = useMemo(
    () => buildCalendarEventsFromTasksAndEvents(tasks, events),
    [tasks, events],
  );

  const onChangeDate = useCallback(([rangeStart, rangeEnd]: [Date, Date]) => {
    setFetchRange({
      startIso: startOfDay(rangeStart).toISOString(),
      endIso: endOfDay(rangeEnd).toISOString(),
    });
  }, []);

  const onPressCell = useCallback((d: Date) => {
    setPendingSlotStart(d);
    setScheduleModalOpen(true);
  }, []);

  const onPressEvent = useCallback(
    (ev: MlmCalendarEvent) => {
      if (ev.itemKind === 'task' && ev.sourceTask) {
        stackNavigation?.navigate('TaskDetail', { task: ev.sourceTask });
        return;
      }
      if (ev.itemKind === 'event' && ev.sourceEvent) {
        const stable = getEventStableId(ev.sourceEvent);
        const lines = ev.sourceEvent.isRecurringInstance
          ? `Instancja: ${ev.sourceEvent.id}\nID bazowe (szczegóły): ${stable}`
          : `ID: ${stable}`;
        Alert.alert('Wydarzenie', `${ev.sourceEvent.title}\n\n${lines}`);
      }
    },
    [stackNavigation],
  );

  const renderEvent = useCallback(
    (event: MlmCalendarEvent, touchable: CalendarTouchableOpacityProps) => {
      const stripe =
        event.itemKind === 'task' && event.priorityColor != null
          ? event.priorityColor
          : event.accentColor;
      const badge = event.itemKind === 'task' ? 'ZAD' : 'EVE';
      const badgeBg = event.itemKind === 'task' ? '#1F2937' : '#1D4ED8';

      return (
        <TouchableOpacity {...touchable}>
          <View
            style={[
              styles.eventCell,
              { borderLeftColor: stripe, backgroundColor: `${event.accentColor}1A` },
            ]}
          >
            <View style={styles.eventHeader}>
              <View style={[styles.kindBadge, { backgroundColor: badgeBg }]}>
                <Text style={styles.kindBadgeText}>{badge}</Text>
              </View>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {event.title}
              </Text>
            </View>
            {event.itemKind === 'task' && event.sourceTask?.category?.name ? (
              <Text style={styles.eventCategory} numberOfLines={1}>
                {event.sourceTask.category.name}
              </Text>
            ) : null}
            {event.itemKind === 'event' && event.sourceEvent?.category?.name ? (
              <Text style={styles.eventCategory} numberOfLines={1}>
                {event.sourceEvent.category.name}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [],
  );

  const slotLabel = pendingSlotStart
    ? format(pendingSlotStart, 'EEEE d MMMM yyyy, HH:mm', { locale: pl })
    : '';

  const handleSelectTask = useCallback(
    (task: Task) => {
      if (!pendingSlotStart) return;
      const start = pendingSlotStart;
      const end = addHours(start, 1);
      scheduleMutation.mutate(
        {
          taskId: getTaskStableId(task),
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
          range: { startIso: fetchRange.startIso, endIso: fetchRange.endIso },
        },
        {
          onSuccess: () => {
            setScheduleModalOpen(false);
            setPendingSlotStart(null);
          },
          onError: (err) => {
            Alert.alert(
              'Nie udało się zaplanować',
              err instanceof Error ? err.message : 'Spróbuj ponownie.',
            );
          },
        },
      );
    },
    [pendingSlotStart, fetchRange.startIso, fetchRange.endIso, scheduleMutation],
  );

  const closeModal = useCallback(() => {
    setScheduleModalOpen(false);
    setPendingSlotStart(null);
  }, []);

  const listError = rangeError?.message ?? null;
  const isInitialLoading = rangePending;
  const isRefetching = rangeFetching && !rangePending;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.hint}>
          Stuknij komórkę, aby zaplanować zadanie z inboxa (blok 1 h).
        </Text>
        {isRefetching ? (
          <ActivityIndicator size="small" style={styles.topSpinner} />
        ) : null}
      </View>
      {listError ? <Text style={styles.errorBanner}>{listError}</Text> : null}

      <View
        style={styles.calWrap}
        onLayout={(e) => setCalHeight(e.nativeEvent.layout.height)}
      >
        {calHeight > 0 ? (
          <Calendar<MlmCalendarEvent>
            events={calendarEvents}
            height={calHeight}
            mode="week"
            weekStartsOn={WEEK_STARTS_ON}
            locale="pl"
            scrollOffsetMinutes={7 * 60}
            showTime
            eventsAreSorted
            onChangeDate={onChangeDate}
            onPressCell={onPressCell}
            onPressEvent={onPressEvent}
            renderEvent={renderEvent}
            minHour={6}
            maxHour={22}
          />
        ) : null}
        {isInitialLoading && calHeight > 0 ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" />
          </View>
        ) : null}
      </View>

      <ScheduleSlotModal
        visible={scheduleModalOpen}
        onClose={closeModal}
        slotLabel={slotLabel}
        inboxTasks={inboxQuery.data}
        isLoadingInbox={inboxQuery.isPending}
        onSelectTask={handleSelectTask}
        isScheduling={scheduleMutation.isPending}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  safe: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hint: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  topSpinner: {
    marginRight: 4,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    fontSize: 13,
  },
  calWrap: {
    flex: 1,
    minHeight: 200,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  eventCell: {
    flex: 1,
    borderRadius: 6,
    borderLeftWidth: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  kindBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kindBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  eventTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  eventCategory: {
    marginTop: 2,
    fontSize: 10,
    color: '#4B5563',
  },
});
