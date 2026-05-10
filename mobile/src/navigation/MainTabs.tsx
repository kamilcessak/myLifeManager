import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher';
import { CalendarScreen } from '../screens/main/CalendarScreen';
import { InboxScreen } from '../screens/main/InboxScreen';
import { ProfileStack } from './ProfileStack';

export type MainTabParamList = {
  Inbox: undefined;
  Calendar: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerRight: () => <WorkspaceSwitcher />,
      }}
    >
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ title: 'Skrzynka' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Kalendarz' }} />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: 'Profil', headerShown: false }}
      />
    </Tab.Navigator>
  );
}
