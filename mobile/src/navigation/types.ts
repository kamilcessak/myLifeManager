import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Task } from '@mlm/shared';
import type { MainTabParamList } from './MainTabs';

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  TaskDetail: { task: Task };
  TaskEdit: { taskId: string };
  EventEdit: { eventId: string };
  TeamManager: { teamId: string; teamName: string };
};
