import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import type { AppStackParamList } from './types';
import { TaskDetailScreen } from '../screens/main/TaskDetailScreen';
import { TeamManagerScreen } from '../screens/main/TeamManagerScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{
          headerShown: true,
          title: 'Zadanie',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="TeamManager"
        component={TeamManagerScreen}
        options={{
          headerShown: true,
          title: 'Zespół',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}
